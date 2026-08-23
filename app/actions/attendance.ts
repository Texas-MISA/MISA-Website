"use server";

import { checkRateLimit, resolveCheckin, type CheckinResult } from "@/lib/checkin";
import { buildOriginRecord } from "@/lib/checkin-origin";
import { clientIp, hashClientIp } from "@/lib/request-ip";
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

    // Check-in location verification (§6). The address is read HERE, classified
    // and hashed inside the closure, and discarded when this call returns — it
    // is never stored, logged or echoed. What lands in the database is a
    // peppered, event-scoped digest and a four-value network label.
    //
    // 🔓 Capture runs on EVERY check-in, regardless of the event's
    // verify_origin flag. That flag gates DERIVATION on the officer's review
    // screen, not collection, and the asymmetry is deliberate: it is what lets
    // an officer turn verification on a week after an event and have the flags
    // appear with no backfill. It is also why /attend discloses this.
    //
    // 🪤 A missing address yields an `unknown` kind and NO digest — never a
    // hash of some placeholder string. In local dev nobody has the header, so a
    // shared literal would give every check-in one digest and form a confident,
    // entirely fictional venue mode.
    const ip = await clientIp();
    const makeOrigin = (eventId: string | null) => buildOriginRecord(eventId, ip);

    // The confirm step re-derives everything from scratch — event window,
    // member lookup, duplicate checks — and never trusts that the payload
    // matches what was previewed.
    const result = await resolveCheckin(
      db,
      { ...parsed.data, declaredNew, confirmed: step === "confirm" },
      now,
      makeOrigin
    );
    return { ...result, submitted };
  } catch (e) {
    console.error("submitCheckin failed:", e instanceof Error ? e.message : String(e));
    return { status: "error", submitted };
  }
}
