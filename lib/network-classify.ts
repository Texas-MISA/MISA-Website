import {
  CAMPUS_V4,
  CAMPUS_V6,
  CELLULAR_V4,
  CELLULAR_V6,
  GENERATED_AT,
} from "@/lib/network-prefixes.generated";

// What KIND of connection a check-in arrived on, and the canonical form of an
// address for hashing. Half of check-in location verification (§6); the plan
// and the threat model are in docs/checkin-location-verification.md.
//
// 📌 Deliberately free of `node:*`, next/* and every dependency. Pure string
// and integer arithmetic over a committed table, so it is testable against
// constructed addresses and carries no request-time cost beyond a couple of
// binary searches.
//
// ⚠️ NOTHING HERE EVER STORES OR LOGS AN ADDRESS. Callers pass one in and get
// back a four-value label and a digest input. The address itself must stay a
// local in the calling function — see lib/checkin-origin.ts.

/**
 * The date the committed prefix table was generated.
 *
 * 🪤 The ONLY staleness signal that exists. Nothing detects a stale table on
 * its own, and staleness fails toward flagging real attendees: a carrier whose
 * new block is missing reads `other`, and `other` is the one label that gets
 * flagged. Re-run `node scripts/build-network-table.mjs` when that happens.
 */
export const NETWORK_TABLE_VERIFIED = GENERATED_AT;

/**
 * `campus`   — inside UT Austin's announced address space.
 * `cellular` — inside a US mobile carrier's. NEVER flagged: a member on
 *              cellular has not been shown to be absent (officer's decision,
 *              2026-08-22).
 * `other`    — parsed, and confidently outside both.
 * `unknown`  — no address, an unparseable one, or a family this table cannot
 *              speak to. See the note on `classifyNetwork`.
 */
export type NetworkKind = "campus" | "cellular" | "other" | "unknown";

/**
 * One check-in's stored origin, as written to and read back from
 * `checkin_origin`.
 *
 * 🪤 Defined HERE rather than beside the code that builds it, because
 * lib/checkin.ts needs the type and lib/checkin.ts must stay importable from a
 * Client Component — it exports ORPHAN_WINDOW_HOURS to the check-in form. The
 * builder lives in lib/checkin-origin.ts, which imports `node:crypto` and
 * therefore cannot be reached from that direction. This module is
 * dependency-free precisely so a shared type never becomes a shared import of
 * something heavier.
 */
export type OriginRecord = {
  /** null for a pending orphan (no event_id to hash with) or an unknown kind. */
  originHash: string | null;
  networkType: NetworkKind;
};

// --- Parsing ---------------------------------------------------------------

/**
 * Strict dotted-quad. Rejects leading zeros deliberately: `010` is read as
 * octal by some resolvers and as decimal by others, so an address carrying one
 * has no single meaning and must not be given one here.
 */
function parseV4(text: string): number | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const byte = Number(part);
    if (byte > 255) return null;
    n = n * 256 + byte;
  }
  return n;
}

