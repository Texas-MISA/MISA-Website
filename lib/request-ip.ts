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
  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${scope}:${ip}`).digest("hex");
}
