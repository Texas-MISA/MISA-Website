#!/usr/bin/env node
// Regenerate lib/network-prefixes.generated.ts from live BGP data.
//
//   node scripts/build-network-table.mjs
//
// Writes the CIDR table lib/network-classify.ts matches check-in origins
// against: which address ranges are UT Austin's, and which belong to a US
// mobile carrier. Plan: docs/checkin-location-verification.md.
//
// ---------------------------------------------------------------------------
// Why this is a script and not a hand-written table
// ---------------------------------------------------------------------------
//
// The plan called for a hand-written list, on the reasonable guess that a few
// dozen prefixes would cover it. Measured, the carriers announce ~6,300 IPv4
// prefixes between them — AT&T Mobility alone announces 1,633 and Verizon's
// Cellco announces 3,842. That is not a list anybody can type correctly, and a
// wrong 'cellular' entry is worse than a missing one: it hands a free pass to
// whoever is inside it, on the strength of a fabricated fact.
//
// So the table is generated and committed. 📌 The properties that made the
// hand-written version attractive all survive: the application has NO runtime
// dependency, makes NO request-time network call, and no member's address ever
// leaves the server. This script runs when a human decides it should.
//
// 🪤 Re-run it when a whole carrier starts reading 'other'. Nothing detects
// staleness on its own — GENERATED_AT in the output is the only signal, and a
// stale table fails toward flagging real attendees, not toward missing fraud.

import { writeFile } from "node:fs/promises";

// The autonomous systems whose announced prefixes define each kind.
//
// ⚠️ Verified against RIPEstat's whois on 2026-08-22, because an ASN read off
// a blog post is exactly the kind of fact that is confidently wrong. The names
// below are what RIPEstat returned, not what was expected:
//
//   AS6167  is CELLCO-PART — Cellco Partnership is Verizon Wireless's legal
//           name, so this is the right ASN despite not saying "Verizon".
//   AS20057 is ATT-MOBILITY-LLC — the wireless arm, NOT AT&T's consumer
//           broadband, which is a different ASN and must stay out of this list.
//
// 📌 Adding an MVNO is a one-line change here followed by a re-run.
const SOURCES = [
  { asn: 18, kind: "campus", label: "UTEXAS — University of Texas at Austin" },
  { asn: 20057, kind: "cellular", label: "ATT-MOBILITY-LLC" },
  { asn: 21928, kind: "cellular", label: "T-MOBILE" },
  { asn: 6167, kind: "cellular", label: "CELLCO-PART (Verizon Wireless)" },
  { asn: 22394, kind: "cellular", label: "CELLCO (Verizon Wireless)" },
];

const OUT = "lib/network-prefixes.generated.ts";

// RIPE NCC's public stats service. No key, no account, documented and stable,
// and it reports what the routing table actually carries rather than what a
// registry says was allocated. Its default already drops routes seen by fewer
// than ten full-feed peers, which is the filter we would otherwise want.
const endpoint = (asn) =>
  `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`;

async function announcedPrefixes(asn) {
  const res = await fetch(endpoint(asn));
  if (!res.ok) throw new Error(`AS${asn}: RIPEstat returned ${res.status}`);
  const body = await res.json();
  if (body.status !== "ok") throw new Error(`AS${asn}: status ${body.status}`);
  const prefixes = body.data?.prefixes;
  if (!Array.isArray(prefixes) || prefixes.length === 0) {
    // Refuse loudly rather than writing an empty table. An empty 'cellular'
    // list silently flags every member on a phone, which is the exact failure
    // this feature exists to avoid.
    throw new Error(`AS${asn}: no prefixes returned — refusing to write`);
  }
  return prefixes.map((p) => p.prefix);
}

// --- Address arithmetic ----------------------------------------------------
//
// Kept separate from lib/network-classify.ts on purpose: this half runs in
// node with the whole table in hand, that half runs per request against the
// generated output. Sharing them would put a parser nothing calls at runtime
// into the serverless bundle.

function v4ToInt(text) {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const byte = Number(part);
    if (byte > 255) return null;
    n = n * 256 + byte;
  }
  return n;
}

function v6ToBigInt(text) {
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  let n = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    n = (n << 16n) | BigInt(parseInt(group, 16));
  }
  return n;
}

