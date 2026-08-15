# Dues & membership status — Venmo reconciliation

📋 **One planned addition, not built:** a way to record a payment that did not
arrive through Venmo — cash, Zelle, a wrong account. The plan is the *Planned —
manual dues entry* section below; the short version is that it records a
**payment row**, never a status flag, and needs one migration to relax four
columns that assumed Venmo was the only source.

**Status:** ✅ **COMPLETE — all 4 phases.** Phases 1–3 on 2026-08-06 (migration
19, `lib/dues.ts`, `lib/roster-index.ts`, `app/actions/dues.ts`,
`/admin/dues/import`, the ledger at `/admin/dues` and the editor at
`/admin/dues/[id]`); **phase 4 on 2026-08-07** — the roster-facing half: the
`dues` filter and sort, the Paid / Not Paid column, the member detail page's
Dues section, and one export-catalogue entry. Decided 2026-08-05.

📌 **Two names in this document moved after it was written.**
`lib/dues-roster.ts` became **`lib/roster-index.ts`** in Stage 6 phase 7b, when
the roster import became a second caller and it gained `emailLower` — the module
is unchanged in purpose, and everything this document says about it still holds.
`scoreMemberCandidates` never existed at all; see the corrections below. This document is the
reference for *why*
Stage 6.5 is shaped the way it is; the normative summary lives in the
architecture doc (§4.1, §4.5, §4.7, §5, §6, §7 Stage 6.5, §9 #12).

✅ **The one open question is closed.** The entire de-duplication design rested
on the Venmo statement CSV carrying a stable per-transaction `ID` column; a
real export was checked on **2026-08-05** and it is there. The fingerprint
fallback never has to be built — see the note at the end of the consequences
section for why that is worth being glad about.

## ✅ The real export format, recorded 2026-08-06

The obligation this document carried into phase 1 — *"record the exact header
names and the amount format; the parser is written against a real header, not a
remembered one"* — is discharged. It was worth doing: **every part of the real
shape was a surprise**, and three of them would have produced a parser that
looked right and was wrong.

| | |
|---|---|
| **Header row** | **Line 3**, not line 1. Lines 1–2 are `Account Statement - (@handle)` and `Account Activity`. |
| **Columns** | A **leading empty column**, then 22 fields: `ID, Datetime, Type, Status, Note, From, To, Amount (total), Amount (tip), Amount (tax), Amount (fee), Tax Rate, Tax Exempt, Funding Source, Destination, Beginning Balance, Ending Balance, Statement Period Venmo Fees, Terminal Location, Year to Date Venmo Fees, Disclaimer`. Located **by name**, never by position. |
| **Amount** | `+ $30.00` / `- $18.50` — the sign is a **separate token before the `$`**. `parseFloat` returns `NaN`; stripping non-numerics without reading the sign first turns a withdrawal into a payment. |

⚠️ **On the MISA account, dues arrive POSITIVE** (`+ $30.00`), because the org is
*receiving*. Only positive completed `Payment` rows are dues; a negative amount
is money leaving — a `Standard Transfer` to the bank, or a refund — and the
parser skips it as `not_incoming`. The schema agrees: `amount_cents` is
positive-only, and a refund is a **void with a reason**, never a negative
payment row.

Worth stating explicitly because the statement the format was read from was a
*personal* account, where the sample transaction was outgoing. The format lesson
(the sign is a separate token) is identical either way, but nobody should infer
from that sample that dues look negative.
| **Datetime** | `2026-09-03T19:22:00` — **no timezone offset at all.** |
| **Non-transactions** | Balance rows and the trailing disclaimer arrive as rows with an **empty `ID`**. Skip on that, never on line position. |
| **Footer** | A **quoted field spanning multiple lines**, so a `split("\n")` parser breaks on the last record of every file. |

🪤 **The datetime is the dangerous one.** `new Date("2026-09-03T19:22:00")` is
parsed as *local* time, which on the server is UTC — landing a 9pm Central
payment five hours early. This is the codebase's existing
`new Date("2026-09-01T18:00")` trap arriving through a new door.

**Decided 2026-08-06: the stamp is Central wall time**, attached explicitly via
`centralWallTimeToInstant`. Venmo renders statements in the account's own
timezone and the org is in Texas. The cost of being wrong is bounded and
already has a remedy: a payment near a term boundary lands one term out, which
is exactly why `start_term` is a **default** rather than a generated column.

🔒 The statement read was real financial data. **Nothing from it is in the
repo** — the test fixture reproduces the shape with invented values.

## 🐛 Corrections to this document, found while building phase 3

- **Two correction actions, not three.** This document names `assignPayment`,
  `setPaymentTerms` and `voidPayment`. The first two shipped as one
  **`savePayment`**, because `dues_payments.updated_at` is a **row**-level
  compare-and-set token: two forms on the payment detail page would each hold
  their own copy, so the first save would move it and strand the second, and the
  officer's next edit would report a phantom conflict. That is precisely the
  defect `directory-row.tsx` exists to prevent. Reassigning a payment and
  correcting what it bought are also one officer intent, so this follows
  `saveSubmission`'s "one save per intent" shape. Only the audit verb branches —
  **`dues.assigned`** when `member_id` actually moved, **`dues.updated`**
  otherwise. `voidPayment` stayed separate: voiding is one-way, so
  `.is("voided_at", null)` is a complete guard and no CAS token is needed.
- **The review queue reports "no member", not "unmatched" or "ambiguous".**
  Those are two *parse* outcomes and one *storage* outcome — nothing persists
  which of them happened, so `member_id is null` is all a stored row knows.
  Claiming to distinguish them on the ledger would invent information. The note
  is on screen beside it, and reading it is the officer's next move anyway.
- **The suggestion ranker gained a caller, not a sibling.**
  `rankPaymentSuggestions` in `lib/dues.ts` scores the payer name **and each
  note token as a candidate EID**, taking each member's best identity rather
  than the sum — summing would let a long note full of near-misses accumulate
  past `MIN_SUGGESTION_SCORE`, which is the "confident-looking stranger" failure
  the floor exists to stop. The weights and the floor stay in `lib/attendance.ts`.
  This is what catches the typo'd-EID case in the stage's exit criterion: a note
  reading `bk2857` against a roster holding `bk2856` is one edit, worth +45, and
  stands alone.
- **`start_term` is picked from a derived list, never typed.**
  `startTermOptions(paidAt, current)` steps off `termOf(paid_at)` by term index —
  one back, two forward — and the action re-checks membership of that list, so
  the form is not a way to POST an arbitrary term (§4.7 through a new door). It
  appends the row's stored value when that falls outside the window, because a
  `<select>` whose value matches no `<option>` renders **blank** and the next
  save would rewrite a real value — the orphaned-custom-field-option lesson.

## 🐛 Corrections to this document, found while building phase 2

- **The audit shape is one row per PAYMENT, not one receipt per import.** This
  document asked for a single receipt carrying the batch id, file name and the
  four counts. The house invariant is *"one audit row per adjustment — the
  entity is the adjustment, not the grant"*; per-payment rows are what make
  phase 3's payment-detail `AuditTrail` work at all, and
  `dues_payments.import_batch_id` already answers "which upload did this arrive
  in" without a second row. Batch context travels in `note`
  (`imported from "july.csv" — 12 of 14 new`).
- **Summer payments are warned about, not corrected at import.** This document
  says *"the import preview flags May–July payments and the officer overrides
  `start_term`"*, which reads as a per-row edit during the preview. That would
  make the preview an **input** to the commit — precisely what the re-parse rule
  exists to prevent. Settled 2026-08-06: the preview **warns**, the rows import
  with `start_term = term_of(paid_at)`, and phase 3's detail page is where an
  officer corrects them.
- ⚠️ **Next caps a Server Action request at 1MB by default**, which this
  document did not account for. `MAX_IMPORT_BYTES` is 512 KB and
  `MAX_IMPORT_ROWS` is 2000, both **refusing rather than truncating**, so an
  officer who overshoots gets a sentence naming the limit instead of an opaque
  framework error.
- 🐛 **`AuditEntityType` was missing `'dues_payment'`** after phase 1 — migration
  19 widened the SQL check and the TypeScript union was not widened with it.
  Second occurrence of that exact drift (the first was `'roster'`). Widening the
  check and widening the union is **one edit**, not two.

## 🐛 Corrections to this document, found while building phase 1

- **`scoreMemberCandidates` (named below) does not exist.** The real exports in
  `lib/attendance.ts` are `scoreMemberMatch` and `rankMemberSuggestions`. Phase
  2 should reuse those.
- 🪤 **"Tokenize the note on whitespace *and punctuation*" is wrong**, and a
  test caught it. Splitting on punctuation breaks `rp-8571` into `rp` and
  `8571` and matches neither — destroying the very thing
  `members.normalized_eid` strips `-` for. The rule is: split on **whitespace
  only**, then strip punctuation *within* each token. Accepted consequence,
  and it is the right one: `rp 8571` with a real space does not match, because
  two separate words are genuinely ambiguous and "don't auto-resolve
  near-misses" says to queue that rather than guess.
- **The term functions gained a shape the outline did not have.** `terms_from`
  is implemented over an integer **term index** (`Spring 2026 → 4052`,
  `Fall 2026 → 4053`) rather than by iterating `next_term`. It is immutable
  with no recursion — which a generated column requires — and it gives the
  schema a correct *total order* over terms, which is what the lexicographic
  trap actually needs. `term_index` and `term_at_index` are exported for it.

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
🐛 **`scoreMemberCandidates` is not a real export** — see the corrections
section above; the ranker is `scoreMemberMatch` / `rankMemberSuggestions`. The
instruction is right and the name is wrong, which is the more dangerous shape:
`rankPaymentSuggestions` did reuse the real one.

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
- ~~`assignPayment`, `setPaymentTerms`~~ → **`savePayment`** (built phase 3;
  see the corrections at the top for why the two became one). Compare-and-set on
  `updated_at`, carried as the **raw PostgREST string** — a `Date` round trip
  truncates the microseconds and every save then reports a phantom conflict.
- `voidPayment` — one-way, requires a reason, and deliberately carries no CAS
  token: `.is("voided_at", null)` is a complete guard when the only competing
  action is the same one.

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

## 📋 Planned — manual dues entry (NOT BUILT, requested 2026-08-15)

A way for an officer to mark a member as having paid when the money did not come
through the Venmo statement: cash at a meeting, Zelle, a transfer to the wrong
account, a payment Venmo exported after the officer had already reconciled that
month.

**The whole plan turns on one sentence: this records a PAYMENT, not a status.**
It writes a `dues_payments` row, so `member_directory.dues_paid_current_term`
keeps deriving the answer exactly as it does today and the manual row inherits
the edit path (`savePayment`), the void path (`voidPayment`), the audit trail
and the term arithmetic without any of them being touched. **What must not be
built is the obvious version** — a "Paid dues" toggle on the member page.
Migration 19 §6 reserves `dues`, `dues_paid` and `dues_paid_current_term` as
custom-field keys precisely to make that unbuildable, and §4.5's argument is
unchanged: two answers to one question with nothing to say which is right.

### The schema does not accept a manual row yet — four columns say so

Every one of these is a NOT NULL or a CHECK written when Venmo was the only
source, so this needs **one migration** (next unclaimed number; local and remote
are at 25):

1. **`venmo_txn_id text not null`, uniquely indexed.** A cash payment has no
   transaction id. Make the column **nullable**, make the unique index
   **partial** (`where venmo_txn_id is not null`) — which keeps the property
   that matters, that it still **spans voided rows** — and add a `source` column
   (`'venmo_import' | 'manual'`, default `'venmo_import'`) with a CHECK that a
   `venmo_import` row must carry an id. ⚠️ Do **not** synthesise a fake id like
   `manual:<uuid>`: it makes every reader of that column wrong about what it
   means, and the import's dedupe is the one thing in this schema that must stay
   obviously correct.
2. **`import_batch_id uuid not null`.** Nullable, covered by the same
   source CHECK. Consequence to accept: bulk-void-by-batch stays an
   import-only tool, which is right — there is no batch to undo.
3. **`imported_by` / `imported_at`.** Keep the names, keep them NOT NULL, and
   document that on a manual row they mean *who typed it and when*. A rename
   churns every reader for a wording improvement.
4. **`amount_cents integer check (amount_cents > 0)`.** Fine for cash. ⚠️ **A
   comped or waived membership is deliberately OUT OF SCOPE**, because it is
   `amount_cents = 0` and a receipt for money that never arrived is a different
   concept from a payment — decide it separately rather than relaxing the check
   as a side effect of this.

### The rest is a straight copy of paths that already exist

- **`app/actions/dues.ts` gains `createPayment`** — `getOfficer()` first,
  returning `{status:"unauthorized"}` (never `requireOfficer()`, per the actions
  invariant), one insert, one `admin_audit` row, `revalidatePath`. No CAS: an
  insert has nothing to conflict with.
- **`start_term` is set explicitly by the action and validated against
  `startTermOptions(paidAt, …)`**, the same function `savePayment` already uses.
  The column default is a fallback that asks `term_of(now())` and cannot see
  `paid_at`; the manual form must not fall through to it. §4.7's May–July rule
  applies unchanged, and the form should carry the same warning the import
  preview does.
- **`terms_covered` stays the review axis.** An officer typing a payment in
  should normally decide 1 or 2 there and then, but leaving it null must remain
  legal — the row then covers nothing and the member reads as Not Paid, which is
  the correct failure direction and is already visible in the queue.
- **`/admin/dues/new`**, modelled on `/admin/points/new`: member picker over
  `fetchMemberOptions` (bounded by `MEMBER_SCAN_LIMIT`), amount, paid-at date,
  start term, terms covered, and a free-text note for how it arrived. Entry
  points from `/admin/dues` and from the member detail page's Dues section with
  the member pre-filled. Unlike a grant, this is **one member per row** — a
  payment is a receipt.
- **`admin_audit`** already accepts `entity_type = 'dues_payment'` (migration
  19 §4), so this needs no widening — only a new verb in the closed
  `AuditAction` union in TypeScript.
- **Tests**: extend `tests/dues-schema.test.ts` for the four relaxations above
  (in particular: a manual row with a null `venmo_txn_id` inserts, two of them
  coexist, and a `venmo_import` row without an id is rejected) and
  `tests/dues-actions.test.ts` for `createPayment`. `seed.sql` stays at **0 dues
  payments** — production is fabricated data and a fake receipt is worse than no
  receipt.

### The one question to settle before building

**How is a manual payment distinguished on screen, and does it need to be?** The
`source` column makes it possible; the argument for showing it is that "cash,
recorded by Priya" and "Venmo txn 4429…" have very different evidentiary weight
when a member disputes their status. The argument against is another column on a
ledger that is already wide. Recommendation: show it on `/admin/dues/[id]` where
there is room, not in the ledger.

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
