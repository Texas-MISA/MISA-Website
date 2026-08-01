# `/attend` — first-time checkbox and conditional confirmation

**Status:** **built** 2026-07-31, same day it was decided. This document remains
the reference for *why*; `lib/checkin.ts`, `app/actions/attendance.ts`, and
`app/(public)/attend/_components/checkin-form.tsx` are the implementation, and
`tests/checkin.test.ts` covers every row of the decision table below. The
normative summary now lives in the architecture doc (§4.2, §4.3, §6, v1.22).

One deliberate departure from the plan as written, decided while building:
**`RATE_LIMIT_MAX` rose from 30 to 90.** Verification item 5 requires the confirm
step to be throttled like any other submission, so a first-timer spends two slots
and the re-prompt invites retries — at a recruiting event behind one venue NAT the
old number would have admitted barely fifteen people. Raising the ceiling was the
only lever that did not weaken the property.

## Context

Check-in resolves a member by exact match only: `normalized_student_id`, then
`lower(email)`, then it **creates a new member**. Someone who mistypes *both*
fields is therefore indistinguishable from a genuinely new person — they are
literally the same insert — so typos quietly pollute the roster, and the
duplicates have no merge tool (recorded under Stage 6 in `tasks.md`).

This adds the one bit of information the system cannot derive: the member says
whether they are new. The system then only has to guess in the case where the
member's claim and the roster disagree, and it stops guessing on its own.

**Outcome:** a returning member's check-in is as fast as it is today; a typo is
caught at the door while the person is still standing there; a new member sees
their details before they become a roster row.

## Decisions already taken

Settled with the officer on 2026-07-31. Do not re-litigate these while
implementing; raise them separately if they turn out to be wrong.

- **The membership oracle is accepted.** The screen says "we don't have that
  info on file", which lets anyone probe a student ID for roster membership.
  Deliberate: the roster is a club list rather than a security boundary, and UT
  student IDs are semi-public. Recorded *as a decision* because §6 took the
  opposite stance for the officer login on purpose (one identical failure for
  "wrong password" and "no such user"), and the two will otherwise look
  inconsistent to whoever reads them next.
- **An unmatched submission is never written, however many times it fails.** No
  two-strikes fallback. If someone keeps mistyping, they do not get attendance.
- **An unconfirmed first-timer is never written.** Closing the tab at the review
  screen means it did not happen.
- **Failed lookups are not logged.** The existing per-IP `checkin_throttle`
  is the only abuse control. (It was 30 per 10 minutes when this was written;
  building it raised the ceiling to 90 — see the status note above.)

## The decision table

Event resolution is untouched and runs first: `open_event_at()`, else
`nearby_events()` within `ORPHAN_WINDOW_HOURS`, else **refused** with nothing
written. Everything below concerns the member half.

| Member lookup | First-time box | Written? | Screen |
|---|---|---|---|
| Matched by `normalized_student_id` | unchecked | **yes, immediately** | Success |
| Matched by `lower(email)` | unchecked | **yes, immediately** | Success |
| No match | unchecked | **nothing** | "We don't have that info on file" + re-prompt |
| Matched (either key) | checked | not yet | Review → on confirm, **link** the existing member (never create a second) |
| No match | checked | not yet | Review → on confirm, **create** the member + write attendance |

Two properties to preserve:

- **The checkbox is a hint, not an instruction.** Ticking it when you already
  exist links you to yourself. It must never create a duplicate.
- **The fast path stays fast.** The overwhelmingly common case — returning
  member, box unchecked, ID matches — is one submit and one screen, exactly as
  today. No new step is added for it.

## Implementation

### `lib/checkin.ts`

`resolveCheckin` currently resolves-and-creates in one pass. Split the lookup
from the write:

- Add `declaredNew: boolean` and `confirmed: boolean` inputs.
- Member **lookup only** — `findMember` already exists and does exactly this;
  the create moves out of `resolveMember` and behind the confirm step.
