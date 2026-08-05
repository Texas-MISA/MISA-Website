# Dues & membership status — Venmo reconciliation

**Status:** **planned, unbuilt**, decided 2026-08-05. Nothing in this document
exists yet: no migration, no `lib/dues.ts`, no screens. It is the reference for
*why* Stage 6.5 is shaped the way it is; the normative summary lives in the
architecture doc (§4.1, §4.5, §4.7, §5, §6, §7 Stage 6.5, §9 #12, v1.34).

✅ **The one open question is closed.** The entire de-duplication design rested
on the Venmo statement CSV carrying a stable per-transaction `ID` column; a
real export was checked on **2026-08-05** and it is there. The fingerprint
fallback never has to be built — see the note at the end of the consequences
section for why that is worth being glad about.

One thing still to do at the top of phase 1: record the **exact header names
and the amount format** from that export in this document. The parser is
written against a real header, not a remembered one.

## Context

MISA is splitting attendees into **official** and **unofficial** members, and
the difference is whether they have paid dues. Until now this document set
treated "Paid Dues → Yes/No" as the canonical example of a phase-4 custom field:
a dropdown an officer ticks by hand, forty times, from a Venmo screen open in
another tab. That was the wrong mechanism, not merely a stale example. Dues
status is a *fact about payments*, and a fact about payments should be derived
from payments.

Venmo has no API, and its statement export has no year-to-date option. A
monthly CSV upload is therefore genuinely the best available input rather than
a shortcut, and the design has to take that seriously instead of apologising
for it. Two consequences follow immediately and drive everything below:

1. **Statements will be uploaded overlapping.** Monthly is not fresh enough —
   an officer wants the roster right on the day of an event, not on the first
   of the month — so the 10th and the 28th both get uploaded and both contain
   the first ten days. De-duplication is the *normal path*, not an edge case.
2. **The link between a payment and a member is member-supplied free text.**
   The payer writes their EID in the note. Sometimes they will write it wrong,
   write two, or write nothing at all.

**Outcome:** an officer uploads a statement and the directory is correct, with
the handful of rows the parser could not resolve sitting in a queue that says
so rather than silently vanishing.

## Decisions already taken

Settled with the officer on 2026-08-05. Do not re-litigate these while
implementing; raise them separately if they turn out to be wrong.

- **Official status gates nothing** (§9 #12). A column, a filter, and a line on
  the member's own `/lookup`. Check-in, points, and the leaderboard are
  untouched. Chosen as the reversible option — a gate is application logic over
  a column that already exists, and needs no migration.
- **The dedupe key is Venmo's transaction ID**, unique-indexed, spanning voided
  rows. Not a content fingerprint. See the trap below.
- **$50 covers the next two terms from the payment date**, not "the academic
  year". Pay in September → Fall + the following Spring. Pay in March → Spring
  + the following Fall. Uniform, and derivable from `term_of(paid_at)`.
- **Prices live in `app_settings`**, in cents, and are read at **import time
  only**. `terms_covered` is stored on the row, so raising dues never rewrites
  what last year's payments bought.
- **The payer's Venmo name and handle are stored.** Without them an unresolved
  row is an amount and a date and nothing an officer can act on. This is new
  PII and §6 carries a row for it.
- **The directory column is Paid / Not Paid for the current term.** One word.
  Coverage detail lives on the member detail page.
- **A payment note never creates a member**, and matching is exact-match only.
  Both carried over unchanged from check-in resolution (§4.2).

## The decision table

The dedupe check runs **first**, before parsing or matching, because a
transaction already stored is not reconsidered under any circumstances —
including one whose earlier import an officer has since corrected or voided.

| Amount | Note resolves to | Outcome |
|---|---|---|
| *any* — txn ID already stored | *not consulted* | **skipped as a duplicate**, counted in the import report, nothing written |
| one-term price | exactly one member | linked, `terms_covered = 1` |
| two-term price | exactly one member | linked, `terms_covered = 2` |
| anything else | exactly one member | linked, **`terms_covered` null** — stored, queued, an officer decides |
| *any* | no member | stored **unmatched**, queued with ranked suggestions, nothing preselected |
| *any* | two or more distinct members | stored, queued — the note is ambiguous and the parser does not break the tie |

Three properties to preserve:

- **Nothing that arrived as money is dropped on the floor** (§4.2, extended).
  Every row of the statement that is not a duplicate becomes a
  `dues_payments` row. There is no "unparseable, skip it" outcome.
- **An undecided row covers nothing.** `covered_terms` is generated from
  `terms_covered`, so null covers nothing and the member reads as Not Paid
  until an officer resolves it. The failure direction is *under*-reporting
  membership, which is visible in the queue, rather than over-reporting it,
  which is not visible anywhere.
- **Re-importing is always a no-op.** Any number of times, in any order.

### How the note is matched, and why there is no EID regex

Tokenize the note on whitespace and punctuation, apply the same fold
`members.normalized_eid` uses (`lower`, strip `\s` and `-`), and look for a
token that **is** some member's normalized EID. Exactly one distinct member
across all tokens → linked.

This deliberately avoids guessing at EID *shape*. The schema has never
constrained it — real EIDs run `rp8571`, `cag7284`, `mp8570` with no fixed
letter or digit count — and a regex that tried would either miss real EIDs or
match ordinary words. Matching against the roster instead is exact by
construction and needs no maintenance when UT changes its format.

**Exact match only.** Stage 5's "don't auto-resolve near-misses" carries over
intact: a note reading `rp8571 dues` for a roster that contains `rp8571` links;
a note reading `rp8517` does not, and goes to the queue. The queue *may* offer
ranked suggestions — reuse `scoreMemberCandidates` from `lib/attendance.ts`
rather than growing a second ranker — with nothing preselected.

## Implementation

### `lib/dues.ts`

Pure, like `lib/events.ts`, `lib/checkin.ts`, and `lib/attendance.ts`. No
`next/*` imports, no supabase-js, no clock reads — so Vitest drives it directly.

- `parseVenmoStatement(csv: string): ParsedStatement` — rows out, with the
  header mapping and the amount parsing (a Venmo amount arrives as `"+ $30.00"`
  or `"- $12.50"`; only positive incoming transfers are dues) in one place.
  **Cents, never floats.**
- `matchNote(note, roster): { memberId } | { ambiguous } | { none }` — the
  tokenize-and-fold above. Takes the roster, does not fetch it.
- `termsForAmount(cents, prices): 1 | 2 | null` — null is the "officer decides"
  answer, not an error.
- `nextTerm(term)` / `termsFrom(term, n)` — the TypeScript mirrors of the SQL
  functions in §4.7, and the **only** place term ordering is expressed.
  🪤 `'Fall 2026' < 'Spring 2026'` is true as a string compare and false as a
  calendar fact. No call site compares terms directly.

### Migration 19

Per §4.1: `dues_payments`, the two `app_settings` price columns, `next_term`
and `terms_from`, `dues_paid_current_term` appended to `member_directory`
(a `create or replace`, so grants survive — a `drop` would re-open the
migration-15 anon read), `'dues_payment'` added to `admin_audit.entity_type`,
and `dues`, `dues_paid`, `dues_paid_current_term` added to the reserved-key
check on `member_field_definitions`.

`RESERVED_FIELD_KEYS` in `lib/members.ts` gains the same keys in the same
commit — the SQL check and the TypeScript set are two halves of one rule and
have to move together.

**Reserving `dues` alone is not enough.** `dues_paid` is the name somebody
reaches for first, and it is literally the key phase 4's browser walkthrough
created. ✅ **That fixture was deleted from the local database on 2026-08-05**
— the definition row plus the held values on Amara Osei and Bela Kovacs, with
`shirt_size` left intact — so migration 19's CHECK has nothing left to trip
over.

Worth keeping the reason on record, because it generalises: archiving the
definition would **not** have worked around it. Migration 18's unique key index
spans archived rows on purpose, so an archived `dues_paid` is still a row the
CHECK would find. Any future migration that forbids a key has the same problem
with any archived definition holding it.

### `app/actions/dues.ts`

Every export opens with `getOfficer()` and returns `{status:"unauthorized"}`;
no `requireOfficer()`, because the house try/catch would swallow its
`NEXT_REDIRECT` (§5). No role check anywhere in the file, matching
`app/actions/members.ts` and §9 #6 — and say so in a comment, so it is not
re-added later as an oversight.

- `previewImport` — parses, checks which transaction IDs already exist,
  returns counts and rows. **Writes nothing.**
- `commitImport` — takes the same CSV text and **re-parses it server-side**.
  It does not accept the preview's output. Same posture as `/attend`'s
  `step=confirm`: a preview is a courtesy to the officer, never an input to the
  decision. Writes the rows under one `import_batch_id` plus one `admin_audit`
  receipt carrying the batch id, the file name, and the four counts.
- `assignPayment`, `setPaymentTerms`, `voidPayment` — the corrections.
  Compare-and-set on `updated_at`, carried as the **raw PostgREST string**
  (a `Date` round trip truncates the microseconds and every save then reports a
  phantom conflict). `voidPayment` is one-way and requires a reason.

### `/admin/dues/import`

Two steps, with the CSV text held **in the browser** between them:

1. A client component reads the file with `FileReader` and posts the text to
   `previewImport`. Renders the four buckets.
2. The same component posts the same text to `commitImport`.

No staging table and no base64 round trip through a hidden field. The text sits
in client memory for the duration of one screen, which is fine at
monthly-statement size and means there is no server-side copy of the org's
payment history to leak or forget about (§6).

**The upload is a Server Action, not a Route Handler.** A Server Action accepts
a `File` in `FormData`; the Route Handler rule in this codebase exists because
*downloads* need `Content-Disposition`, which is the opposite direction.

### `/admin/dues` and `/admin/dues/[id]`

Modelled on `/admin/points` and `/admin/points/[id]`. Filters: state (needs
review / live / voided), term, member, date range. Date ranges are
**Central-anchored and half-open** like every other date filter in this
codebase. The needs-review count is the number an officer acts on, so it
belongs in the header rather than behind a filter.

The detail page reassigns the member, corrects `start_term` and
`terms_covered`, voids with a reason, and renders the shared `AuditTrail`.
Both sides of every audit before/after select the **same column list** — a
narrower select on the update invents changes that never happened.

### `/admin/members` and `/admin/members/[id]`

`MemberFilter` gains `dues: "paid" | "unpaid" | "all"`, shaped exactly like the
existing `state` selector, translated in `applyMemberFilter` and nowhere else
(§4.5's one-filter-one-translation rule). `dues` joins `MEMBER_SORTS`. The
column renders **Paid / Not Paid**.

The detail page reads that member's `dues_payments` rows directly and shows
what they are paid through — ordered by `termsFrom` semantics, never by a
string compare.

## Consequences to accept, and say out loud

- **A payer who writes someone else's EID credits the wrong person, silently.**
  This is §7 Stage 6's "valid-but-wrong EID" failure arriving through a second
  door, and it is *worse* here: an attendance mis-credit is visible to the
  member on `/lookup` as an event they did not attend, whereas a dues
  mis-credit shows the victim as unpaid and the beneficiary as paid, and
  neither has an obvious reason to check. Partial mitigation: the payer's
  Venmo name is stored, so a "does this name resemble this member" mismatch is
  at least *available* to flag on the detail page. Not built in 6.5; recorded
  here so it is not discovered as a surprise.
- **A payer who writes no EID is invisible until an officer reconciles by
  name.** The row is queued, so nothing is lost, but resolving it means
  recognising a Venmo display name — which is exactly the manual work this
  stage exists to remove, for the subset of payments that defeat the parser.
  Expect this to be the residual workload, and tell members to put their EID
  in the note.
- **A summer payment lands in Spring**, because §4.7 puts May–July there. Pay
  $30 in July intending to cover the coming Fall and it buys a term with three
  weeks left. The import preview flags May–July payments and the officer
  overrides `start_term`; the rule is not changed, because changing it would
  make `term_of` disagree with itself between events and payments.
- **Voiding a payment makes a member unofficial retroactively.** Correct — the
  status is a live derivation, not a stored flag — and it will surprise
  someone, which is why the void requires a reason and writes an audit row.
- **The system now holds financial information**, which §6's threat-model
  boundary previously said it did not. Narrower claim, still true: no
  credential, card, or bank detail enters it and it cannot move money. But a
  `dues_payments` dump is worse than a roster dump, and Stage 8 should weight
  it that way.

### The fallback that is not needed, recorded so nobody reinvents it

Had the statement carried no transaction ID, the fallback would have been a
fingerprint over `(datetime, amount, payer handle, note)`. It works for the
ordinary case and it is **wrong in a way that loses data**: two members sending
the same amount in the same minute with the same note (`"dues"`) collapse into
one row, and the second member is unpaid with no trace of their payment
anywhere in the system.

The export was checked on 2026-08-05 and the ID is there, so none of that has
to be built. It is written down anyway for one reason: if Venmo ever changes
the export format, the temptation will be to reach for the fingerprint as an
obvious substitute. It is not one, and the property it silently gives up is the
one this whole design exists to protect.

## Docs that must change **in the same commit as the code**

Not optional — the code would otherwise contradict a written invariant, which
is exactly the drift the working agreements exist to prevent. Most of this was
done **ahead** of the code, in v1.34, so the obligation at build time is to
correct what building it teaches rather than to write it from scratch.

- **`docs/student-org-website-architecture.md`** — §4.1's `dues_payments` DDL
  must match migration 19 exactly (the migration is the authority; the doc is
  the readable version, and a drift between them is the failure mode §2.3
  cares about). §4.5's view SQL likewise. Version bump.
- **`CLAUDE.md`** — the Stage 6.5 invariants are written and unbuilt; correct
  them against what the code actually does, and move the repository-status
  paragraph off "planned".
- **`tasks.md`** — check the phase boxes, record the walkthrough, and add
  whatever the build teaches to the traps list. Every Stage 6 phase so far has
  produced at least one; assume this one will too.
- **This document** — flip the status line, and record any decision that had to
  change while building it, as `attend-confirmation-flow.md` does for
  `RATE_LIMIT_MAX`.

## Verification

1. **Unit** (`tests/dues.test.ts`) — every row of the decision table, plus the
   term arithmetic across a year boundary (`Fall 2026` + 2 = `Fall 2026,
   Spring 2027`) and the lexicographic trap (`Fall 2026` is *later* than
   `Spring 2026`).
2. **The overlapping-statement case, and treat it as the headline test.**
   Import a statement, import a second one covering an overlapping range, and
   assert the row count rose by exactly the number of genuinely new
   transactions. This is the normal path, a demo will not exercise it, and its
   failure mode is silently double-counting somebody's dues.
3. Import the *same* statement twice — zero new rows, and the report says so.
4. Re-import a statement containing a payment an officer has since **voided** —
   still zero new rows. The unique index spans voided rows for this reason.
5. **Integration** — a payment with an unresolvable note writes a row with
   `member_id` null and creates **no member**. Count `members` before and
   after; a test that only checks the returned status would pass while the
   roster quietly grew.
6. An amount matching neither price writes a row with `terms_covered` null, and
   that member reads **Not Paid** until an officer sets it.
7. `dues_paid_current_term` flips when a payment is assigned, and flips back
   when it is voided.
8. **Security** — `tests/security.test.ts` already enumerates every view and
   allows only `leaderboard`; confirm it still passes after the
   `create or replace`, which is the cheap check that the grants survived.
   Confirm anon cannot select from `dues_payments`.
9. A `member_field_definitions` row keyed `dues` is rejected by the database,
   not merely by the zod schema.
10. **Browser walkthrough on the local stack** — every Stage 6 phase but one
    has found something no test could. Upload a hand-built statement with one
    of each decision-table row in it and drive the whole loop: preview, commit,
    resolve a queued row, watch the directory column change.
