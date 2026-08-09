"use server";

import { checkRateLimit, resolveCheckin, type CheckinResult } from "@/lib/checkin";
import { hashClientIp } from "@/lib/request-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkinSchema } from "@/lib/validation";

// The public check-in write path (§3, §4.2, §4.3). This wrapper owns
// everything request-shaped — honeypot, validation, rate limiting — and
// delegates resolution to lib/checkin.ts, which is where the tested logic
// lives. The service-role client exists only here and in lib/supabase/admin.
//
// 📌 THE ONE UNAUTHENTICATED **WRITE** PATH, and a single export so that "what
// can an anonymous user POST to" stays a one-file, one-symbol answer (§6).
// Stage 7 added app/actions/lookup.ts as the one unauthenticated **read** path,
// held to the same shape for the same reason. Two files, two symbols, and the
// distinction between them is what each is allowed to do.

/**
 * The values the member typed, echoed back so the form can repopulate.
 *
 * React 19 resets an uncontrolled `<form action>` once the action resolves, so
 * without this the re-prompt would clear the fields someone is trying to
 * correct — the worst possible moment to lose them. Every `defaultValue` on
 * the form is driven from here.
 */
export type SubmittedValues = {
  fullName: string;
  eid: string;
  email: string;
  declaredNew: boolean;
};

export type CheckinState = (
  | CheckinResult
  | { status: "idle" }
  | { status: "rate_limited" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"fullName" | "eid" | "email", string[]>>;
    }
) & { submitted?: SubmittedValues };

/**
 * Cap echoed values at the schema's own maxima. On the invalid path there is
 * no `parsed.data` to echo, so these are raw form strings — and a hand-rolled
 * POST could otherwise have the server reflect a megabyte back into its own
 * response.
 */
const ECHO_LIMITS = { fullName: 120, eid: 32, email: 254 } as const;

function echoField(value: FormDataEntryValue | null, max: number): string {
  // FormData.get can return a File; anything not a string echoes as empty.
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function submitCheckin(
  _prev: CheckinState,
  formData: FormData
): Promise<CheckinState> {
  // Honeypot (§6): a hidden field no human sees. Bots that fill it get the
  // same response a legitimate off-window submission gets — no signal that
  // they were detected, and nothing is written. First, so it covers the
  // confirm step too.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { status: "pending" };
  }

  // §6 keeps this module a single export, so the step travels in the payload
  // rather than in a sibling action: "what can an anonymous user POST to" has
  // to stay a one-file, one-symbol answer.
  //
  // Compared by equality, never `!== "submit"` — a hand-rolled `step=confirmm`
  // must fall to the first pass rather than into an undefined fourth state.
  const step = formData.get("step");
  // An unchecked checkbox sends nothing at all, so presence is the signal.
  // Not a zod field: checkinSchema's parse output is asserted verbatim in the
  // tests, and a presence check is not something zod improves.
  const firstTime = formData.get("firstTime");
  const declaredNew = typeof firstTime === "string" && firstTime.length > 0;
  const raw: SubmittedValues = {
    fullName: echoField(formData.get("fullName"), ECHO_LIMITS.fullName),
    eid: echoField(formData.get("eid"), ECHO_LIMITS.eid),
    email: echoField(formData.get("email"), ECHO_LIMITS.email),
    declaredNew,
  };

  // "Go back and fix it" from the review screen. Returns before touching the
  // database, so backing out costs nothing and spends no throttle slot.
  if (step === "edit") {
    return { status: "idle", submitted: raw };
  }

  const parsed = checkinSchema.safeParse({
    fullName: formData.get("fullName"),
    eid: formData.get("eid"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "fullName");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "invalid", fieldErrors, submitted: raw };
  }

  // Past validation, echo the trimmed values — the review screen has to show
  // exactly what will be written, not what was typed around it.
  const submitted: SubmittedValues = { ...parsed.data, declaredNew };

  try {
    const db = createAdminClient();
    const now = new Date();

    // Per-IP limit (§6), in the "checkin" bucket — /lookup has its own, so a
    // member checking their standing cannot eat a slot the next person needs
    // to check in with (RATE_LIMIT_MAX is a room capacity).
    //
    // The confirm step pays a slot like any other submission. Exempting it
    // would make the second pass an unthrottled membership probe, and it is
    // the pass that writes.
    const ipHash = await hashClientIp("checkin");
    if ((await checkRateLimit(db, ipHash, now)) === "limited") {
      return { status: "rate_limited", submitted };
    }

    // The confirm step re-derives everything from scratch — event window,
    // member lookup, duplicate checks — and never trusts that the payload
    // matches what was previewed.
    const result = await resolveCheckin(
      db,
      { ...parsed.data, declaredNew, confirmed: step === "confirm" },
      now
    );
    return { ...result, submitted };
  } catch (e) {
    console.error("submitCheckin failed:", e instanceof Error ? e.message : String(e));
    return { status: "error", submitted };
  }
}