function parseV6(text: string): bigint | null {
  let body = text;

  // A trailing dotted quad is legal in ANY IPv6 literal, not only in the
  // ::ffff: form — 2001:db8::192.0.2.1 is a valid address. Rewrite it to two
  // hex groups before the general parse rather than special-casing ::ffff:
  // later, which would leave the general form unparseable.
  const lastColon = body.lastIndexOf(":");
  if (lastColon !== -1 && body.slice(lastColon + 1).includes(".")) {
    const embedded = parseV4(body.slice(lastColon + 1));
    if (embedded === null) return null;
    const hi = ((embedded >>> 16) & 0xffff).toString(16);
    const lo = (embedded & 0xffff).toString(16);
    body = `${body.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = body.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups: string[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill("0"), ...tail];
  }

  let n = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    n = (n << 16n) | BigInt(parseInt(group, 16));
  }
  return n;
}

type ParsedAddress =
  | { family: "v4"; value: number }
  | { family: "v6"; value: bigint };

/**
 * Parse whatever the platform handed us, or null.
 *
 * 🪤 Strips surrounding brackets. A proxy may present IPv6 as `[2001:db8::1]`,
 * and an unbracketed comparison would fail to parse it — which would classify
 * a real attendee as `unknown` rather than reading their network.
 */
function parseAddress(raw: string | null | undefined): ParsedAddress | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  if (text.length === 0) return null;
  if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1);

  if (text.includes(":")) {
    const v6 = parseV6(text);
    if (v6 === null) return null;

    // 🪤 An IPv4-mapped address is an IPv4 client reaching a dual-stack
    // listener, and it MUST fold to the v4 form — otherwise the same phone
    // reads as two different origins depending on which socket answered, and
    // quietly falls out of the venue mode it belongs to.
    //
    // Detected on the PARSED VALUE (top 96 bits are `0…0ffff`), not by matching
    // the text. An earlier version tested `/^::ffff:…/` and so caught only the
    // canonical spelling: the equally valid uncompressed
    // `0:0:0:0:0:ffff:128.83.140.7` fell through to the IPv6 branch, landed in
    // an empty CAMPUS_V6, and produced a v6 digest for a v4 client. Structure
    // covers every spelling; a regex covers the one you thought of.
    if (v6 >> 32n === 0xffffn) {
      return { family: "v4", value: Number(v6 & 0xffffffffn) };
    }
    return { family: "v6", value: v6 };
  }

  const v4 = parseV4(text);
  return v4 === null ? null : { family: "v4", value: v4 };
}

// --- Table lookup ----------------------------------------------------------
//
// The generated tables are sorted, merged and disjoint, flattened to
// [start, end, start, end, …] inclusive. Written twice rather than once
// generically because a type parameter over `number | bigint` cannot be
// compared with `<` — and the duplication is ten lines against a cast.

function inRangesV4(value: number, flat: readonly number[]): boolean {
  let lo = 0;
  let hi = flat.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (value < flat[mid * 2]) hi = mid - 1;
    else if (value > flat[mid * 2 + 1]) lo = mid + 1;
    else return true;
  }
  return false;
}

function inRangesV6(value: bigint, flat: readonly bigint[]): boolean {
  let lo = 0;
  let hi = flat.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (value < flat[mid * 2]) hi = mid - 1;
    else if (value > flat[mid * 2 + 1]) lo = mid + 1;
    else return true;
  }
  return false;
}

// --- The two exports that matter -------------------------------------------

/**
 * What kind of network an address belongs to.
 *
 * 🔓 THE RULE THAT KEEPS THIS HONEST: `other` is only returned when matching
 * nothing actually MEANS something. `other` is the sole label the review screen
 * flags, so returning it is an assertion that the address is confidently not
 * the university's — and that assertion is only available when the campus table
 * for that address family has entries to have missed.
 *
 * ⚠️ Today it does not, for IPv6. UT Austin's AS18 announces eight IPv4
 * prefixes and **zero IPv6 prefixes**, so the generated CAMPUS_V6 table is
 * empty. A student on campus wifi over IPv6 would match no campus range — not
 * because they are off campus, but because there is nothing to match against.
 * Calling that `other` would flag a member sitting in the room, which is the
 * single failure this feature is least allowed to have. So an address whose
 * family has no campus data at all returns `unknown`, which is never flagged
 * and carries no digest.
 *
 * 📌 This is self-correcting rather than a permanent carve-out: the moment
 * CAMPUS_V6 has entries, IPv6 starts classifying normally. If UT's IPv6 space
 * is found (it is announced by an upstream rather than by AS18, if at all), add
 * the ASN to scripts/build-network-table.mjs and re-run.
 *
 * 🪤 Cellular is still matched over IPv6, because CELLULAR_V6 is populated —
 * and it is checked before the empty-table rule, so a phone on IPv6 is
 * correctly exempted rather than swallowed by `unknown`.
 */
export function classifyNetwork(raw: string | null | undefined): NetworkKind {
  const parsed = parseAddress(raw);
  if (parsed === null) return "unknown";

  if (parsed.family === "v4") {
    if (inRangesV4(parsed.value, CAMPUS_V4)) return "campus";
    if (inRangesV4(parsed.value, CELLULAR_V4)) return "cellular";
    return CAMPUS_V4.length === 0 ? "unknown" : "other";
  }

  if (inRangesV6(parsed.value, CAMPUS_V6)) return "campus";
  if (inRangesV6(parsed.value, CELLULAR_V6)) return "cellular";
  return CAMPUS_V6.length === 0 ? "unknown" : "other";
}

/**
 * The canonical string an address contributes to an origin digest, or null if
 * there is nothing hashable.
 *
 * Two jobs, both load-bearing:
 *
 * 🪤 **It re-renders rather than passing the input through.** The same client
 * can present as `1.2.3.4` or `::ffff:1.2.3.4` depending on which socket
 * answered; hashing the raw text would give one person two origins and quietly
 * break the mode they should have been part of.
 *
 * **It folds IPv6 to its /64.** The low bits of an IPv6 address rotate — SLAAC
 * privacy extensions change them on a timer — so without this the mode never
 * forms for anyone on IPv6: every submission from one device looks like a new
 * origin. /64 is the smallest unit that is stable per link.
 *
 * The `v4:` / `v6:` tag prevents a v4 dotted quad and a v6 group string from
 * ever colliding into the same digest.
 */
export function normalizeOrigin(raw: string | null | undefined): string | null {
  const parsed = parseAddress(raw);
  if (parsed === null) return null;

  if (parsed.family === "v4") {
    const n = parsed.value;
    return `v4:${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
  }

  const prefix = parsed.value >> 64n;
  const groups: string[] = [];
  for (let shift = 48n; shift >= 0n; shift -= 16n) {
    groups.push(((prefix >> shift) & 0xffffn).toString(16));
  }
  return `v6:${groups.join(":")}`;
}