- Two new result states, both writing nothing: `unmatched` and
  `needs_confirmation` (the latter carries the values to echo back).
- `declaredNew === true` always returns `needs_confirmation` on the first pass,
  matched or not. The second pass with `confirmed === true` performs the write,
  creating the member only if the lookup still finds nothing.

### `app/actions/attendance.ts`

**Keep it a single export.** §6's property is that "what can an anonymous user
POST to" has a one-file, one-symbol answer; `submitCheckin` takes a `step`
field rather than gaining a sibling export.

The confirm step **re-runs everything** — honeypot, zod, rate limit, event
resolution, member lookup. It must never trust that the confirm payload matches
what was previewed; the previewed values are echoed as hidden inputs and the
server re-derives the outcome from scratch.

**No migration.** Nothing is persisted between steps, which is the main
simplification this design buys over a write-then-edit-token approach.

### `/attend`

Two new states on the existing `useActionState` machine (`unmatched`,
`needs_confirmation`) alongside present / pending / duplicate / refused /
invalid / rate-limited / error. Must keep working pre-hydration, so the steps
are action state, not client-side routing.

⚠️ **React 19 resets an uncontrolled `<form action>` when the action resolves.**
Both new screens re-render the form with server state, so the action must echo
the submitted values back and every `defaultValue` must be driven from them —
otherwise the re-prompt clears the fields the member is trying to correct, which
is the worst possible moment to lose them.

## Consequences to accept, and say out loud

- **A member who cannot get their details right gets no attendance and leaves no
  trace.** No row, no queue entry, nothing for an officer to find later.
  - *Operational mitigation, worth telling officers:* Stage 5 phase 3 shipped
    manual entry at `/admin/attendance/new`. Someone stuck at the door is added
    by an officer in a few seconds. That is now the recovery path, and it only
    works if officers know it exists.
- **A window that closes mid-correction changes the outcome.** Because nothing
  is written until success, the event is resolved at the moment of the *final*
  submit — so a member correcting a typo across a window boundary can land as an
  orphan, or be refused. Acceptable, but a deliberate note rather than a
  surprise.

## Docs that must change **in the same commit as the code**

Not optional — the code would otherwise contradict a written invariant, which is
exactly the drift the working agreements exist to prevent.

- **`CLAUDE.md` — "Nothing is ever dropped on the floor."** It currently reads
  that a check-in matching no open event *and/or no roster member* is still
  stored as `pending`, which is an accurate description of today's code. After
  this change it is true only for submissions resolving to a **known member**.
  The sub-bullet already under that invariant records the decision and says
  "amend in the same commit as `lib/checkin.ts`" — do that, and delete the
  sub-bullet once the wording is corrected.
- **`docs/student-org-website-architecture.md`** — §4.2/§4.3 resolution order,
  the accepted membership oracle recorded against §6, version header to **v1.22**.
- **`tasks.md`** — the Stage 6 duplicate-members note gets smaller in
  expectation, since the checkbox removes the main source of ghosts. It does not
  go away: someone can still tick "first time" and typo.

## Verification

1. **Unit** (`tests/checkin.test.ts`) — all five rows of the decision table.
2. **Integration** — the assertion that matters most: an unmatched submission
   writes **zero** rows. Count `attendance` and `members` before and after and
   assert both unchanged; a test that only checks the returned status would pass
   while the roster quietly grew.
3. Checkbox + existing member → links, and the `members` count is unchanged.
4. Checkbox + typo → review shows the typed values; confirming creates a member
   with exactly those values.
5. Rate limit applies to the **confirm** step too, or it is an unthrottled probe.
6. Honeypot survives both steps.
7. Browser walkthrough on the local stack, phone viewport — the fast path is
   still one submit, and the re-prompt keeps the member's typed values on screen.

**Scope note:** the wrong-ID mis-credit (typing into another member's real ID)
is *not* addressed here and gets slightly more likely, since a confident typo
that happens to match a real ID now sails through as a matched member. It stays
recorded against Stage 6.