/** CIDR -> inclusive [start, end], or null if it is not the family asked for. */
function toRange(cidr, family) {
  const [addr, lenText] = cidr.split("/");
  if (lenText === undefined) return null;
  const len = Number(lenText);
  const isV6 = addr.includes(":");
  if (family === "v4" && isV6) return null;
  if (family === "v6" && !isV6) return null;

  if (family === "v4") {
    const base = v4ToInt(addr);
    if (base === null || !Number.isInteger(len) || len < 0 || len > 32) return null;
    const size = 2 ** (32 - len);
    // Normalise to the block's own base — a sloppily written 1.2.3.4/24 must
    // become 1.2.3.0/24 rather than a range straddling the next block.
    const start = Math.floor(base / size) * size;
    return [start, start + size - 1];
  }

  const base = v6ToBigInt(addr);
  if (base === null || !Number.isInteger(len) || len < 0 || len > 128) return null;
  const size = 1n << BigInt(128 - len);
  const start = (base / size) * size;
  return [start, start + size - 1n];
}

/**
 * Sort, then coalesce touching or overlapping ranges.
 *
 * 🪤 Merging is not a tidy-up. A carrier announces the same space at several
 * prefix lengths, so the raw lists overlap heavily — and lib/network-classify
 * binary-searches for the one range containing an address, which is only a
 * correct search if the ranges are disjoint and ordered.
 */
function merge(ranges) {
  const sorted = [...ranges].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    // `+ 1` so 10.0.0.0-10.0.0.255 and 10.0.1.0-10.0.1.255 become one range.
    if (last && start <= last[1] + (typeof start === "bigint" ? 1n : 1)) {
      if (end > last[1]) last[1] = end;
    } else {
      out.push([start, end]);
    }
  }
  return out;
}

const flat = (ranges, suffix = "") =>
  ranges.flat().map((n) => `${n}${suffix}`).join(",");

async function main() {
  const collected = { campus: [], cellular: [] };
  const provenance = [];

  for (const { asn, kind, label } of SOURCES) {
    process.stdout.write(`AS${asn} (${label})… `);
    const prefixes = await announcedPrefixes(asn);
    collected[kind].push(...prefixes);
    provenance.push(`AS${asn} ${label} — ${prefixes.length} prefixes`);
    console.log(`${prefixes.length} prefixes`);
  }

  const table = {};
  for (const kind of ["campus", "cellular"]) {
    for (const family of ["v4", "v6"]) {
      const ranges = collected[kind]
        .map((cidr) => toRange(cidr, family))
        .filter((r) => r !== null);
      table[`${kind}_${family}`] = merge(ranges);
    }
  }

  // 🪤 Campus and cellular must not overlap, because classifyNetwork checks
  // campus first and an overlap would make the answer depend on that order
  // rather than on the data. Report it rather than silently preferring one.
  for (const family of ["v4", "v6"]) {
    for (const [start, end] of table[`campus_${family}`]) {
      for (const [cs, ce] of table[`cellular_${family}`]) {
        if (start <= ce && cs <= end) {
          console.warn(`⚠️  ${family} overlap: campus ${start}-${end} vs cellular ${cs}-${ce}`);
        }
      }
    }
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  const body = `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Regenerate with:  node scripts/build-network-table.mjs
// Consumed by:      lib/network-classify.ts
//
// Source: RIPE NCC's stat.ripe.net announced-prefixes data call, which reports
// what the global routing table actually carries. Fetched once, at generation
// time — the application never calls out at request time and no member's
// address ever leaves the server.
//
// GENERATED_AT is the only staleness signal there is. Nothing detects a stale
// table on its own, and a stale one fails toward flagging real attendees.
//
${provenance.map((line) => `//   ${line}`).join("\n")}

export const GENERATED_AT = ${JSON.stringify(generatedAt)};

export const SOURCE_ASNS = ${JSON.stringify(SOURCES.map((s) => "AS" + s.asn + " " + s.label), null, 2)} as const;

// Sorted, merged, disjoint, inclusive [start, end] pairs, flattened.
// Flat rather than nested so the whole table is one allocation and the binary
// search in lib/network-classify.ts indexes it directly.

export const CAMPUS_V4: readonly number[] = [${flat(table.campus_v4)}];

export const CELLULAR_V4: readonly number[] = [${flat(table.cellular_v4)}];

export const CAMPUS_V6: readonly bigint[] = [${flat(table.campus_v6, "n")}];

export const CELLULAR_V6: readonly bigint[] = [${flat(table.cellular_v6, "n")}];
`;

  await writeFile(OUT, body, "utf8");

  const count = (k, f) => table[`${k}_${f}`].length;
  console.log(
    `\nWrote ${OUT}\n` +
      `  campus    ${count("campus", "v4")} v4 ranges, ${count("campus", "v6")} v6\n` +
      `  cellular  ${count("cellular", "v4")} v4 ranges, ${count("cellular", "v6")} v6\n` +
      `  generated ${generatedAt}`
  );
}

main().catch((err) => {
  console.error(`build-network-table failed: ${err.message}`);
  process.exitCode = 1;
});
