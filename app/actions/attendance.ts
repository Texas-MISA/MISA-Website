"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { checkRateLimit, resolveCheckin, type CheckinResult } from "@/lib/checkin";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkinSchema } from "@/lib/validation";

// The public check-in write path (§3, §4.2, §4.3). This wrapper owns
// everything request-shaped — honeypot, validation, rate limiting — and
// delegates resolution to lib/checkin.ts, which is where the tested logic
// lives. The service-role client exists only here and in lib/supabase/admin.

export type CheckinState =
  | CheckinResult
  | { status: "idle" }
  | { status: "rate_limited" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"fullName" | "studentId" | "email", string[]>>;
    };

export async function submitCheckin(
  _prev: CheckinState,
  formData: FormData
): Promise<CheckinState> {
  // Honeypot (§6): a hidden field no human sees. Bots that fill it get the
  // same response a legitimate off-window submission gets — no signal that
  // they were detected, and nothing is written.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { status: "pending" };
  }

  const parsed = checkinSchema.safeParse({
    fullName: formData.get("fullName"),
    studentId: formData.get("studentId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "fullName");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "invalid", fieldErrors };
  }

  try {
    const db = createAdminClient();
    const now = new Date();

    // Per-IP limit (§6). Hashed, never stored raw; x-forwarded-for's first
    // entry is the client on Vercel. Absent header (local dev) buckets under
    // one shared key, which only matters for testing the limiter itself.
    const forwarded = (await headers()).get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex");
    if ((await checkRateLimit(db, ipHash, now)) === "limited") {
      return { status: "rate_limited" };
    }

    return await resolveCheckin(db, parsed.data, now);
  } catch (e) {
    console.error("submitCheckin failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }
}
