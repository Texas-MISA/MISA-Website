"use server";

import { checkRateLimit } from "@/lib/checkin";
import {
  LOOKUP_RATE_LIMIT_MAX,
  lookupMemberHistory,
  type LookupResult,
} from "@/lib/lookup";
import { hashClientIp } from "@/lib/request-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupSchema } from "@/lib/validation";

// Member self-service (§7 Stage 7 phase 2). This wrapper owns everything
// request-shaped — honeypot, echo caps, validation, rate limiting — and
// delegates every decision to lib/lookup.ts, where the tested logic lives.
//
// 📌 THE ONE UNAUTHENTICATED **READ** PATH, and a single export, held to the
// same shape as app/actions/attendance.ts for the same §6 reason: "what can an
// anonymous user POST to" must stay a one-file, one-symbol answer. The two
// files are the whole list, and the difference between them is what each is
// allowed to do — attendance.ts writes, this one only reads.
//
// It writes exactly one row anywhere: the throttle record, inside
// checkRateLimit. Nothing else on this path touches the database.
//
// No role check, because there is no role. The gate is EID **and** matching
// email, enforced as a single query in lib/lookup.ts — see the header on
// findMemberByBoth for why it must never become an ordered fallback.

/**
 * The values the member typed, echoed back so the form can repopulate.
 *
 * React 19 resets an uncontrolled `<form action>` once the action resolves, so
 * without this a failed lookup would clear the two fields the member is trying
 * to correct. Every `defaultValue` on the form is driven from here.
 */
export type SubmittedValues = {
  eid: string;
  email: string;
};

export type LookupState = (
  | LookupResult
  | { status: "idle" }
  | { status: "rate_limited" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"eid" | "email", string[]>>;
    }
) & { submitted?: SubmittedValues };

/**
 * Cap echoed values at the schema's own maxima. On the invalid path there is no
 * `parsed.data` to echo, so these are raw form strings — and a hand-rolled POST
 * could otherwise have the server reflect a megabyte back into its own
 * response.
 */
const ECHO_LIMITS = { eid: 32, email: 254 } as const;

function echoField(value: FormDataEntryValue | null, max: number): string {
  // FormData.get can return a File; anything not a string echoes as empty.
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function lookupMember(
  _prev: LookupState,
  formData: FormData
): Promise<LookupState> {
  // Honeypot (§6): a hidden field no human sees. A bot that fills it gets the
  // same answer a genuine miss gets — no signal that it was detected, and no
  // query run. First, so nothing below it can be reached by one.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { status: "unmatched" };
  }

  const raw: SubmittedValues = {
    eid: echoField(formData.get("eid"), ECHO_LIMITS.eid),
    email: echoField(formData.get("email"), ECHO_LIMITS.email),
  };

  // "Look someone else up" from the result screen. Returns before touching the
  // database, so starting over costs nothing and spends no throttle slot.
  // Compared by equality, never `!== "look"` — a hand-rolled `step=reseet` must
  // fall through to the lookup rather than into an undefined third state.
  if (formData.get("step") === "reset") {
    return { status: "idle" };
  }

  const parsed = lookupSchema.safeParse({
    eid: formData.get("eid"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "eid");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "invalid", fieldErrors, submitted: raw };
  }

  const submitted: SubmittedValues = parsed.data;

  try {
    const db = createAdminClient();
    const now = new Date();

    // 🔓 Its own bucket, not a share of check-in's. RATE_LIMIT_MAX is a room
    // capacity, and a member checking their standing at a meeting must not
    // consume a slot the person behind them needs to check in with. Same table,
    // disjoint keys — see hashClientIp.
    const ipHash = await hashClientIp("lookup");
    const limited = await checkRateLimit(
      db,
      ipHash,
      now,
      LOOKUP_RATE_LIMIT_MAX
    );
    if (limited === "limited") {
      return { status: "rate_limited", submitted };
    }

    const result = await lookupMemberHistory(db, parsed.data, now);
    return { ...result, submitted };
  } catch (e) {
    console.error(
      "lookupMember failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error", submitted };
  }
}
