import { createHash } from "node:crypto";

import { headers } from "next/headers";

// How the two unauthenticated endpoints identify a caller for rate limiting
// (§6). Extracted from app/actions/attendance.ts in Stage 7 phase 2, when
// /lookup became the second one — a copied three-line IP derivation is two
// things that can drift about what "the client" means.
//
// ⚠️ Imports next/headers, so this module must NEVER be imported by
// lib/checkin.ts. That file is deliberately free of next/* imports because
// app/(public)/attend/_components/checkin-form.tsx (a Client Component) imports
// ORPHAN_WINDOW_HOURS from it.

/**
 * A stable, scoped hash of the requesting client's IP.
 *
 * IPs are hashed, never stored raw (migration 11's header). On Vercel the
 * client is the first entry of `x-forwarded-for`; a missing header (local dev)
 * buckets everyone under one shared key, which only matters when testing the
 * limiter itself.
 *
 * 🔓 `scope` namespaces the bucket, and the separation is load-bearing rather
 * than tidy. `checkin_throttle` is keyed on this hash alone, so two scopes
 * sharing an IP would share a budget — and `RATE_LIMIT_MAX` is sized as a ROOM
 * CAPACITY (a venue's NAT puts a whole meeting behind one address), not as a
 * security number. A member checking their standing must not consume a slot the
 * person behind them needs to check in with. Different scope, different bucket,
 * one table.
 *
 * ⚠️ Changing a scope string invalidates every live bucket under it. That is a
 * ten-minute window, so it is harmless — but it is why the strings are literals
 * at the call sites rather than derived from anything that might move.
 */
export async function hashClientIp(scope: string): Promise<string> {
  const ip = (await clientIp()) ?? "unknown";
  return createHash("sha256").update(`${scope}:${ip}`).digest("hex");
}

/**
 * The requesting client's public IP, or null when the platform did not supply
 * one (local dev, and any request that did not come through Vercel's edge).
 *
 * 🔓 THIS MODULE'S ENTIRE SURFACE USED TO BE "you cannot get the address out of
 * me", and this export deliberately widens it. Added for check-in location
 * verification (§6), which has to classify the address's network before it can
 * hash it — see docs/checkin-location-verification.md. Justified only because
 * both consumers sit inside one call and neither persists what they are given:
 * the address is classified, it is hashed, and it is discarded. **A third
 * caller is a design review, not a refactor.**
 *
 * ⚠️ Never store, log or return this value. `checkin_origin` holds a peppered
 * digest and a four-value label, and nothing anywhere holds an address.
 *
 * 📌 `x-vercel-forwarded-for` first. It carries the identical value to
 * `x-forwarded-for`, but it is the one a reverse proxy placed IN FRONT of
 * Vercel could not overwrite. Nothing about this deployment needs the
 * distinction today; it costs a `??` and removes a way to be wrong later.
 *
 * 🔓 The spoofing question this feature blocked on is settled: Vercel
 * "overwrite[s] the X-Forwarded-For header and do[es] not forward external
 * IPs… to prevent IP spoofing", and supplying your own needs the Enterprise
 * Trusted Proxy add-on. So a hand-rolled `curl -H 'X-Forwarded-For: …'` cannot
 * move this. ⚠️ That makes the HEADER unforgeable — it does not make the check
 * unevadable. Joining the venue's wifi defeats it completely.
 */
export async function clientIp(): Promise<string | null> {
  const store = await headers();
  const forwarded =
    store.get("x-vercel-forwarded-for") ?? store.get("x-forwarded-for");
  // The client is the FIRST entry; anything after it is proxy chain.
  return forwarded?.split(",")[0]?.trim() || null;
}
