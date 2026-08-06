# Student Organization Website — Architecture & Staged Build Plan

**Version:** 1.39
**Status:** Stages 0–5 complete; Stage 6 (member directory) — **phases 1 through 5 of 9 built**. **Stage 6.5 (dues & membership status) — phases 1 and 2 of 4 built**; it interrupts Stage 6 before phase 6. A new **Stage 6 phase 5c** (filter by categorical fields) is planned and unbuilt.
**Last updated:** August 2026

> **v1.39: the import.** Stage 6.5 phase 2 — `app/actions/dues.ts`,
> `lib/dues-roster.ts`, and `/admin/dues/import`. No migration.
>
> - **Two steps over one CSV, and the text never touches the server's disk.**
>   The client reads the file with `FileReader` and holds it in component state;
>   `commitImport` **re-parses** rather than accepting the preview's output.
>   Both actions call one shared `planImport`, so the commit runs the identical
>   code path the preview did and cannot drift from what the officer was shown —
>   the only thing it adds is the write. Same posture as `/attend`'s
>   `step=confirm`, for the same reason: a preview is a courtesy, never an input.
> - 🔓 **The write is an upsert with `ignoreDuplicates`**, the first in
>   application code here. Officers upload overlapping statements on purpose, so
>   "re-importing is a no-op" has to be a **database** guarantee rather than an
>   app-level pre-check a concurrent import could race past. The `.select()`
>   then returns only the rows actually inserted, so *requested − returned* is
>   the duplicate count with no second query able to disagree with it. The
>   unique index spans voided rows, so a payment an officer already voided stays
>   skipped rather than resurrected.
> - ⚠️ **A Server Action request is capped at 1MB by default.** `MAX_IMPORT_BYTES`
>   (512 KB) and `MAX_IMPORT_ROWS` (2000) sit below it deliberately, so the
>   officer gets a sentence naming the limit instead of an opaque framework
>   error. Both refuse; neither truncates.
> - ⚠️ **The matching roster is uncapped, and is not `fetchMemberOptions`.**
>   That one caps at `MEMBER_SCAN_LIMIT` (a picker's payload bound), filters to
>   active members, and never selects `normalized_eid`. Matching a payment
>   against a truncated roster reports `unmatched` for somebody who *is* on the
>   roster — §2.2's silent-truncation failure landing on money. 🪤 But uncapped
>   is not the same as one unbounded request: it pages in 1000s, because the
>   hosted project applies a `max_rows` local does not.
> - **Summer payments are warned about, not silently corrected.** §4.7 puts
>   May–July in Spring, so a July payment buys a term with three weeks left. A
>   per-row override in the preview was rejected — it would make the preview an
>   input to the commit — so the preview warns and phase 3's detail page fixes.
> - **One audit row per payment, not one receipt per import**, matching
>   `points.granted`. `import_batch_id` on the row already answers "which upload
>   was this".
> - 🐛 **The walkthrough found two defects, both of a shape no unit test
>   reaches.** First, `start_term` was coming from the import time rather than
>   the payment date — the preview told the officer a June payment counted as
>   Spring while the row stored Fall. The cause is in §4.1 itself: the default is
>   `term_of(now())` and the column comment claims `term_of(paid_at)`, which **a
>   Postgres column default cannot express**, because a default may not reference
>   another column. The application must set it, and `termOf()` in `lib/dues.ts`
>   is the mirror that keeps it derived rather than typed. Second, "Import
>   another statement" did nothing, because `useActionState` has no reset and the
>   success status is sticky. **A default that cannot express what it means, and
>   a state machine with no reset** — the first needs the clock and the database
>   to disagree before it shows, the second needs a second interaction after a
>   success.

> **v1.38: dues get a schema, and the parser meets a real file.** Stage 6.5
> phase 1 — migration 19 and `lib/dues.ts`. No screens; the import is phase 2.
>
> - **Migration 19** matches §4.1's DDL, with two additions the outline did not
>   have. `terms_from` is implemented over an integer **term index**
>   (`Spring 2026 → 4052`, `Fall 2026 → 4053`) rather than by iterating
>   `next_term`: it must be IMMUTABLE to back `covered_terms`' generated column,
>   and an index gives a correct **total order** over terms, which is what §4.7's
>   lexicographic trap actually needs — a successor function alone does not
>   answer "which of these two is later". `term_index` and `term_at_index` ship
>   alongside.
> - 🪤 **The real Venmo export was read at last, and every part of its shape was
>   a surprise.** The header is on **line 3** behind two preamble lines and a
>   leading empty column; the amount is `- $18.50` with the **sign as a separate
>   token before the `$`**, so `parseFloat` returns `NaN`; non-transaction rows
>   are identified by an **empty `ID`**, not by position; and the trailing legal
>   disclaimer is a **quoted field spanning multiple lines**, so a `split("\n")`
>   parser breaks on the last record of every file. Recorded in full in
>   `docs/dues-and-membership.md` — the parser is written against a real header
>   rather than a remembered one, which was the point of insisting on it.
> - ⚠️ **A Venmo timestamp carries no timezone** (`2026-09-03T19:22:00`), so
>   `new Date(raw)` reads it as UTC and lands a 9pm Central payment five hours
>   early. This is §4.7's `new Date("2026-09-01T18:00")` trap arriving through a
>   new door. Decided: **Central wall time**, attached with the same helper every
>   event uses. The cost of being wrong is bounded and already has a remedy —
>   `start_term` is a default rather than a generated column precisely so an
>   officer can override it.
> - 🪤 **Reserving a key has a cost the suite finds and nothing else does.**
>   Five test files used `dues_paid` as their sample custom-field key; the
>   moment migration 19's CHECK landed they failed. Renamed in the same commit.
>   The general form: forbidding a key breaks every fixture that borrowed it as
>   a plausible example.
> - 🐛 **Two corrections to the spec, both found by building it.**
>   `scoreMemberCandidates` does not exist (`scoreMemberMatch` and
>   `rankMemberSuggestions` do), and "tokenize on whitespace **and
>   punctuation**" is wrong — it splits `rp-8571` into two tokens and matches
>   neither, destroying the thing `normalized_eid` strips `-` for.

> **v1.37: the roster exports as a real workbook, written by hand.** Stage 6
> phase 5b. No migration, no new audit verb — `roster.exported` already carries
> a format.
>
> - **`lib/xlsx.ts` is dependency-free, and that was a decision rather than a
>   flourish.** The candidates were checked rather than remembered: SheetJS's
>   npm `xlsx` is stuck at 0.18.5 from roughly four years ago because releases
>   moved to the vendor's own CDN, so adopting it means either a stale build or
>   a CDN tarball URL that `npm ci` depends on; `exceljs` has had no meaningful
>   release since October 2023 and the community has forked it. This project's
>   officers turn over annually and inherit whatever lands here. An xlsx is a
>   zip of six XML parts and `node:zlib` is built in. If the shape ever grows
>   past a flat table, that is the moment to revisit `@office-kit/xlsx` — not to
>   grow the file.
> - **The typed `ExportCell` union from 5a is what makes this worth shipping.**
>   CSV is a text file: every number and date arrives as text, so the officer's
>   first act is a "convert to number" pass and sorting by points sorts
>   lexicographically until they do. The workbook writes numbers as numbers and
>   dates as date serials, and a null `attendance_rate` omits the cell entirely
>   rather than writing `0` — §4.5 does not stop at the screen.
> - 🪤 **A hand-rolled workbook has exactly one failure symptom**: Excel's "we
>   found a problem with some content" repair prompt, which names no cause. Four
>   things produce it — the reserved `none`/`gray125` fills, the child order
>   under `<styleSheet>`, every `count` attribute matching its real child count,
>   and a custom `numFmtId` at or above 164 — and all four are pinned by tests
>   that unzip the package and read it back. The suite grows its own ~40-line
>   ZIP reader rather than a dependency, so the zero-dependency property covers
>   the tests too.
> - ⚠️ **The Excel epoch is 1899-12-30**, absorbing the February 29, 1900 that
>   never existed. The serial is taken from the **Central** civil date, not a
>   UTC slice — the `new Date("2026-09-01T18:00")` class of bug arriving in a
>   new place, and it would be wrong for exactly the members who joined at an
>   evening event.
> - **XLSX is the primary download; CSV stays beside it, not behind a menu.** It
>   is explicitly the format that keeps working if this writer is ever pulled.
> - ✅ **Confirmed by opening the generated workbook in real Excel** — no repair
>   prompt, numbers sort numerically, dates are genuine serials. That was the one
>   check the test suite structurally cannot make, and it is what validates the
>   four traps above. 📌 Two ribbon labels look wrong and are not: a number cell
>   reports `General`, which is what a plain number *is* in Excel, and a date
>   cell reports `Custom` because `yyyy-mm-dd` is not one of the built-in *named*
>   formats. **The ISO format stays** rather than built-in `numFmtId` 14
>   (`mm-dd-yy`) — ISO is unambiguous across locales, survives a paste elsewhere,
>   sorts chronologically even as text, and agrees with what the CSV writer
>   emits. The cosmetic label is the whole cost.

> **v1.36: the roster leaves the building, and it is audited on the way out.**
> Stage 6 phase 5 split into **5a** (selection, the field catalogue, the
> clipboard, CSV) and **5b** (the xlsx workbook, unbuilt), mirroring the
> mid-stage 2a/2 split — CSV is the format that survives if the xlsx writer is
> ever pulled, so it ships first and stands alone. No migration.
>
> - **The codebase's first Route Handler**,
>   `app/admin/(shell)/members/export/route.ts`, because a download needs
>   `Content-Disposition` and a Server Action cannot set response headers.
>   ⚠️ Route Handlers **do not participate in layouts**, so the `(shell)`
>   layout's `requireOfficer()` never runs for it — the group is colocation and
>   grants nothing. `proxy.ts` still 307s an unauthenticated request to login
>   before the handler runs, but that is a convenience; the `getOfficer()` 403
>   is what catches a signed-in user with no `admin_profiles` row.
> - **Selection is two modes, not one set that happens to be full.** In `filter`
>   mode the request carries **no ids at all** and the route re-runs the same
>   filtered query, which is what makes "all N matching" provably all N rather
>   than the 25 that happened to be rendered. Explicit ids *narrow* that query
>   instead of replacing it, so a stale checkbox cannot pull back a row the
>   filter excludes. §4.5's one-translation rule is what makes this cheap:
>   `applyMemberFilter` is shared and only `pageRange()` differs.
> - 🔓 **The CSV formula guard fires on text and must never fire on numbers.**
>   A member named `=HYPERLINK(...)` is reachable by design (§6 self-registration),
>   but `bonus_points` of `-5` is legitimately negative and `'-5` stops being a
>   number the moment it lands in the sheet. Hence a typed `ExportCell` union
>   rather than stringified rows: an "escape everything" pass would be right for
>   names and wrong for every negative number. Confirmed end to end against a
>   real row, not only in unit tests.
> - **The receipt records what actually left, not what was ticked.** The
>   clipboard's email and name formats emit one column regardless of the field
>   picker, and the first cut logged the picker's four for an email copy.
>   Over-reporting is still misreporting: a receipt that answers §6's question
>   with a superset is one nobody can reason from later. Found in the
>   walkthrough. The clipboard is audited exactly like the download — same
>   egress, and only `Content-Disposition` differs.
> - **Export is open to any officer, and that is now settled** (§6's "consider
>   restricting it", resolved). §9 answered four adjacent questions the same way
>   on one premise — the audit log is the control, not a gate — and nothing in
>   this codebase branches on `admin_profiles.role`. The one argument that
>   genuinely does not apply to approving was weighed and lost: a downloaded
>   file outlives the session. Both `lib/export.ts` and the route say so in
>   their headers so nobody re-adds a gate as an oversight.
> - **The xlsx writer will be hand-rolled, zero-dependency** (5b). Checked
>   rather than remembered: SheetJS's npm package is stuck four years back
>   because releases moved to its own CDN, and `exceljs` has been inactive since
>   Oct 2023. An xlsx is a zip of ~6 XML parts and `node:zlib` is built in.

> **v1.35: Stage 6 phase 4 shipped** (2026-08-05, merge `3931d99`). Migration 18
> was pushed to the remote, so **local and remote are level again at 19
> migration files** — they had differed for three days, the only time in this
> project they have. Bookkeeping only: nothing in the design changed, and the
> phase-4 sections below already described the code as built.
>
> Two things were confirmed against production after the deploy rather than
> assumed, and both are worth repeating on every deploy that touches a view:
>
> - **anon is still 401 on `member_directory`.** Migration 18 recreates the view,
>   and a recreate is precisely what silently re-inherited anon access in
>   phase 2a. `create or replace` preserves grants and the migration re-issues
>   the revoke anyway; the check confirms it landed. `anon` holds no grant on
>   the view at all, and `authenticated` keeps its `SELECT`.
> - 🪤 **`200` is the correct anon response for an RLS-protected table, and it
>   is not a leak — read the body, not the status.** `members` and the new
>   `member_field_definitions` both answer `200 []`, because RLS-enabled with no
>   policies filters every row rather than refusing the request. Only the
>   *view* answers `401`, and it does so because it has no grant — views have no
>   RLS. Anyone spot-checking this will see two `200`s next to a `401` and
>   should not read the difference as a hole. `events` legitimately returns
>   rows: the `events_public_read` policy, confirmed to expose published events
>   only.

> **v1.34: dues stop being something an officer ticks and become something the
> system calculates.** Planning only — no schema, no code. MISA is splitting
> attendees into **official** and **unofficial** members on whether they have
> paid dues, which turns this document's canonical custom-field example
> ("Paid Dues → Yes/No") into the wrong mechanism rather than merely a stale
> one. Dues status is now derived from actual payments, reconciled from Venmo
> statements, and it gets a **dedicated column** in the directory. New
> **Stage 6.5**, slotted between Stage 6 phases 5 and 6; new spec at
> [`docs/dues-and-membership.md`](dues-and-membership.md).
>
> - **The input is a monthly CSV, because Venmo has no API and no
>   year-to-date export.** Statements will be uploaded on overlapping ranges to
>   keep the data fresher than monthly, which makes de-duplication a
>   **correctness requirement rather than a nicety**. The dedupe key is
>   Venmo's own per-transaction ID, unique-indexed, so an August 28 statement
>   re-covering August 1–10 collides and skips — in any order, any number of
>   times. 🪤 Amount + date + payer is *not* unique: two members can send $30
>   in the same minute, and a fingerprint over those fields would silently
>   collapse one of them. ✅ **Confirmed against a real export on 2026-08-05** —
>   the ID column is there, so the design stands and the fingerprint fallback
>   never has to be built.
> - **The link between a payment and a member is the note**, where the payer
>   writes their EID. Matching needs no EID regex: tokenize the note, apply the
>   same fold `members.normalized_eid` uses, and look for a token that *is* a
>   roster member's normalized EID. Exactly one → linked. Zero → unmatched.
>   Two or more → queued. Exact match only — §7's "don't auto-resolve
>   near-misses" carries over intact, and a payment note never creates a member.
> - **§4.2's invariant extends: nothing that arrived as money is dropped on the
>   floor either.** An odd amount, an unreadable note, no note at all — the row
>   is stored and queued, never discarded. The review axis is a **nullable
>   `terms_covered`**, not a status enum: null means "an officer has not decided
>   yet", so a $35 payment (someone tipped) or a $60 one (someone covered a
>   friend) parses, links, and waits. `covered_terms` is generated from it, so a
>   row awaiting a decision counts for nothing until the decision is made.
> - **Prices live in `app_settings`, and are read at import time only.** Dues
>   change between years and a hardcoded 30/50 becomes a migration the day the
>   org raises them. `terms_covered` is *stored* on the row, so a later price
>   change never rewrites what last year's payments bought.
> - **`member_directory` gains exactly one dues column** —
>   `dues_paid_current_term boolean`. It **appends**, so `create or replace`
>   suffices and migration 15's anon hole stays shut. No "paid through" column:
>   terms do not sort lexicographically (`Fall` precedes `Spring`
>   alphabetically and follows it chronologically), so a latest-term column
>   needs a sort key it does not otherwise need. The detail page reads the
>   member's payment rows directly, as it already does for adjustments.
> - ⚠️ **`dues`, `dues_paid`, and `dues_paid_current_term` all become reserved
>   keys**, in the migration's CHECK and in `RESERVED_FIELD_KEYS`. Without that
>   an officer can recreate the hand-ticked dropdown beside the calculated
>   column, and the roster then has two answers to one question. Reserving
>   `dues` alone is not enough — `dues_paid` is the name somebody actually
>   reaches for, and it is the one the phase-4 walkthrough itself used.
>   ✅ **That walkthrough fixture was deleted from the local database on
>   2026-08-05**, so migration 19's CHECK has nothing left to trip over. It
>   would have: archiving would not have helped, because migration 18's unique
>   key index spans archived rows on purpose.
> - 🔓 **The threat-model boundary below had to be rewritten.** "It holds no
>   financial or highly sensitive data" stopped being true as written. No card
>   or bank data ever enters the system — money moves in Venmo and what is
>   stored is a transaction ID, an amount, a note, and a display handle — but
>   that is a narrower claim than the one §6 used to make, and §1.3's
>   "payment processing" non-goal now has to distinguish *processing* from
>   *reconciliation*. §2.2's Vercel Hobby commercial-use line turns on the same
>   distinction.
> - **Official status gates nothing** (§9 #12). It is a column, a filter, and a
>   line on the member's own lookup; check-in, points, and the leaderboard are
>   untouched. Chosen because it is the reversible option — gating can be added
>   later without a migration, and gating the leaderboard would have made the
>   public board reveal who has paid, which §9 #1 says is the one privacy
>   choice that cannot be undone.

> **v1.33: custom fields become editable — the mutations and the screens.**
> Walked through a browser clean on 2026-08-03, with no application defect
> found. Still **local-only**: migration 18 is unpushed and nothing is
> committed, so local and the remote have diverged for the first time in the
> project (19 migration files against 18) — deliberately, and pending a
> `db push` before the merge. *(Superseded by v1.35: pushed, merged and
> deployed 2026-08-05. The local-only status above is history, not current.)*
>
> - **`app/actions/members.ts`** carries all four mutations — one field value,
>   the officer notes, a definition, and archive/restore. **No role check
>   anywhere in it**: §9 #6's "the audit log is the control, not a role gate"
>   settled for phase 4 as *any officer may both define a field and edit a
>   value*, and the file says so, so nobody re-adds a gate as an oversight.
> - **The row, not the cell, owns the compare-and-set token.** `members.updated_at`
>   is a single row-level value that every inline cell and the notes editor posts
>   back. Per-cell copies would strand siblings on a stale token after the first
>   save, and the officer's second edit in that row would report a phantom
>   conflict. This is why `member_directory` had to grow `updated_at` — both
>   editing screens read the view and compare against the table.
> - 🔓 **Nothing ties a stored value to its definition's option list**, and that
>   is deliberate: editing the list orphans values rather than rewriting members'
>   answers. The obligation that follows is a rendering one — a `<select>` with
>   no matching `<option>` shows blank, so an orphan is displayed as a disabled
>   "no longer an option" entry rather than silently looking like no answer.
> - **Archiving never deletes**, a definition or a value; keys stay reserved
>   even when archived, so a new field cannot adopt the answers stored under an
>   old one. Restoring is filed as `member_field.updated` rather than a new verb.
> - **A bug shipped and fixed inside one session, worth the note:**
>   `memberFilterUrl` re-parsed what it built without the definitions, so a
>   `cf:` sort degraded to `name` on every filter change. A "re-parse to
>   normalize" round trip inherits every argument the parser needs, and omitting
>   one fails quietly.

> **v1.32: custom fields get their storage, and a sorting spike decides its
> shape.** Migration 18 is applied to the local database only — not pushed, not
> merged, not deployed — and nothing on the roster is editable yet.
> *(Superseded by v1.35: pushed, merged and deployed 2026-08-05.)*
>
> - **Values live in `members.custom_fields jsonb`, keyed by definition key,
>   with the definitions in `member_field_definitions`.** The choice was forced
>   by sorting rather than taste, and was settled by a spike before any code:
>   supabase-js `.order("custom_fields->>key")` is accepted on a table *and
>   through a view*, on both the local stack and the hosted project (both
>   `postgrest/14.5`), and survives `.range()` pagination. The fallback that was
>   on the table — fixed generic `custom_1 … custom_n` columns — is not needed.
> - 🔓 **The key format check is a security control.** The key is interpolated
>   into an `order=` term, and an unconstrained one is a sort-injection surface:
>   a comma is parsed as a second order column, while a space and a `"` are
>   accepted *silently*. `^[a-z][a-z0-9_]{0,39}$` is enforced in the zod schema,
>   in the migration's CHECK, and again where the order string is built.
> - **Sort keys are namespaced `cf:<key>`**, so an officer-defined field can
>   never shadow one of the four built-in sorts. `applyMemberFilter` now takes
>   the definition list as a *required* argument, so forgetting to load it is a
>   compile error rather than a directory that quietly sorts by name.
> - **`members` gains `updated_at`** — the compare-and-set anchor inline editing
>   needs, which it never had because nothing edited a member before.
> - Also closed: `AuditEntityType` was missing `'roster'`, which migration 14
>   added to the SQL check back in phase 1 — phase 5's export receipt depends on
>   it.

> **v1.31: a worst-case capacity check — the free tiers hold, the constants do
> not.** Run against 500 members, 3 events a week, 150 attendees each. §2.2 has
> the arithmetic; nothing is built or changed.
>
> - **No service tier needs upgrading, and it is not close** — ~7 MB of
>   attendance a year against a 500 MB database, and Supabase MAU counts *auth
>   users*, so it stays at ~13 officers however large the roster grows. The
>   limit everyone assumes they will hit is the one the no-accounts design (§3)
>   already removed.
> - **Two application constants break first, and both break silently.**
>   `RATE_LIMIT_MAX = 90` per IP per 10 minutes refuses the 91st person in a
>   150-person room behind one NAT; `MEMBER_SCAN_LIMIT = 400` truncates the
>   roster scan under every picker and the near-miss ranker at 500 members.
>   Neither surfaces an error.
> - **The lesson generalises past these two.** Every cap in this codebase was
>   sized against the org as it is now and carries a comment explaining that
>   size. A capacity question is therefore a question about *constants*, not
>   about bills — and the constants are the part with no monitoring behind
>   them. §2.2 is where that check lives from now on; re-run it when the roster
>   or the cadence changes materially.
> - 📌 **A stale comment was corrected in the same pass.** `MEMBER_SCAN_LIMIT`
>   claimed the detail page "falls back to bounded ILIKE probes" above the
>   limit. There is no such fallback — the query is a bare `.limit(400)`. The
>   comment described an intention as though it were behaviour, which is how a
>   silent truncation stays unnoticed.
>
> **v1.30: phase 5 gains a real `.xlsx` download, alongside CSV.** A planning
> change only — nothing is built. Requested 2026-08-02: officers want a
> spreadsheet file of *certain or all* members with *selected fields*, not only
> a CSV.
>
> - **The three extraction paths stay distinct, and the file ones now number
>   two.** Clipboard (emails, names, TSV) is for pasting somewhere; **CSV** is
>   the interchange format anything can read; **XLSX** is the one that opens in
>   Excel already typed, with a header row and column widths, and without the
>   import dialog. CSV is not dropped — it is the format that survives when the
>   xlsx writer does not.
> - **Which rows and which columns both become explicit choices.** "Certain or
>   all members" is the phase-5 selection model already planned — the checked
>   rows, or *select all N matching this filter*. What is new is the **field
>   picker**: the export is no longer the four displayed columns but a chosen
>   subset of everything the directory and detail page know, custom fields
>   included. Both choices go in the audit receipt, because "who exported what"
>   is now two questions.
> - **A file download is a Route Handler, not a Server Action** — the first one
>   in this codebase. An xlsx is binary and needs `Content-Disposition`; a
>   Server Action cannot set response headers. It opens with `getOfficer()` and
>   returns **403**, not a redirect, and it reaches the rows through
>   `applyMemberFilter` like every other caller. §4.5's one-translation rule is
>   exactly what makes "the file matches the count on screen" provable.
> - 🪤 **A spreadsheet export is a code-execution surface, and member data is
>   attacker-supplied.** Anyone who can check in picks their own name, so a
>   member called `=HYPERLINK(...)` is reachable by design (§6's
>   self-registration row). Excel evaluates a leading `=`, `+`, `-`, or `@` in a
>   **CSV** cell; the risk is the CSV, not the xlsx, where cells are written as
>   typed text and stay inert. §6 carries the row now.
> - **The writer is an open decision, deliberately deferred to phase 5.** Every
>   dependency here is one the next officer inherits, and this project has none
>   beyond the framework and Supabase. Evaluate at build time; do not assume the
>   package you remember is still the maintained one.
>
> **v1.29: the directory is four columns, and the member detail page exists.**
> Stage 6 phase 3, and the first phase of this stage that needed **no
> migration** — `member_directory` already carried everything, which is what
> migration 14 was for.
>
> - **Two decisions worth carrying, both about what "filtering narrows to what
>   is displayed" actually costs.** The six retired filters (`source`,
>   `minEvents`, `maxEvents`, `minRate`, `joinedFrom`, `joinedTo`) were removed
>   from `MemberFilter` outright rather than having their controls hidden. A
>   filter that still applies with no control on screen is the phase-1 defect
>   arriving from the other direction: a count the officer cannot account for.
>   An old bookmark now narrows nothing, which is visible and safe.
> - **Free-text search replaces most of what left**, across name / email / EID —
>   the displayed columns, so it stays inside the rule. Sanitized once in
>   `parseMemberFilter` and emitted as a single **double-quoted** PostgREST `or`
>   group: `.` and `,` are filter syntax and every email is full of both, so an
>   unquoted value parses as a malformed operator rather than as a search. No
>   pure test can catch that, which is why it is asserted against real PostgREST.
> - **The events grid has three states, not two.** `events_possible` counts only
>   events that have ended, so an event that has not happened yet is `upcoming`,
>   never a miss — anything else contradicts the rate printed above it. §4.5 now
>   says so, and `classifyTermEvents` in `lib/members.ts` owns it.
> - **The grid and the view can legitimately disagree.** `member_directory`
>   counts present rows against any non-cancelled current-term event, drafts
>   included; the grid is published-only. The view is the authority on the
>   numbers, the grid is the breakdown, and neither is derived from the other.
>
> **v1.28: the remote is not a scratch database.** Migration 17 backfills the
> pre-rename EID values on the linked project, because the planned re-seed was
> refused — and the refusal turned out to be load-bearing.
>
> - **`seed.sql` guards itself against wiping a database whose `auth.users`
>   holds a real account, and the linked project trips that guard.** It has a
>   real officer *and* a real member: `Christian A Gonzales / cag7284`,
>   self-registered through the live check-in form. A full re-seed would have
>   destroyed a real person's row. **Do not work around that guard**; do what
>   migration 17 does instead — a targeted, idempotent backfill keyed so it can
>   only match the old shape, which touches no account, audit row, or link.
> - **This also revises §2.2 and §6 in spirit:** the linked project stopped
>   being a scratch copy of `seed.sql` the moment the check-in form went live.
>   Its totals (33 members / 16 events / 209 attendance / 12 audit) are not the
>   seed's 32/15/208/2, and code or docs that assume they match are wrong.
> - **It is also the concrete subject of the v1.27 exposure.** The anon read of
>   `member_directory` was returning a real name, email, and EID — not only
>   fabricated rows. The privacy cost in §6 was realised, not hypothetical.
> - `scripts/seed-remote.sh` stopping cleanly at the first chunk is why no
>   partial seed landed on live data. It has `set -euo pipefail` and exits per
>   chunk; keep both if that script is ever rewritten.
>
> **v1.27: an anon read of `member_directory`, closed; and the EID rename,
> applied.** Migrations 15 and 16. The first was not planned work — it was found
> while reading the schema to write the second.
>
> - 🔓 **`member_directory` was readable by the anon key, in production.**
>   Every member's student ID and email, exposed to anyone holding the
>   publishable key — which is inlined into the client bundle of a public site.
>   Verified at the PostgREST boundary before and after (`206` with
>   `Content-Range: */33`, then `401`), not inferred. Migration 15 revokes it.
> - **The cause is structural and belongs in §6 rather than in a bug list.**
>   `20260730000012_api_role_grants.sql` grants `all privileges on all tables in
>   schema public` to anon, arguing it is safe because "RLS is the security
>   boundary". That holds for tables and **fails for views**: `grant all on all
>   tables` covers views, a view has no RLS, and `member_directory` deliberately
>   runs as owner so it can aggregate *past* the deny-all tables beneath it.
>   Every non-public view now needs an explicit revoke, and — because
>   `alter default privileges` re-grants at creation — **every recreate must
>   re-issue it**. `tests/security.test.ts` enumerates the views and enforces an
>   allowlist of exactly one, `leaderboard`, which carries no identifier.
> - **Why it survived review:** `members` itself denies correctly, RLS is on
>   everywhere, and there are no policies. Every check aimed at the table came
>   back clean. Checking a table proves nothing about a view over it.
> - **"Student ID" is now "EID"** — a real UT EID (`ao1234`), not a relabel.
>   Migration 16 renames the columns, constraints, and indexes, and folds the
>   normalization to **`lower`** rather than upper, because EIDs are written
>   lowercase and the review screen renders the normalized form back at the
>   reader. §4's DDL is updated to match.
> - **The ranker's calibration did not survive the format change.**
>   `id_contains` (+35) is **removed**: it existed only to catch a dropped `UT`
>   prefix and degrades into a broad substring match on short alphanumerics.
>   The distance-2 floor stays — but for a *new* reason, which is the part worth
>   carrying: EIDs are derived from name initials, so the near-miss population
>   is **correlated with the roster** rather than spread across a numeric range.
>   That is the sequential-ID problem from the other direction, and arguably
>   worse, since a typo now lands on a plausibly-confusable real person more
>   often. `seed.sql` reproduces the cluster deliberately and
>   `tests/seed-fixtures.test.ts` asserts the empty suggestion state holds.
> - **`seed.sql` now asserts its own documented counts** and aborts if they
>   drift. Regenerating the EIDs silently changed the seeded `random()` draw
>   order and dropped a review-queue fixture and an audit row while still
>   producing 208 attendance rows — a shape the old seed had no way to notice.

> **v1.26: Stage 6 re-planned, after phase 1 had already shipped.** Four
> decisions landed on top of a stage that was already one phase in. Together
> they replace enough of the remaining plan that the phase list was rewritten
> rather than patched — six phases become nine. `tasks.md` carries the phase
> detail; what follows is what became normative.
>
> - **"EID" becomes "EID", and not only as a label.** The identifier
>   itself becomes a real UT EID — alphanumeric, `abc1234` — replacing the
>   `UT` + six-sequential-digit format the seed, the fixtures, and the
>   suggestion ranker were all built around. Stage 6 phase 2 does the rename;
>   **§4's DDL still describes the pre-rename schema and is correct until that
>   migration lands.** Two consequences are not obvious. The normalization's
>   whitespace and hyphen stripping loses its purpose (EIDs contain neither) and
>   what remains is case-insensitivity, folded to **lower** rather than upper,
>   because EIDs are conventionally lowercase. And §7's near-miss calibration
>   does not survive: `id_contains` exists solely to catch a dropped `UT` prefix
>   and degrades into a broad substring match on short alphanumerics, while
>   distance-1-stands-alone was tuned for 8-character strings with a constant
>   2-character prefix. Both are re-derived empirically in phase 2.
> - **The directory shows four columns; everything else moves to a member
>   detail page.** Name, Email, EID, Total Points, plus officer-defined custom
>   fields. Sorting and filtering narrow to what is displayed. This is the
>   reason `/admin/members/[id]` can no longer be a later phase: removing a
>   column before its new home exists makes that data unreachable, so the
>   reduction and the detail page land together in phase 3.
> - **Officers can define their own member fields.** Dropdowns first (Paid Dues
>   → Yes/No, T-shirt size → S/M/L), inline-editable from the directory table,
>   with inline-editability chosen when the field is created. Values live in a
>   JSONB column on `members` rather than an EAV table, and the reason is
>   sorting rather than taste: PostgREST orders by column, a `create or replace`
>   view cannot grow a column per officer-defined field, and a values table
>   cannot be sorted from the parent under pagination at all. This is the same
>   wall migration 14 hit with `attendance_rate`, reached from the other side.
> - **A view may be dropped to rename an output column.** `create or replace`
>   can only append, and migration 14 chose it precisely to keep
>   `member_directory`'s `authenticated` grant — the §6 security boundary.
>   Renaming `eid` → `eid` cannot be done that way, so a drop is now
>   permitted *provided the same migration re-issues the grant*. DDL is
>   transactional, so there is no window; the hazard is forgetting the re-grant,
>   which surfaces at the next non-service-role read rather than at migration
>   time.
>
> **v1.25: the member directory, read-only.** Stage 6 phase 1 — migration 14,
> `lib/filters.ts`, and `/admin/members` with server-side sorting, pagination,
> and the filters that live on the view. 238 tests across 12 files. Decisions
> now normative:
>
> - **`member_directory` gains `attendance_rate`, and it is null rather than
>   zero when the denominator is.** §4.5 previously noted that `events_possible`
>   *enables* a rate without a second round trip, which was true and not enough:
>   PostgREST filters and orders by column and cannot be handed an expression,
>   so a sortable rate column and a rate-threshold filter were both impossible
>   while the rate was only implied. A term with no completed events has no
>   rate — 0% would read as "attended nothing" and sort below a real 5%.
> - **A roster export is audited as its own receipt.** §6 requires every export
>   logged with its filter and row count, but `admin_audit.entity_id` is
>   `uuid not null` and an export spans N members rather than naming one. Each
>   export now generates a uuid that nothing else references, under the new
>   `'roster'` entity type. Making `entity_id` nullable would have weakened the
>   column for the four types that do have a real entity, and reusing a member's
>   id would make an export read as an action taken against that person.
> - **A paginated list needs a total order, not merely a sort.** Rows tied on
>   the sort column can otherwise come back arranged differently per request,
>   which makes pages skip and repeat members — and reads as missing data rather
>   than as an ordering fault. Every directory query ends with `id`.
> - **One filter object, one translation, and pagination outside it.**
>   `applyMemberFilter` is the only thing that turns a filter into a query, and
>   it deliberately does not paginate. Phase 2's "copy all N matching" applies
>   the identical function and simply never calls `pageRange` — which is what
>   makes the export provably the same query as the count beside it, rather than
>   a second one someone has to keep in step.

> **v1.24: Stage 5 closed.** Phase 5's final read-through, which is the last
> item in the stage. No code changed and no decision moved; what changed is that
> the claims are now checked rather than asserted. Verified against the running
> system: 208 tests across 10 files pass, lint and build are clean, all 14
> migrations are identical local and remote, and every Stage 5 route is in the
> production build. Three things the read-through corrected, all drift rather
> than error:
>
> - **The Stage 5 heading in §7 still read "phases 1–3 of 5 built"** and this
>   status line still said "in progress", two versions after phase 4 shipped. A
>   status line nobody updates is worse than none, because it is believed.
> - **§5's route table was missing `/admin/events/series`** and §10's layout was
>   missing six modules that exist — `/admin/points`, `app/actions/auth.ts`,
>   `lib/event-options.ts`, `lib/member-options.ts`, `lib/admin-profiles.ts`,
>   and `lib/supabase/admin.ts`. §10 is the map a new officer reads first.
> - **The Stage 7 carry-forward lived only in `tasks.md`.** `revalidatePoints`
>   cannot revalidate `/leaderboard` because the route does not exist yet, and
>   granting or voiding both move public standings. That path must be added the
>   day `/leaderboard` ships, so it now sits in Stage 7's checklist where it will
>   be read, not in a stage section that gets archived.
>
> Stage 5's exit criteria are met at the level the built surfaces allow — see
> the note under them, which records what is verified through a UI and what is
> verified against the views until Stages 6 and 7 ship the screens.

> **v1.23: `/admin/points` — granting, the ledger, and voiding.** Stage 5 phase 4,
> the last functional piece of the stage. Needed no
> migration: §4.2's `point_adjustments` and migration 13's `void_requires_reason`
> already carried everything. 208 tests across 10 files. Decisions now normative:
>
> - **A multi-member grant is one atomic insert, all-or-nothing** — the deliberate
>   exception to §7's "bulk actions report partial success". That rule is right for
>   `bulkAssignEvent`, which operates on rows that already exist, so a skipped
>   submission stays visibly in the queue. A partial *grant* has no such backstop:
>   eleven of twelve members credited, the officer told it worked, and the twelfth
>   finds out a month later. A bad member id therefore costs the whole grant, and
>   an oversized selection is refused rather than truncated to the cap.
> - **The multi-member picker filters a scanned roster client-side.** The
>   `?q=…&sel=…` URL scheme `tasks.md` previously sketched is
>   withdrawn: it existed to survive a navigation, and a client-side filter over
>   the already-scanned roster has no navigation to survive. What replaces it is
>   two rules — the payload rides on hidden inputs rather than the filtered
>   list's checkboxes, and no member is ever mounted twice — because both failure
>   modes produce a partial grant that reports success.
> - **Both sides of an audit before/after must select the same columns.** The
>   trail diffs the union of their keys and renders a one-sided key as `—`, so a
>   narrower select on an update invents changes that never happened. Found in the
>   browser: voiding read as though it had erased the reason and the awarding
>   officer.
> - **§9 #9 and #10 needed no code.** No role check and no self-grant check exist
>   in `grantPoints`, and its header says so, so neither is added back later as a
>   missing safeguard. `MAX_POINTS_PER_GRANT` stays a fat-finger guard, not a
>   policy cap.

> **v1.22: `/attend` asks whether you're new.** Check-in resolved a member by
> exact match and then *created* one, which made someone who mistyped both their
> ID and their email literally the same insert as a genuinely new person. Typos
> became roster rows, and §7's Stage 6 notes record that nothing merges them. The
> form now carries one checkbox — "this is my first MISA event" — which supplies
> the one bit of information the system cannot derive, and the system stops
> guessing on its own. 190 tests across 9 files. Decisions now normative:
>
> - **Member lookup and member creation are separate operations.** `resolveCheckin`
>   only ever looks a member up. Creating one happens behind an explicit
>   confirmation, and is the single unauthenticated `members` insert in the system.
> - **An unmatched submission is discarded, not queued**, however many times it
>   fails. There is no two-strikes fallback. This narrows §4.2's "nothing is ever
>   dropped on the floor" to submissions resolving to a *known* member — see the
>   note below, and the accepted cost.
> - **The checkbox is a hint, not an instruction.** Ticking it when you already
>   exist links you to yourself; the lookup always runs first and a duplicate is
>   never created.
> - **The membership oracle is accepted, and it contradicts §6's login stance on
>   purpose.** The re-prompt says "we don't have that info on file", so anyone can
>   probe a EID for roster membership. Officer sign-in deliberately returns
>   one identical failure for "wrong password" and "no such user"; the two look
>   inconsistent unless the difference is written down. The roster is a club list,
>   not a security boundary, and UT EIDs are semi-public. Event resolution
>   runs first, so the oracle is closed entirely outside check-in windows.
> - **`RATE_LIMIT_MAX` 30 → 90.** A first-timer now spends two slots and the
>   re-prompt invites retries; at a recruiting event behind one venue NAT the old
>   number would have admitted barely fifteen people.
>
> Full spec, decision table, and consequences: `docs/attend-confirmation-flow.md`.

> **v1.21: Stage 5 phases 2 and 3.** The submission detail screen and every
> review mutation — resolve, approve, reject, reopen, bulk assign, manual entry
> — are built and verified in a browser against the local stack. 182 tests
> across 9 files. Decisions made and now normative:
>
> - **A near-miss student ID needs corroboration at distance 2.** The member
>   ranker scored a two-character edit distance at exactly the suggestion floor,
>   which meant a submission from someone on no roster at all was offered three
>   confident-looking strangers. Student IDs issued in sequence put roughly three
>   members within distance 2 of *any* six-digit number, so at that distance the
>   similarity carries no information. (v1.27 note: the identifiers are EIDs now
>   and are not sequential — but see that entry, because the rule survives for a
>   different reason rather than lapsing.) Distance 2 now scores below the floor and
>   must be joined by a second reason (email, a shared name token, a matching
>   surname); distance 1 still stands on its own, because that is a typo rather
>   than a coincidence. This is the "don't auto-resolve near-misses" rule applied
>   to the ranker itself: an empty list is a valid, and often the correct, answer.
> - **Approving or rejecting returns the officer to the filtered queue; a plain
>   save does not.** Approve and reject remove a row from the pending view, so
>   the officer's next action is on the next row — the queue is a work list being
>   drained, and dropping them back on a resolved row costs a navigation every
>   time. A save leaves them in place because they are still working that row.
>   The queue's filters ride through the whole trip in the query string, so the
>   view they return to is the view they left.
> - **Officer attribution distinguishes "no display name" from "no profile".**
>   `admin_profiles.display_name` is null unless `create-officer.mjs --display-name`
>   is passed, and treating a nameless profile the same as a missing one credited
>   every ordinary officer's work to "a former officer" — inverting the
>   accountability §6 rests on. A missing profile means revoked; a null name
>   means a current officer who has not set one, and reads as "an officer". The
>   bootstrap script now defaults the name to the email's local part.

> **v1.20: Stage 5 is under way.** Phase 1 — the schema groundwork, the pure
> resolution core, and a read-only review queue at `/admin/attendance` — is built
> and verified against the local stack. Phases 2–5 (submission detail,
> mutations, `/admin/points`, docs) follow. 156 tests across 8 files.
> Decisions made and now normative:
>
> - **`attendance` gains `updated_at`** (migration `…000013`), with a trigger
>   reusing the schema-wide `set_updated_at()`. The review actions need the same
>   compare-and-set anchor the event editor uses: without one, two officers
>   assigning *different* events to the same still-pending row both succeed and
>   the later write silently wins. `resolved_at` cannot serve — it is null for
>   exactly the rows that need guarding.
> - **Concurrency is anchored differently for single rows and for batches.**
>   Single-row attendance mutations compare-and-set on `updated_at`. Bulk
>   operations scope on `status = 'pending'` and report the difference between
>   rows requested and rows updated as skipped — carrying two hundred
>   `updated_at` strings through a form buys nothing.
> - **`point_adjustments` deliberately has no `updated_at`.** An adjustment is
>   immutable except for voiding, and voiding is a one-way transition, so
>   `.is("voided_at", null)` on the `UPDATE` is already a complete guard: zero
>   rows back means someone voided it first. The asymmetry with `attendance` is
>   intentional, not an oversight.
> - **`void_requires_reason`** (same migration): `(voided_at is null) =
>   (void_reason is null)`. §4.2 already argued that a void is a recorded action
>   carrying its own reason, but `void_is_complete` only paired `voided_at` with
>   `voided_by` — the reason was enforced in application code alone.
> - **A draft event's attendance counts on the public leaderboard.** The
>   `leaderboard` view excludes only `cancelled`, not unpublished. This is
>   defensible (build a schedule, backfill, publish later) but was undocumented,
>   and it means approving a submission against a draft moves public standings.
>   Surfaced as a warning at resolution time rather than changed.
> - **`leaderboard` filters `where m.active`; `member_directory` does not.**
>   Approving for an inactive member changes the officer directory and produces
>   no public change at all. Also surfaced as a resolution warning.
> - **`nearby_events().gap` is event-relative, not window-relative.** It measures
>   against `starts_at`/`ends_at`, but the *check-in window* is what refused the
>   submission, and with a late close configured those are different numbers. The
>   officer-facing sentence leads with the window ("check-in closed 26 minutes
>   before this submission") and keeps the event number beside it as the ranking
>   basis. Ranking itself stays in SQL; JavaScript annotates and never reorders.
> - **`nearby_events()` is published-only and returns nothing beyond 48 hours**,
>   which is the ordinary state of an orphan that sat in the queue for a week.
>   The assign control therefore needs an independent all-status event picker;
>   the suggestion list ranks, it does not enumerate the options.
> - **Member candidates are scanned, not probed.** The canonical near-miss is
>   `Jon` vs `John`, and `ilike '%jon%'` cannot match `John` — a probe-based
>   candidate set structurally excludes the row the officer wants. Under
>   `MEMBER_SCAN_LIMIT` (400) the active roster is fetched and scored in
>   JavaScript, which is also what makes the ranking unit-testable. `pg_trgm` is
>   the growth path, deliberately not enabled at this size.
> - **Nothing is ever preselected.** Suggestion lists render with nothing
>   checked, and `rankMemberSuggestions` returns an empty list rather than a
>   weak guess when nothing clears the score threshold. This is §7's
>   "don't auto-resolve near-misses" carried into the UI, where a stray
>   `defaultChecked` is the easiest way to violate it by accident.
> - **Date-range filters are Central-anchored and half-open.** A bare
>   `.lte("submitted_at", "2026-04-07")` is read as UTC midnight and silently
>   drops the last five or six hours of a Central day. Same class of bug as
>   `new Date("2026-09-01T18:00")`, and it fails plausibly rather than loudly.
> - **Server Components own date formatting.** `Intl.DateTimeFormat` inside a
>   Client Component runs on both sides of hydration, and Node and Chrome ship
>   different ICU data for the space before "PM" — a mismatch whose React diff
>   shows two apparently identical strings. Formatted labels are passed down as
>   props.
> - **`admin_audit.action` is a closed union in TypeScript and free text in
>   SQL, and readers must tolerate values outside the union.** Two pre-Stage-5
>   rows on the production database carry the bare verbs `reject` and `void`,
>   and they can never be corrected: the append-only trigger raises P0001 on
>   `UPDATE` and `DELETE` alike, which is exactly the property that makes the
>   log worth having.
> - **Officer attendance mutations live in `app/actions/attendance-review.ts`,
>   apart from the public `app/actions/attendance.ts`.** That module holds
>   `submitCheckin`, the one unauthenticated write path in the system; keeping
>   it a single-export file makes "what can an anonymous user POST to" a
>   one-file answer. A divergence from §10's original layout list.
> - **§9 is fully resolved — all eleven decisions.** #6 any officer may approve;
>   #8 no enforced resolution deadline; #9 no restrictions on grant size or
>   authority; #10 self-grants allowed and visible. The first four share one
>   premise, and the consistency is the point: **the audit log and the ledger
>   are the control, not a gate.** Then #1 the leaderboard is public but carries
>   `robots: { index: false, follow: false }`, because a search cache outlives
>   the deploy that filled it; and #11 public standings are a single total with
>   attendance and bonus added silently — which **confirms §4.4 and closes the
>   contradiction that row had carried since v1.16**, when it still expected a
>   separate public column.
>
> **v1.19: Stage 4 is built and verified end-to-end against the local stack.**
> Officers sign in at `/admin/login`, run the whole schedule from `/admin/events`,
> and every mutation writes an `admin_audit` row. 97 tests across 6 files.
> Decisions made and now normative:
>
> - **Authorization is a Data Access Layer, not the proxy.** §5 said `proxy.ts`
>   checks the session *and* a matching `admin_profiles` row. Next 16's own
>   docs say Proxy "should not be used as a full session management or
>   authorization solution" and warn against database queries there, because it
>   runs on prefetches. **Resolution:** `proxy.ts` refreshes the session and
>   does an optimistic no-session redirect; `lib/auth.ts` (`getOfficer` /
>   `requireOfficer`) is the real check and runs in the shell layout, in every
>   page, and at the top of every Server Action. Server Actions POST to the
>   route they are rendered on, so a matcher change would otherwise silently
>   drop coverage — the per-action check is not belt-and-braces.
> - **`redirect()` must live outside the house try/catch.** It signals by
>   throwing `NEXT_REDIRECT`, which the standard action shape would otherwise
>   swallow into `{status:"error"}`. For the same reason admin actions call
>   `getOfficer()` and return an `unauthorized` state rather than
>   `requireOfficer()`.
> - **`app/actions/audit.ts` carries no `"use server"` directive.** Every export
>   of a `"use server"` module is a publicly callable endpoint, so a
>   client-reachable `writeAudit(actorId, …)` would let anyone forge audit rows
>   under any officer's name — inverting the §6 control. It is a plain module
>   guarded by `server-only`, at the path CLAUDE.md specifies.
> - **Audit writes are not atomic with their mutation, deliberately.**
>   PostgREST cannot transact across statements. On an audit-insert failure the
>   action logs loudly and still reports success, because the mutation really
>   did happen and reporting failure invites a duplicate retry. Recorded in §8;
>   the eventual fix is one plpgsql RPC per mutation.
> - **`/admin/login` sits outside an `app/admin/(shell)/` route group** whose
>   layout calls `requireOfficer()` — otherwise signing in is impossible. Route
>   groups do not appear in URLs, so §5's route table is unchanged.
> - **Officers are bootstrapped by `scripts/create-officer.mjs`**, not by a
>   seeded SQL script as §6 suggested: `supabase/seed.sql` is applied to the
>   *remote* by `scripts/seed-remote.sh` and this repository is public, so any
>   password there would be a published production credential. The script also
>   carries `--reset-password` (the v1 recovery path — self-serve reset needs
>   SMTP that does not exist) and `--revoke`, which deletes the
>   `admin_profiles` row but keeps the auth user, since `admin_audit.actor_id`
>   references it with no cascade. Revoking preserves history; deleting would
>   fail or erase it.
> - **The edit-impact confirmation is also optimistic concurrency.** The token
>   binds the proposed values to the row's `updated_at`, and that same raw
>   string backs the write as a compare-and-set. `updated_at` has microsecond
>   precision and must never be round-tripped through a JS `Date` — truncating
>   to milliseconds makes the CAS never match and every save report a phantom
>   conflict.
> - **Series publish is all-or-nothing, with a pre-flight.** One `UPDATE` is
>   one transaction, so a single collision rejects the whole batch — correct,
>   but opaque. `findWindowConflicts()` names the colliding occurrence before
>   the attempt, and the officer chooses between fixing it and publishing the
>   rest. The pre-flight is a UX affordance; the exclusion constraint remains
>   the guarantee.
>
> **v1.18: Stage 3 (attendance capture) is built, tested, and verified
> end-to-end locally.** `/attend` + the `submitCheckin` Server Action resolve
> submissions per §4.2/§4.3; all three §7 exit criteria were exercised through
> a real browser against the local stack. Decisions made and now normative:
>
> - **Test framework: Vitest.** The §7 resolution/dedupe/normalization cases
>   run as integration tests against the **local Supabase stack** with
>   timestamps injected into `open_event_at()`/`nearby_events()` — real
>   Postgres semantics, no clock mocking. 37 tests across 4 files.
> - **Duplicate rule** (§4.2 addendum): a submission is a duplicate iff
>   (a) a non-rejected row exists for the same `(event_id,
>   normalized_eid)` — the partial unique index, caught as 23505; or
>   (b) a non-rejected row exists for the same `(event_id, member_id)` after
>   member resolution — an application check closing the double-credit hole
>   the index cannot see, where the same member is reached via two different
>   raw IDs (email-matched typo, then the correct ID); or (c) the submission
>   is an orphan and a pending orphan with the same `normalized_eid`
>   exists within `ORPHAN_WINDOW_HOURS` — an application check, since the
>   index ignores `event_id is null` rows. A prior pending orphan **never**
>   blocks a new event-resolved submission: the new row inserts as `present`
>   and the orphan stays in the officer queue untouched. Rejected rows never
>   block re-entry. (Optional future hardening, deliberately not built: a
>   partial unique index on `(event_id, member_id)` to make check (b)
>   race-proof.)
> - **Member resolution runs on the orphan path too** — §4.2's order doesn't
>   condition on an open event, so a grace-window orphan also
>   matches-or-creates its member. A later-rejected orphan may leave a
>   `self_checkin` roster row behind; that is §6's roster-pollution row.
> - **Rate limiting** is a Postgres table (`checkin_throttle`), 30
>   submissions / 10 min per SHA-256-hashed IP, pruned opportunistically,
>   **failing open** so a throttle bug can never block a real check-in. No
>   external KV — a new service would violate §2.3 transferability. The limit
>   is generous on purpose: event-venue NAT puts a room of legitimate members
>   behind one IP; the honeypot and the 48-hour window bound are the primary
>   controls.
> - **Honeypot:** a hidden `website` field; when filled, the action returns
>   the same response as a legitimate off-window submission and writes
>   nothing — bots get no signal.
> - **`ORPHAN_WINDOW_HOURS` (48)** is exported once from `lib/checkin.ts` and
>   always passed explicitly to `nearby_events()`; the SQL-side `default 48`
>   is a fallback for ad-hoc SQL only.
> - **Grants migration** (`…000012`): newer Supabase stacks no longer
>   auto-grant DML on tables to the API roles — a fresh stack gives
>   anon/authenticated/service_role only TRUNCATE/REFERENCES/TRIGGER, so the
>   §2.3 handoff path (`create project → link → db push`) would produce a
>   silently broken database. The migration codifies the classic grants;
>   **RLS remains the security boundary**, and deny-all-until-Stage-8 still
>   holds because grants are not what does the denying.
> - The success screen shows the event title only — never a roster email or
>   EID (§6).

> **v1.17:** Stage 2's scope is now **recreating the existing Squarespace site**
> ([txmisa.org](https://www.txmisa.org/)) rather than writing a landing page
> from scratch — six pages, similar UI, its real copy, as the starting point
> for a later redesign. Surveyed into `docs/existing-site-inventory.md`, which
> is the reference for what was reproduced and what was deliberately left as a
> placeholder. This **widens §5's public route list**: `/about`, `/gallery`,
> `/officers`, `/projects`, and `/contact` join the landing page, all static
> content, none of them touching the database. The live upcoming-events section
> stays on the home page and remains the Stage 2 exit criterion — the old site
> has no equivalent, which is much of why this one exists.

> **v1.16:** Stage 2 landing page is live-reading the schedule. One RLS policy
> is **pulled forward from Stage 8**: `events_public_read` (migration
> `…000009`) grants anon/authenticated `select` on `events` where
> `status = 'published'` — exactly the §6 "published `events`" grant, landed
> early because the landing page is its first consumer. Everything else
> remains deny-all, and writes everywhere stay deny-all. Verified at the API
> boundary: the anon key sees all 13 published rows and neither the draft nor
> the cancelled seed event. Stage 0 scaffolding is gone (`app/db-check/`
> deleted; `_stage0_check` dropped in migration `…000010`). Landing-page copy
> is still bracketed placeholder text awaiting real content from officers.

> **v1.15:** Every §2.4/§2.5 account item is now closed. Org-wide 2FA is
> **enabled and verified**, with both Owners confirmed still present afterwards
> — the check that matters, since enabling the requirement removes
> non-compliant members. §2.5's three conditions are met: the vault is a
> Bitwarden *organization* rather than a personal account, the plaintext
> database-password file is deleted, and Bitwarden's own recovery path is not
> the MISA mailbox it protects. Those three are officer-attested rather than
> machine-verifiable, so §2.5 asks for them to be re-confirmed at handoff.

> **v1.14:** §2.5 is **no longer an open decision** — Bitwarden is chosen, and
> holds the GitHub 2FA recovery codes and the Supabase database password; §2.4's
> inventory is filled in accordingly. Two follow-ups are called out rather than
> assumed: the vault must be a Bitwarden *organization* rather than a personal
> account, and the original plaintext password file must be deleted, since
> copying is not moving. §2.4 also records the trap that cost three attempts:
> `two_factor_requirement_enabled` is **read-only** in the REST API, so a PATCH
> reports success and changes nothing. The org 2FA requirement can only be set
> in the web UI.

> **v1.13:** §2.4 corrected: both org accounts now have 2FA, so the blocker
> named in v1.12 is cleared. The org-level `two_factor_requirement_enabled`
> flag is nonetheless still `false` — recorded with the instruction to read the
> PATCH output rather than assume it applied, since GitHub's refusal is silent
> in the sense that it changes nothing.

> **v1.12:** Org base permission is now `read` (§2.4 satisfied). Org-wide 2FA
> was attempted and **refused by GitHub**, because the shared mailbox account
> `TXMISA-JD` has no 2FA. The important consequence is recorded in §2.4:
> enabling 2FA on that account is **gated on the §2.5 vault decision**, since
> it is the recovery root for every other service and its recovery codes cannot
> live inside itself. §2.5 is therefore a prerequisite for closing the org's
> weakest link, not a Stage 9 nicety.

> **v1.11:** §2.4 updated against the live org. The "keep two GitHub org
> Owners" mitigation is **satisfied** — `Texas-MISA` has two Owners,
> `TXMISA-JD` and `cgonztx-gif` — so the single-point-of-failure §2.4 called
> out is closed. Adds a third mitigation in its place: **org-wide 2FA is
> currently off**, which matters more now that two accounts hold admin over a
> public repo and the deploy pipeline. Note the ordering trap — enabling the
> org requirement removes members who do not already have 2FA on.

> **v1.10:** Records the function-region decision now implemented (§2, new
> §2.6): Vercel Functions are pinned to `cle1`, which *is* AWS us-east-2 — the
> same region as the Supabase project — so functions are co-located with the
> database rather than merely near Austin. Declared in `vercel.json` rather
> than the dashboard, because a dashboard-only value does not survive the §2.3
> `create project → link → db push` handoff. Also confirms the §6 preview-write
> risk is mitigated: Deployment Protection is verified at **Standard
> Protection** by response behaviour, not by dashboard label.

> **v1.9:** §4 reconciled with the migrations that were actually built.
> Check-in windows are **half-open** in both `open_event_at()` and a new
> exclusion constraint, so back-to-back events are publishable;
> `nearby_events()` gains a third `case` branch so a concurrent event has a
> zero gap rather than a negative one. `supabase/migrations/` is now stated to
> be the authority over §4.1. The §6 append-only claim is qualified: triggers
> bind the app and client roles, not a table owner.
>
> **v1.8:** terms are **derived from dates, never typed** (§4.7).
> `events.term` is a generated column producing `'Fall 2026'` / `'Spring 2027'`
> from `starts_at`, anchored to America/Chicago, with half-open boundaries at
> Aug 1 and Jan 1. Leaderboard rollover is therefore automatic;
> `app_settings.current_term` becomes a nullable override.
>
> **v1.7:** the leaderboard is **one row per member for the current term,
> showing only `total_points`** — no attendance/bonus split, ties alphabetical.
> This reverses the split-column argument earlier versions made; §4.4 records
> what it costs and where the oversight moved. New `app_settings` table holds
> `current_term`, which both `leaderboard` and `member_directory` scope to.
>
> **v1.6:** the five schema-affecting open decisions are resolved (§9) and §4
> updated to match. The roster **self-registers with no officer confirmation**;
> `members` gains `normalized_eid` and `source`.
>
> **v1.5:** §2.3 now covers Supabase account moves alongside Vercel's. Added
> §2.4 (account inventory — what exists, who owns it, where credentials are)
> and §2.5 (credential storage, an open decision for Stage 9). Flags the two
> live single points of failure: the MISA email as universal recovery
> address, and a sole GitHub org Owner.
>
> **v1.4:** added §2.3 — account ownership and transferability. Services live
> under a dedicated org identity; every service is also individually
> transferable, and the database is disposable by design (schema as
> migrations in the repo). The repo now lives in the `Texas-MISA` GitHub org
> and is public — officers use their own accounts as org members, which is
> the preferred pattern over a shared login wherever a service supports it.
>
> **v1.3:** the build landed on Next.js 16, which renames the `middleware.ts`
> file convention to `proxy.ts` (exported function `proxy()`). References
> updated in §5, §7, and §10. The gating logic is unchanged.

---

## 1. Purpose

A single web application that replaces spreadsheet-based attendance tracking for a student organization with a self-service, auditable system.

The application serves three audiences from one codebase:

| Audience | What they do | Auth required |
|---|---|---|
| **Prospective / general public** | Learn what the org is, when it meets, how to join | No |
| **Members** | Check in at events, view the leaderboard, look up their own attendance history | No (identity-based, not password-based) |
| **Officers / admins** | Create the event schedule, manage the member roster, review and correct attendance | Yes |

### 1.1 Problem being solved

Spreadsheet-based tracking breaks down at three points: manual event-to-timestamp matching is error-prone, members have no way to check their own standing without asking an officer, and the sheet's formula logic becomes fragile as it accumulates edge cases. This system moves that logic into a database with constraints, so bad data is rejected at write time rather than patched later.

### 1.2 Success criteria for v1

- A member can check in at an event in under 20 seconds on a phone, without an account.
- An officer can publish next month's schedule in one sitting.
- Attendance is automatically attributed to the correct event with zero manual matching in the common case.
- A check-in submitted outside its event window is never lost — it lands in a review queue an officer can resolve in a few clicks.
- A member can see their own attendance record without contacting anyone.
- Total recurring infrastructure cost: **$0**, excluding an optional domain (~$12/year).

### 1.3 Explicit non-goals for v1

Scoping these out keeps v1 shippable. They are candidates for later stages, not omissions:

- Member accounts with passwords
- **Payment *processing* for dues** — no card details, no bank details, and no money moving through this system at any point. Dues are paid in Venmo and the site *reconciles* what arrived (§7 Stage 6.5, v1.34). The distinction is load-bearing in two other places: §2.2's Vercel Hobby commercial-use clause, and §6's threat-model boundary.
- Email/SMS notifications
- Native mobile app
- Public-facing officer directory or blog/CMS

---

## 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | Next.js (App Router) | First-class Vercel deployment; Server Components and Server Actions let attendance logic run server-side without a separate API service |
| **Language** | TypeScript | Generated Supabase types give end-to-end type safety from Postgres schema to React props |
| **Styling** | Tailwind CSS | Fast iteration, no separate stylesheet to maintain, good defaults for responsive/mobile-first work |
| **Database** | Supabase (Postgres) | Relational model fits the domain (members ↔ events ↔ attendance); real constraints and views instead of application-layer validation |
| **Auth** | Supabase Auth | Admin-only; email/password or magic link. Integrates natively with Row Level Security |
| **Authorization** | Postgres Row Level Security | Security enforced at the data layer, so a frontend bug cannot leak or corrupt data |
| **Hosting (frontend)** | Vercel | Free hobby tier, preview deploys per branch, automatic HTTPS |
| **Version control / CI** | GitHub + Vercel Git integration | Push to `main` deploys production; PRs get preview URLs |

### 2.1 Why this stack over alternatives

- **vs. Firebase:** the data is inherently relational and the reporting is aggregate-heavy (counts, rankings, joins across three tables). Postgres does this in a view; a document store makes you do it in application code.
- **vs. a Google Sheets + Apps Script upgrade:** no real access control, no schema constraints, and no clean public-facing UI.
- **vs. Django/Rails + managed Postgres:** more capable, but requires a paid always-on host and adds an operational surface the next officer would have to inherit.

### 2.2 Cost model and capacity

| Service | Tier | Relevant limits | Projected usage |
|---|---|---|---|
| Vercel | Hobby (free) | 100 GB bandwidth/mo | Well under |
| Supabase | Free | 500 MB database, 50k MAU | Well under — a few hundred members and a few thousand attendance rows per year is a few MB |
| Domain | Optional | — | ~$12/year |

**Note on the Supabase free tier:** projects pause after a period of inactivity and need a manual resume from the dashboard. For an org with events during the semester this is rarely an issue, but plan a wake-up check before the first meeting of each semester. This is the single most likely operational surprise.

#### The worst-case capacity check (v1.31)

Run against a deliberately pessimistic year: **500 registered members, 3 events a week, 150 attendees at every one of them.** Roughly triple the org's current size and cadence.

**Conclusion: no service tier needs upgrading, and it is not close.** But four *application* ceilings are crossed at those numbers, two of them silently, so "can we afford it" and "does it work" have different answers. That is the finding worth carrying — the constants below were each sized against a smaller room and none of them announce themselves when exceeded.

| Limit | Headroom at 500 / 450-per-week |
|---|---|
| Supabase database — 500 MB | ~13,500 attendance rows/year at roughly half a KB with indexes is **~7 MB/year**; add members, events, adjustments and audit and call it 10–15 MB. Decades of headroom. |
| Supabase MAU — 50k | **~13, and it does not grow with the roster.** MAU counts Supabase *Auth* users, and members have no accounts (§3) — only officers sign in. This is the limit people assume they will hit and the one the design has already removed. |
| Supabase egress — 5 GB/mo | Small payloads throughout; the directory is paginated at 25 and the largest single response in the system is a full-roster export measured in tens of KB. |
| Vercel bandwidth / invocations | ~2,000 check-ins a month plus casual browsing — single-digit GB, tens of thousands of invocations. **Verify against the dashboard's usage page rather than a remembered number:** Vercel restructured Hobby around Fast Data Transfer, edge requests, and Fluid Active CPU, and the allowances have moved. |
| Peak load | 150 submissions inside ten minutes is ~0.25 req/s average and maybe 5–10/s at the door, each a small indexed lookup. Not a concern on the free instance. |

**What actually breaks, in order:**

1. 🔴 **`RATE_LIMIT_MAX = 90` per IP per 10 minutes fails at exactly this size.** A venue's WiFi puts the whole room behind one address, so the 91st person through the door is refused. The constant's own comment says it is "sized for the room" — the room it was sized for was about ninety people. At a recruiting event it is half that, because a first-timer spends two slots (submit, then confirm). Staggered arrivals soften it in practice; as a worst case it is a hard wall. It fails *open* on error, so only the limit working correctly turns anyone away.
2. 🔴 **`MEMBER_SCAN_LIMIT = 400` is below 500 and truncates silently.** The roster scan feeding the resolution form, manual entry, the grant picker, and the near-miss ranker takes the first 400 active members and reports nothing. The candidate query does not even order, so it is an arbitrary 400 of 500. **`pg_trgm` is the documented growth path and 500 members crosses into it.**
3. 🟡 **`MAX_GRANT_MEMBERS = 50`** turns crediting a 150-person event into three grants. It refuses rather than truncating (§9's rule for oversized selections), so it is friction, not a defect.
4. 🟡 **Near-miss ranking gets denser with the roster.** EIDs are name-derived, so the distance-2 population scales with membership — the exact load the `MIN_SUGGESTION_SCORE` floor carries. At 500 the floor is doing more work than the calibration it was set against, and recalibration is empirical (§7's stage trap), not arithmetic.

Two already-recorded items that this scenario makes concrete rather than hypothetical: the hosted PostgREST row cap, which a 500-row export can brush where the local stack has none; and the free-tier pause, irrelevant at three events a week during term and certain every summer.

**One non-technical limit worth knowing:** Vercel Hobby prohibits commercial use. A student org is fine, and stays fine right up until the site **handles** dues, ticketing, or sponsorship — at which point the constraint is the plan's terms, not any of the numbers above.

**Stage 6.5 walks up to that line without crossing it, and it is worth being precise about why** (v1.34). Recording that a payment arrived is not handling a payment. No card or bank details enter the system, no money moves through it, and there is no checkout: dues are paid in Venmo, and the site reconciles a CSV statement after the fact. The clause bites the day this site takes a payment — a Stripe button, a ticketing flow — not the day it reads a spreadsheet about one. Keep the distinction in mind if in-app payment ever gets proposed (§7 Stage 10 lists it as deliberately out of scope); that proposal is a plan change as much as a feature.

### 2.6 Function region

Vercel Functions default to `iad1` (us-east-1, Washington DC) for all new projects. This project pins them to **`cle1`**, whose AWS region is **us-east-2 (Cleveland)** — the *same* region as the Supabase project. Every Server Component read and Server Action write therefore talks to the database within one region instead of across two, which matters because the attendance path is chatty and §1.2 budgets a check-in at under 20 seconds on a phone.

Note that "closest to Austin" is the wrong way to frame this: what the latency budget cares about is the function-to-database hop, not the user-to-function hop. Static assets are served from the nearest of Vercel's PoPs regardless of function region, so users far from Ohio are not penalised for this choice.

The region is declared in **`vercel.json`**, not in the dashboard's Settings → Functions:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["cle1"]
}
```

This is deliberate. A dashboard-only setting is invisible to the repository and is silently lost when the project is recreated — which is exactly the handoff path §2.3 depends on. In `vercel.json` it is version-controlled and travels with the code.

Two constraints worth knowing before changing it: the Hobby plan allows a **single** function region (Pro allows 5), and a deployment requesting more regions than the plan permits **fails before the build step**. `functionFailoverRegions` is Enterprise-only and is not used here. Because this is build-time configuration, editing `vercel.json` changes nothing until the next deployment.

### 2.3 Account ownership and transferability

Officers turn over every year, so every account this project depends on must be either handed over or moved without rebuilding anything. Current policy: **the services live under a dedicated org identity** (a shared org email, not any individual's), so the common handoff is transferring that login. GitHub is the exception and the better model — a real GitHub *organization*, where each officer uses their own account and membership is granted and revoked, so there is no shared login to hand over at all. Prefer that pattern wherever a service supports it.

The dedicated account itself may need to move someday — a compromised email, a change in org structure — so the per-service transfer paths matter too:

| Service | Handoff via shared login | Transfer between accounts | Notes |
|---|---|---|---|
| GitHub | ✔ | ✔ Settings → Transfer ownership; history, issues, and redirects preserved | **Done:** the repo lives in the `Texas-MISA` org and is public. Handoff = add the next owner, remove the last; no transfer needed. Public also sidesteps Vercel Hobby's restriction on deploying *private* org-owned repos. Officers work through their own GitHub accounts as org members, so no shared GitHub login exists or is needed. |
| Supabase | ✔ | ✔ Three ways, see below | Project `misa-website`, ref `gbxypeofjnhrhotlhyzs`, region us-east-2. Or skip transfer entirely: the database is **disposable by design** — see below. |
| Vercel | ✔ | ✔ Three ways, see below | Currently the MISA email's personal **Hobby** account (`txmisa-jds-projects`) — Vercel Teams are Pro-only, so there is no org-level scope on the free tier. This is therefore a shared-login handoff, unlike GitHub. |
| Domain | ✔ (registrar login) | ✔ Registrar transfer: unlock + auth code, takes days | Slowest to move; keep the registrar login in the shared credentials, or leave it and re-point DNS. |

**Moving Vercel off a given email**, in order of preference:

1. **Change the email on the account.** Account Settings → email. Project, env vars, domains, deployment history, and the git connection all stay put; only the login identity changes. No migration at all, and the right answer when the goal is just "stop tying this to that mailbox."
2. **Transfer the project.** Project Settings → Advanced → Transfer Project. Clean when the destination is a Vercel *team*; personal-to-personal is the awkward case on the free tier, since Teams are Pro-only.
3. **Re-import.** Always works. A successor imports the repo and recreates 6 environment variables (2 values × production/preview/development). Do it with the CLI, not the dashboard — see the env-var warning below. What is lost: deployment history, logs, analytics, and possibly the `*.vercel.app` subdomain if the name is contested. A custom domain moves by removing it from the old project and adding it to the new, with DNS unchanged.

**Moving Supabase off a given email**, same shape as Vercel:

1. **Change the email on the account** — Account Settings. Keeps the project, its ref, all keys, and the database untouched. Simplest when the mailbox is the only thing changing.
2. **Transfer the project** — Project Settings → General → Transfer project. The receiving organization needs a free-tier slot available (the free tier allows 2 active projects per account, which is what forced the dedicated account in the first place).
3. **Recreate from migrations** — see the disposable-database paragraph below. Always available, and the fallback if the other two are blocked.

CLI access is separate from dashboard access: `supabase login` stores a token per profile (`--profile <name>` keeps multiple accounts side by side; the token itself lives in the OS keyring, not in the repo). A successor runs `supabase login` and `supabase link --project-ref <ref>` and is current — nothing about the CLI needs transferring.

**Manage Vercel environment variables through the CLI, not the dashboard.** They are stored encrypted and cannot be read back — `vercel env pull` returns empty strings for them — so a dashboard edit is a blind write over state nobody can inspect. Use `vercel env rm` followed by `printf '%s' "$VALUE" | vercel env add NAME <env>`, which also avoids invisible characters from copy-paste. Note that `NEXT_PUBLIC_*` values are inlined at build time, so any change requires a redeploy, not a restart.

**The database is disposable, and must stay that way.** Because the full schema lives in `supabase/migrations/` and `seed.sql` in the repo, a brand-new database is: create project → `supabase link` → `db push` → update two env vars. Past years' data is not operationally needed — export tables to CSV (or `pg_dump`) for the archive before decommissioning, and start clean. This is the escape hatch if a transfer is ever awkward, and it only works under one discipline: **never change the schema through the dashboard SQL editor without capturing the change as a migration file.** The moment the live database and `migrations/` drift, the database stops being recreatable. (Within a school year, prefer the `term` column for resets — a new database is for handoffs and fresh starts, not semesters.)

### 2.4 Account inventory

Every account the project depends on. "The shared login" is not an actionable handoff instruction unless this table is filled in and current.

| Account | Identity | What it controls | Credentials live |
|---|---|---|---|
| MISA email | shared org mailbox | The recovery address for every account below — the root of the whole tree | Bitwarden (§2.5) |
| GitHub org `Texas-MISA` | two Owners: `TXMISA-JD` (MISA email) and `cgonztx-gif` (officer personal account); further officers join as members with their own accounts | The repository | No shared login; membership only |
| Supabase | MISA email | Project `misa-website` / `gbxypeofjnhrhotlhyzs`, us-east-2 | Bitwarden (§2.5) |
| Supabase database password | — | `db push`, direct Postgres connections | Bitwarden (§2.5); the original plaintext file is deleted |
| Vercel | MISA email, personal Hobby account `txmisa-jds-projects` | Hosting, env vars, domain binding | Bitwarden (§2.5) |
| Domain registrar | not yet purchased (Stage 9) | DNS | Bitwarden (§2.5), once purchased |

**The MISA email is the single point of failure.** It is the password-reset address for everything else, so losing it is materially worse than losing any individual service. Two mitigations, both cheap:

- **Keep at least two GitHub org Owners** — the MISA account plus one current officer's personal account. GitHub requires an owner to administer an org, and an org whose only owner is an inaccessible mailbox needs a slow manual support process to recover. ✅ **Satisfied July 2026:** `Texas-MISA` has two Owners, `TXMISA-JD` (the MISA email) and `cgonztx-gif` (an officer's personal account) — verified via `gh api /orgs/Texas-MISA/members?role=admin`. This was previously the one live single point of failure; it is now closed. Re-check at every officer turnover, since the graduating officer's personal account must be replaced, not merely removed.
- **Require 2FA org-wide.** ✅ **Enabled and verified July 2026** — `two_factor_requirement_enabled` reads `true`, both Owners survived the change, and `filter=2fa_disabled` returns 0. Verified explicitly rather than assumed, because enabling the requirement *removes* non-compliant members.
  - 🪤 **`two_factor_requirement_enabled` is read-only in the REST API.** It appears in the *response* schema of `GET /orgs/{org}` but is **not** a settable body parameter of `PATCH /orgs/{org}`. A PATCH sending it returns **success while changing nothing** — no error to notice, no effect. Three attempts were spent on this before it was root-caused. **The web UI is the only route:** Organization settings → **Authentication security** → *Require two-factor authentication…*
  - Consequence for onboarding: a prospective officer without 2FA **cannot join** while the requirement is on. Check `filter=2fa_disabled` when an invitation appears not to land.
- **The recovery codes for that 2FA must live outside the account they protect.** `TXMISA-JD` is the recovery root for Supabase, Vercel, and the registrar, so 2FA bound only to one person's phone makes handoff strictly worse — the exact failure §2.5 describes. Resolved: the codes are in the §2.5 Bitwarden vault, which is what made enabling 2FA on the mailbox account safe to do.
- **Store 2FA recovery codes wherever the passwords are stored.** The standard student-org failure is a shared account with 2FA bound to one person's phone, and that person graduates. Recovery codes are what make the account survivable; a password alone is not enough.

### 2.5 Credential storage — Bitwarden

**Decided July 2026: Bitwarden.** A vault exists and holds the GitHub 2FA recovery codes and the Supabase database password. This closes what earlier versions left open, and it is what made enabling 2FA on the shared mailbox account safe (§2.4).

Three conditions were required for this to meet the requirements below, and all three are confirmed:

1. **It is a Bitwarden *organization*, not a personal vault** — two users, shared collections. This is the condition that matters most: a personal Bitwarden account would fail "survives one person graduating" and "can be handed to a successor as a unit" just as surely as a plaintext file, since the credentials would merely have moved from one individual's laptop to one individual's account.
2. **The plaintext database-password file is deleted.** Copying into the vault is only half of "move"; leaving the original would have left the original exposure intact.
3. **Bitwarden does not use the MISA email as its own recovery path**, which matters because the vault holds that mailbox's 2FA recovery codes. A vault whose recovery depends on an account it protects is circular — the same trap this section rules out for storing codes inside the Google account.

These three are attested by the officer rather than machine-verifiable, unlike the GitHub and Vercel state elsewhere in §2.4. **Re-confirm all three at handoff**, since a successor inherits them unverifiable.

What must be stored, for each account: the login email, the password, the 2FA recovery codes, and a one-line note on what breaks if it is lost. Plus the Supabase database password, which is not recoverable from any dashboard — only resettable.

What must **not** be stored there, because it is already in the repo or regenerable: the Supabase anon/publishable key (public by design, §6), the project ref, and anything in `.env.example`.

Requirements the vault has to meet: survives one person graduating, is not tied to a personal device, and can be handed to a successor as a unit. A shared password manager (Bitwarden's free org tier, or 1Password's student-org plan) meets all three. Storing everything inside the MISA Google account is simpler but circular — that account is the recovery path for the others, so it cannot also be the place its own recovery codes live.

Until this is resolved, the Supabase database password sits in a plaintext file on one laptop, which fails all three requirements.

The Stage 9 handoff guide should amount to: §2.4 filled in, the vault handed over, and a pointer to this section.

---

## 3. System Architecture

```
                       ┌─────────────────────────────┐
   Public visitor ────▶│  Next.js on Vercel          │
   Member         ────▶│  ├── Server Components      │
   Officer        ────▶│  ├── Server Actions         │
                       │  └── Route Handlers         │
                       └──────────────┬──────────────┘
                                      │
                       ┌──────────────┴──────────────┐
                       │  Supabase                   │
                       │  ├── Postgres + RLS         │
                       │  ├── Auth (admins only)     │
                       │  └── Views & SQL functions  │
                       └─────────────────────────────┘
```

**Key architectural decision:** all writes go through Server Actions or Route Handlers using the service role or an authenticated session — never from the browser with elevated keys. The browser only ever holds the anon key, and the anon key's permissions are defined by RLS policies that assume it is hostile.

---

## 4. Data Model

### 4.1 Tables

> **`supabase/migrations/` is the authority; this section is the readable
> version.** The schema below is implemented and verified. The migrations add
> detail deliberately left out here to keep it legible: indexes supporting the
> review queue and directory filters, not-blank checks on required text (a bare
> `not null` accepts `''`), an `updated_at` trigger on `events`, append-only
> triggers on `admin_audit`, and `enable row level security` on every table —
> deny-all until the policies land in Stage 8, with one deliberate exception:
> `events_public_read` (anon `select` on published events only) landed in
> Stage 2 because the landing page needs it — it is the §6 grant, not a new
> surface. If the two ever disagree, the migrations are right and this
> section is stale.

```sql
-- Roster. Seeded by admins, and also self-populating: an unrecognized student
-- ID at check-in creates a member immediately, with no officer confirmation
-- (Open Decision #2, resolved). See 4.2 for how typos are contained.
create table members (
  id           uuid primary key default gen_random_uuid(),
  eid   text not null,
  -- Folded to LOWER, not upper (migration 16). EIDs are conventionally
  -- lowercase, and a review screen that shouts ABC1234 back at someone who
  -- typed abc1234 reads as a correction that was never made. The whitespace
  -- and hyphen stripping is vestigial — real EIDs contain neither — but it
  -- still catches pasted junk and removing it would rewrite every stored value.
  normalized_eid text generated always as
                 (lower(regexp_replace(eid, '\s|-', '', 'g'))) stored,
  full_name    text not null,
  email        text not null,
  active       boolean not null default true,
  source       text not null default 'admin'
                 check (source in ('admin','self_checkin')),
  joined_at    timestamptz not null default now(),
  -- Officer notes, shown on the member detail page (§7 Stage 6). Nullable and
  -- unconstrained: there is no meaningful empty-string state, so a not-blank
  -- check would only force callers to send null for the same meaning.
  notes        text,
  -- Officer-defined field values (migration 18), a flat key → option-text map
  -- keyed by member_field_definitions.key. JSONB rather than columns so
  -- PostgREST can order by `custom_fields->>key` — see 4.5 and §7 Stage 6.
  -- A missing key is SQL NULL and means "no answer"; nothing here ties a value
  -- to its definition's option list, deliberately (§7 Stage 6, phase 4).
  custom_fields jsonb not null default '{}'
                 check (jsonb_typeof(custom_fields) = 'object'),
  -- The compare-and-set token, added in migration 18 because nothing edited a
  -- member until custom fields did. Row-level, so every inline cell and the
  -- notes editor on one row post the same value back.
  updated_at   timestamptz not null default now()
);

-- Identity is the normalized ID, not the raw one, so 'ut-123', 'UT 123', and
-- 'UT123' cannot become three members. Email is matched case-insensitively
-- for the same reason.
create unique index members_normalized_id on members (normalized_eid);
create unique index members_email_lower   on members (lower(email));
create index members_custom_fields_gin on members using gin (custom_fields);

-- The schedule. Created in advance, but editable at any time — see 4.6.
create table events (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  location           text,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  checkin_opens_at   timestamptz,   -- defaults to starts_at if null
  checkin_closes_at  timestamptz,   -- defaults to ends_at if null
  points             integer not null default 1,
  category           text,          -- 'general_meeting' | 'workshop' | 'social' | 'flagship' | ...
  -- Derived from starts_at, never set by hand. See 4.7.
  term               text generated always as (term_of(starts_at)) stored,
  status             text not null default 'draft'
                       check (status in ('draft','published','cancelled')),
  series_id          uuid,          -- groups events created as a recurring batch
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint valid_window check (ends_at > starts_at)
);

-- One row per check-in. Stores the raw submission alongside the resolved links.
-- Both foreign keys are nullable: a submission that matches no open event and/or
-- no roster member is still captured, as 'pending', for an officer to resolve.
create table attendance (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid references events(id) on delete set null,
  member_id            uuid references members(id) on delete set null,
  submitted_name       text not null,
  submitted_eid text not null,
  normalized_eid text generated always as
                         (upper(regexp_replace(submitted_eid, '\s|-', '', 'g'))) stored,
  submitted_email      text not null,
  submitted_at         timestamptz not null default now(),
  source               text not null default 'self_checkin'
                         check (source in ('self_checkin','admin_manual')),
  status               text not null default 'pending'
                         check (status in ('present','pending','rejected')),
  resolution_note      text,
  resolved_by          uuid references auth.users(id),
  resolved_at          timestamptz,
  -- Concurrency anchor for the review screens, not a fact about the
  -- submission — submitted_at and resolved_at are the facts. Two officers can
  -- have the same pending row open; without this, both assigning a different
  -- event succeeds and the later write silently wins. resolved_at can't serve
  -- the purpose: it is null for exactly the rows that need guarding.
  updated_at           timestamptz not null default now(),
  -- A row may only count toward the leaderboard once both links are resolved.
  constraint present_requires_resolution check (
    status <> 'present' or (event_id is not null and member_id is not null)
  )
);

-- Reuses the schema-wide trigger function defined with events.
create trigger attendance_set_updated_at
  before update on attendance
  for each row execute function set_updated_at();

-- Prevents double credit for the same person at the same event, including when
-- an officer manually assigns an orphan to an event the member already attended.
-- Partial so that rejected rows don't block a corrected re-entry.
create unique index attendance_one_per_event
  on attendance (event_id, normalized_eid)
  where event_id is not null and status <> 'rejected';

-- Discretionary points awarded outside of event attendance: volunteering,
-- recruiting, competition placements, or corrections. Negative values allowed.
create table point_adjustments (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  points      integer not null check (points <> 0),
  reason      text not null,
  category    text not null default 'other'
                check (category in ('volunteer','recruitment','competition','leadership','correction','other')),
  event_id    uuid references events(id) on delete set null,  -- optional context
  -- Defaulted, not generated: a grant made in Spring for Fall work belongs to
  -- the term it credits, so officers can override. See 4.7.
  term        text not null default current_term(),
  awarded_by  uuid not null references auth.users(id),
  awarded_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references auth.users(id),
  void_reason text,
  constraint void_is_complete check (
    (voided_at is null and voided_by is null) or
    (voided_at is not null and voided_by is not null)
  ),
  -- 4.2 argues a void is itself a recorded action with its own reason, but
  -- void_is_complete only pairs voided_at with voided_by. Written as an
  -- equality of null-ness so it also rejects a reason left on a live row.
  constraint void_requires_reason check (
    (voided_at is null) = (void_reason is null)
  )
);

-- No updated_at here, deliberately. An adjustment is immutable except for
-- voiding, and voiding is one-way, so `.is("voided_at", null)` on the UPDATE is
-- already a complete concurrency guard: zero rows back means someone voided it
-- first. The asymmetry with attendance is intentional.

-- Dues payments, reconciled from Venmo statement CSVs (§7 Stage 6.5). One row
-- per transaction in the statement. This is the only source of membership
-- status: 4.5's dues_paid_current_term is derived from these rows and nothing
-- else, which is why a hand-ticked "Paid Dues" custom field is forbidden by
-- the reserved-key check below.
--
-- Shape is the union of the two patterns already here: editable like
-- attendance (the parser can attribute a payment wrongly, and correcting that
-- is legitimate) and voidable like point_adjustments (money arriving is not
-- erasable, so a void is one-way and carries a reason).
create table dues_payments (
  id             uuid primary key default gen_random_uuid(),
  -- Venmo's own transaction id, and the entire de-duplication story. Officers
  -- upload overlapping statements on purpose to keep the data fresher than
  -- monthly, so a payment is seen many times and must be stored once. Order
  -- and upload count do not matter: re-importing is a no-op.
  --
  -- A fingerprint over (datetime, amount, payer, note) is NOT an acceptable
  -- substitute — two members can send the same amount in the same minute, and
  -- collapsing them silently loses a payment somebody made.
  venmo_txn_id   text not null,
  -- Null means the note resolved to no member, or to more than one. Such a row
  -- is stored and queued, never discarded (4.2), and never creates a member.
  --
  -- RESTRICT, not CASCADE, diverging from point_adjustments on purpose: this
  -- row records that money arrived, and losing it because a member row went
  -- away is the wrong trade. It also makes the merge tool (§7 Stage 6 phase 8)
  -- fail loudly if it forgets to repoint dues alongside attendance and points.
  member_id      uuid references members(id) on delete restrict,
  paid_at        timestamptz not null,
  -- Cents, never a float, and never a numeric the app might round differently
  -- from Postgres. Positive only: a refund is a void with a reason, not a
  -- negative payment (the asymmetry with point_adjustments is deliberate —
  -- points are a score, this is a receipt).
  amount_cents   integer not null check (amount_cents > 0),
  note           text,
  -- From the statement, and the only way an officer can reconcile a payment
  -- whose note carried no usable EID. See §6 for what storing it costs.
  payer_name     text,
  payer_handle   text,
  -- The token parsed out of the note, stored raw beside its fold, exactly as
  -- attendance stores submitted_eid beside normalized_eid. Same expression as
  -- members.normalized_eid, because the match is an equality against it.
  submitted_eid  text,
  normalized_eid text generated always as
                 (lower(regexp_replace(coalesce(submitted_eid, ''),
                                       '\s|-', '', 'g'))) stored,
  -- Which term the payment starts covering. Defaulted from term_of(paid_at),
  -- not generated, because an officer must be able to override it: 4.7's
  -- boundaries put summer in Spring, so a July payment for the coming year
  -- would otherwise buy a term that is nearly over.
  start_term     text not null default term_of(now()),
  -- NULLABLE, and that is the whole review mechanism — null means "no officer
  -- has decided how many terms this bought". An amount matching neither
  -- configured price (someone tipped, someone covered a friend, someone
  -- underpaid) parses fine, links to its member, and waits. A status enum
  -- would be a second way to say the same thing.
  terms_covered  smallint check (terms_covered is null
                                 or terms_covered between 1 and 4),
  -- Generated, so a row awaiting a decision covers nothing and counts for
  -- nothing. terms_from() is immutable — see 4.7.
  covered_terms  text[] generated always as
                 (terms_from(start_term, terms_covered)) stored,
  -- Which uploaded statement this arrived in, so a bad import is reviewable
  -- and bulk-voidable in one action without a staging table.
  import_batch_id uuid not null,
  imported_by    uuid not null references auth.users(id),
  imported_at    timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid references auth.users(id),
  void_reason    text,
  -- Written as an equality of null-ness, matching point_adjustments'
  -- void_requires_reason, so it also rejects a voided_by left behind on a row
  -- that is not voided.
  constraint dues_void_is_complete check (
    (voided_at is null) = (voided_by is null)
  ),
  constraint dues_void_requires_reason check (
    (voided_at is null) = (void_reason is null)
  ),
  -- Editable, unlike a point adjustment, so it needs a real CAS token.
  updated_at     timestamptz not null default now()
);

-- The dedupe. Spans voided rows on purpose: re-importing a statement whose
-- payment an officer already voided must stay a no-op, not resurrect it.
create unique index dues_payments_txn_idx     on dues_payments (venmo_txn_id);
create index dues_payments_member_idx  on dues_payments (member_id);
create index dues_payments_covered_idx on dues_payments using gin (covered_terms);
create index dues_payments_batch_idx   on dues_payments (import_batch_id);
-- The needs-review queue: unmatched, or matched but undecided.
create index dues_payments_review_idx on dues_payments (imported_at desc)
  where voided_at is null and (member_id is null or terms_covered is null);

-- Single append-only audit log across every entity an officer can modify.
-- Replaces the attendance-specific table from v1.1: event edits and point
-- grants need the same accountability, and three parallel tables would drift.
create table admin_audit (
  id          bigserial primary key,
  entity_type text not null
                check (entity_type in ('attendance','event','member',
                                       'point_adjustment','roster',
                                       'member_field','dues_payment')),
  entity_id   uuid not null,
  actor_id    uuid not null references auth.users(id),
  acted_at    timestamptz not null default now(),
  action      text not null,
  before      jsonb,
  after       jsonb,
  note        text
);

create index admin_audit_entity_idx
  on admin_audit (entity_type, entity_id, acted_at desc);
create index admin_audit_actor_idx
  on admin_audit (actor_id, acted_at desc);

-- Single-row settings table. `current_term` is an OVERRIDE: null means
-- "whatever term_of(now()) says", which is the normal state. Officers pin it
-- only to hold the board on a finished term — see 4.7.
create table app_settings (
  id           boolean primary key default true check (id),
  current_term text,
  -- Dues prices, in cents (§7 Stage 6.5). Configurable rather than constants
  -- because they change between years and a hardcoded 30/50 becomes a
  -- migration the day the org raises them.
  --
  -- Read at IMPORT time only. terms_covered is stored on the payment row, so
  -- raising the price never rewrites what last year's payments bought — and
  -- re-importing an old statement after a change would land differently,
  -- which is one more reason the dedupe has to hold.
  dues_one_term_cents  integer not null default 3000 check (dues_one_term_cents  > 0),
  dues_two_term_cents  integer not null default 5000 check (dues_two_term_cents  > 0),
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

-- Officer accounts, keyed to Supabase Auth users.
create table admin_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'officer'
                 check (role in ('officer','admin'))
);
```

### 4.2 Design notes

- **Nothing that resolves to a known member is ever dropped on the floor.** `attendance` stores the raw submission *and* the resolved links separately. A member who forgets to check in during the window, or typos an ID the email lookup still recognizes, produces a row — it just arrives as `pending` instead of `present`. A member who showed up and got no credit is the failure mode that erodes trust in the whole system, so the schema is built to make that outcome impossible.
  - **Narrowed in v1.22 for the member half.** Someone the roster does not recognize *at all*, who did not tick "first time", produces nothing — see the self-registration bullet below. The event half is unchanged: an unresolved event link is always queued.
  - **Extended in v1.34 to money.** A dues payment is stored whether or not it resolves — an odd amount, an unreadable note, a note naming two members, no note at all. `dues_payments.member_id` and `terms_covered` are both nullable and either being null puts the row in the review queue. The reasoning is the same one that produced this rule for attendance and it is stronger here: somebody sent real money, and a payment silently discarded because the parser could not read it is worse than a check-in silently discarded, because the member has a receipt and the system does not. Same corollary too — **a payment note never creates a member**, exactly as check-in resolution never does.
- **Two independent failure modes, one status.** A pending row is missing an event link, a member link, or both. The admin UI distinguishes them; the database doesn't need to, because `present_requires_resolution` guarantees a row can't count until both are filled in.
- **`present_requires_resolution` is the load-bearing constraint.** It means the leaderboard query can trust `status = 'present'` without re-checking for nulls, and an officer cannot approve a half-resolved row by mistake.
- **`normalized_eid`** is a generated column stripping whitespace, hyphens, and casing. Duplicate detection and roster matching both key off it, so `ut-12345`, `UT 12345`, and `UT12345` are the same person.
- **The partial unique index excludes rejected rows**, so an officer can reject a bad submission and enter a corrected one for the same person and event.
- **`source`** separates member self-check-ins from officer-created rows, which matters when auditing why someone's count looks unusual.
- **`points` on events** allows weighting (a general meeting vs. a flagship event) without a schema change later.
- **`events.status`** replaces a boolean publish flag. `cancelled` is distinct from deleted: a cancelled event keeps its attendance history and disappears from the upcoming list, whereas deletion would orphan real records. Deleting an event that has attendance should be blocked outright in the UI.
- **`point_adjustments.reason` is `not null`** on purpose. An unexplained point grant is precisely what turns a leaderboard from a record into a rumor, and requiring the reason at the database level means no UI shortcut can skip it.
- **Adjustments are voided, never deleted.** A void is itself a recorded action with its own reason, so the history of "points were granted then taken back" survives.
- **Negative adjustments are allowed**, which makes this one mechanism for bonuses, penalties, and corrections rather than three.
- **One audit table, not several.** `admin_audit` keys on `(entity_type, entity_id)` so event edits, point grants, and attendance overrides all land in the same place. This makes "show me everything this officer did last month" a single query.
- **`checkin_opens_at` / `checkin_closes_at`** decouple the check-in window from the event's actual time — useful for a grace period for late arrivals. Widening these is the *preferred* fix for a systematically late crowd; manual override is for individuals.
- **Member lookup is resolution order; creating a member is a separate, confirmed step** (v1.22). A check-in resolves its member link by trying, in order: `normalized_eid`, then `lower(email)`. Matching on email second is what contains the common failure — someone who typos their EID is recognized by their email and linked to their existing record instead of becoming a duplicate person.

  What happens when *both* miss depends on one checkbox on the form, "this is my first MISA event":

  | Member lookup | First-time box | Written? | Screen |
  |---|---|---|---|
  | Matched by `normalized_eid` | unchecked | yes, immediately | Success |
  | Matched by `lower(email)` | unchecked | yes, immediately | Success |
  | No match | unchecked | **nothing** | "We don't have that info on file" + re-prompt |
  | Matched (either key) | checked | not yet | Review → confirm **links** the existing member |
  | No match | checked | not yet | Review → confirm **creates** the member + writes |

  Earlier versions created a member unconditionally on a double miss, which made a double typo indistinguishable from a new person — they were literally the same insert. The checkbox supplies the one bit the system cannot derive, so it only has to guess when the claim and the roster disagree, and it no longer guesses silently. A member created this way is still immediately `active` with `source = 'self_checkin'`; there is no approval step. Nothing is persisted between the two passes — the confirm step re-derives the whole outcome from its payload rather than trusting a token, which is why this needed no migration.
- **`members.source`** distinguishes admin-seeded from self-registered rows. Officers filter the directory by it to review who the form has added, which is the cleanup path for junk rows. Self-registration writes no `admin_audit` row — there is no acting officer, and `source` plus `joined_at` already record it.
- **The residual risk moved** (v1.22). A typo in *both* ID and email no longer creates a duplicate person — it is refused and re-prompted. The cost is on the other side: **someone who never gets their details right gets no attendance and leaves no trace.** No row, no queue entry, nothing for an officer to find later. The recovery path is officer manual entry at `/admin/attendance/new` (§7 Stage 5 phase 3), which the queue has linked from its ADD A CHECK-IN button since phase 1 — so the gap is not the page but the **trigger**. An unrecognized submission used to leave a pending row an officer would come across unprompted; now it leaves nothing, and the only signal is a member saying the form won't take their details. A duplicate is still reachable by ticking "first time" *and* typing badly, so Stage 6's merge tool is smaller in expectation but not unnecessary.
- **A window that closes mid-correction changes the outcome.** Nothing is written until the submission succeeds, so the event is resolved at the moment of the *final* submit. Someone correcting a typo across a window boundary can land as an orphan, or be refused. Accepted, and recorded rather than discovered.

### 4.3 Event-window resolution

The core piece of logic. A submission's timestamp determines its event:

```sql
create or replace function open_event_at(ts timestamptz default now())
returns setof events
language sql stable as $$
  select *
  from events
  where status = 'published'
    and ts >= coalesce(checkin_opens_at, starts_at)
    and ts <  coalesce(checkin_closes_at, ends_at)
  order by starts_at desc
  limit 1;
$$;
```

**Windows are half-open: `>= opens`, `< closes`.** Earlier drafts closed inclusively, which made adjacent events impossible to publish — a workshop ending at 19:00 and a social starting at 19:00 both claim that instant. Half-open lets them coexist, and 19:00 belongs to exactly one of them.

Ambiguity is prevented by a **Postgres exclusion constraint** rather than an application check, so it holds regardless of which code path writes the event:

```sql
alter table events
  add constraint events_no_overlapping_checkin
  exclude using gist (
    tstzrange(coalesce(checkin_opens_at, starts_at),
              coalesce(checkin_closes_at, ends_at), '[)') with &&
  )
  where (status = 'published');
```

The range bounds `'[)'` must match `open_event_at()`; if one is inclusive and the other is not, either adjacent events become unpublishable or an instant matches two events. No `btree_gist` needed — gist handles `tstzrange &&` natively, and the `status` filter is a predicate rather than an indexed column.

When no event is open, the submission is still accepted — but only within a bounded **orphan grace window**, so the form can't be used to manufacture attendance in the middle of summer:

```sql
create or replace function nearby_events(ts timestamptz default now(), window_hours int default 48)
returns table (event_id uuid, title text, starts_at timestamptz, ends_at timestamptz, gap interval)
language sql stable as $$
  select e.id, e.title, e.starts_at, e.ends_at,
         case
           when ts > e.ends_at   then ts - e.ends_at
           when ts < e.starts_at then e.starts_at - ts
           else interval '0'
         end as gap
  from events e
  where e.status = 'published'
    and ts between e.starts_at - make_interval(hours => window_hours)
               and e.ends_at   + make_interval(hours => window_hours)
  order by gap asc;
$$;
```

The three-way `case` matters: a timestamp *inside* an event's run has a gap of zero, not a negative one. A two-branch version returns `starts_at - ts` for that case, which sorts genuinely-concurrent events *below* distant ones and puts the wrong suggestion at the top of the officer's list.

If `nearby_events()` returns nothing, the check-in is refused outright with a message. If it returns rows, the submission is stored as `pending` and those rows become the ranked suggestions an officer sees in the review queue.

**Event resolution runs before member resolution, and refusal short-circuits it** (v1.22). Nothing about the submitter is looked up until an event or a grace window has been established, which is worth stating because it is load-bearing twice over: a refused submission touches the roster not at all, and the membership oracle §6 accepts (§4.2's re-prompt tells you whether an ID is on the roster) is closed entirely outside check-in windows. Someone probing EIDs in July learns only that there is no event on.

Two properties of this function shape the review screen, and both are easy to get wrong (v1.20):

- **`gap` is event-relative, not window-relative.** It measures against `starts_at`/`ends_at`, but the *check-in window* is what accepted or refused the submission. For an event with a 15-minute late close, a submission 41 minutes past `ends_at` is only 26 minutes past the window that actually rejected it. The officer-facing sentence therefore leads with the window number — "check-in closed 26 minutes before this submission" — and keeps the event number beside it, since that is what the ordering was computed from. `nearby_events()` does not return the window columns, so the detail page reads them separately and uses `effectiveWindow()`. **Ranking stays in SQL**; the application annotates and never reorders, which is the §4.3 three-places invariant applied to suggestions.
- **It is published-only, and returns nothing at all beyond the window bound.** That is the ordinary state of an orphan that sat in the queue for a week, and an officer must still be able to file a submission against a draft or cancelled event. So the assign control is an independent all-status event picker; the suggestion list is a ranking aid, not the vocabulary of what may be assigned. The empty-suggestions state has to say so rather than look broken.

### 4.4 Leaderboard view

Points now come from two sources, and the view keeps them separate rather than collapsing them into one number:

**One leaderboard, one row per member, current term only** (Open Decision #4, resolved). It exposes a single `total_points` figure — attendance and bonus points are summed together, not broken out. The term it ranks comes from `app_settings.current_term`, set by an officer:

```sql
create or replace view leaderboard as
with cur as (
  select current_term from app_settings
),
attendance_pts as (
  select a.member_id, coalesce(sum(e.points), 0) as pts
  from attendance a
  join events e on e.id = a.event_id
  where a.status = 'present'
    and e.status <> 'cancelled'
    and e.term = (select current_term from cur)
  group by a.member_id
),
bonus_pts as (
  select member_id, coalesce(sum(points), 0) as pts
  from point_adjustments
  where voided_at is null
    and term = (select current_term from cur)
  group by member_id
)
select
  m.id,
  m.full_name,
  coalesce(ap.pts, 0) + coalesce(bp.pts, 0) as total_points
from members m
left join attendance_pts ap on ap.member_id = m.id
left join bonus_pts      bp on bp.member_id = m.id
where m.active
order by total_points desc, m.full_name;
```

**Ties break alphabetically**, since `events_attended` is no longer in the view to break them with.

**Rollover is automatic.** `current_term()` derives the term from today's date (§4.7), so the board moves to Fall on August 1 and Spring on January 1 with no officer action and nothing to forget. `app_settings.current_term` exists only as an override: set it to pin the board on a finished term, set it back to null to resume automatic behavior.

The one rough edge is early August, when the new term is live but has no events yet, so the board is all zeros until the first meeting. Pinning the previous term is exactly what the override is for.

**This reverses the position earlier versions of this document took.** Prior versions kept `attendance_points` and `bonus_points` as separate columns everywhere, arguing that a member should see how much of their standing came from showing up versus from discretionary grants, and that an officer should notice at a glance if the top of the board is driven by bonuses. That transparency is now gone from the public view: a member sees only a number, and cannot tell that five of their thirteen points were granted rather than earned. The oversight it provided moves to two officer-facing surfaces — the split columns in `member_directory` (§4.5) and the points ledger at `/admin/points` — so the check on discretionary grants still exists, but only officers can perform it. Accept the tradeoff knowingly; the underlying data is unchanged, so restoring the columns later is a view change with no migration.

**Anon reaches this view, not the tables under it.** Postgres views run as their owner by default (`security_invoker = false`), which is what lets the anon role read aggregated standings while RLS still denies it direct access to `members`, `attendance`, `events`, and `app_settings`. The view *is* the security boundary — do not set `security_invoker = true` on it without re-checking §6.

**Privacy note:** the view deliberately excludes `eid` and `email`. A public leaderboard should never expose identifiers that are used elsewhere as credentials.

**Public, but never indexed** (§9 #1, resolved 2026-07-31). The remaining exposure after dropping IDs and emails is real names against point totals on a crawlable page — low-stakes in itself, but a search engine's cache outlives the deploy that created it, so it is not a decision that can be undone later. `/leaderboard` is therefore reachable by anyone with the link and carries `robots: { index: false, follow: false }`. That keeps the board doing its actual job — a member glances at where they stand, an officer screenshots it for the group chat — without putting students into a permanent public index. A display-name field or per-member opt-out is the escalation if someone objects; both are view changes with no migration.

**Two filters here surprise people, and both matter when an officer approves a submission** (found and documented in v1.20):

- **The attendance leg excludes only `cancelled`, not unpublished** — so **a draft event's attendance counts publicly.** That is defensible on purpose: an officer can build a schedule, backfill attendance, and publish afterwards without the numbers vanishing in between. But it means approving a submission against a draft event moves the public board immediately, which is not what "draft" suggests. The review screen warns rather than blocks.
- **`where m.active` has no counterpart in `member_directory`.** Approving attendance for an inactive member therefore changes the officer directory and produces *no public change at all*. Without a warning that reads as a bug in the approval.

Neither is worth changing — the behaviours are individually right — but both need saying out loud, because the failure mode is an officer who does not believe the screen.

### 4.5 Member directory view

Backs the admin roster screen. Pre-joining the aggregates means filtering and sorting is one indexed query rather than N per row.

It does **not** build on `leaderboard`, which now exposes only a total. This is the officer-facing surface, so it keeps the attendance/bonus split — it is where the check on discretionary grants lives (§4.4). It is scoped to the same `current_term` so the two screens can never disagree:

```sql
create or replace view member_directory as
with cur as (
  select current_term from app_settings
),
possible as (
  select count(*) as events_possible
  from events e
  where e.status = 'published' and e.ends_at < now()
    and e.term = (select current_term from cur)
),
attendance_agg as (
  select a.member_id,
         count(*)                   as events_attended,
         coalesce(sum(e.points), 0) as attendance_points
  from attendance a
  join events e on e.id = a.event_id
  where a.status = 'present'
    and e.status <> 'cancelled'
    and e.term = (select current_term from cur)
  group by a.member_id
),
bonus_agg as (
  select member_id, coalesce(sum(points), 0) as bonus_points
  from point_adjustments
  where voided_at is null
    and term = (select current_term from cur)
  group by member_id
)
select
  m.id,
  m.eid,
  m.full_name,
  m.email,
  m.active,
  m.source,
  m.joined_at,
  coalesce(aa.events_attended, 0)    as events_attended,
  coalesce(aa.attendance_points, 0)  as attendance_points,
  coalesce(ba.bonus_points, 0)       as bonus_points,
  coalesce(aa.attendance_points, 0)
    + coalesce(ba.bonus_points, 0)   as total_points,
  (select count(*) from attendance a
    where a.member_id = m.id and a.status = 'pending')       as pending_count,
  (select max(a.submitted_at) from attendance a
    where a.member_id = m.id and a.status = 'present')       as last_seen_at,
  (select events_possible from possible)                     as events_possible,
  round(coalesce(aa.events_attended, 0)::numeric
    / nullif((select events_possible from possible), 0), 4)  as attendance_rate,
  -- Appended by migration 18. notes and custom_fields are what the two editing
  -- screens render; updated_at is the compare-and-set token, carried here so
  -- the render side has one without a second read of `members`.
  m.notes,
  m.custom_fields,
  m.updated_at,
  -- Appended by migration 19 (§7 Stage 6.5). The only dues column, and the
  -- whole of "is this an official member" — see the note below.
  exists (
    select 1 from dues_payments dp
    where dp.member_id = m.id
      and dp.voided_at is null
      and dp.covered_terms @> array[(select current_term from cur)]
  )                                                          as dues_paid_current_term
from members m
left join attendance_agg aa on aa.member_id = m.id
left join bonus_agg      ba on ba.member_id = m.id;
```

`events_possible` is scoped to the current term too — an all-time denominator against a current-term numerator would understate every rate, and nobody would notice because the number still looks plausible. It is computed once in a `possible` CTE rather than per row: it never depended on the member, and it is read twice, so computing it once is what stops the column and the rate's denominator from ever disagreeing.

**`attendance_rate` is a column, not a computed expression, and that is the point** (migration 14, v1.25). Earlier versions of this section noted that `events_possible` *enables* a rate without a second round trip, which was true and insufficient: PostgREST filters and orders by column and cannot be handed an expression, so a sortable rate and a rate-threshold filter were both impossible until the rate existed in the view. It stores a fraction rather than a percentage — the view carries the number, the UI owns the presentation — and the URL's whole-percent threshold is converted at the point of querying.

**Null, not zero, when the denominator is zero.** A term with no completed events has no attendance rate. Rendering that as 0% would read as "attended nothing", and would sort below a member with a real 5% — exactly backwards, and at the start of every semester. Callers must render null as "—", and a threshold filter correctly excludes those rows, because "no rate" is not "meets the threshold". A member who genuinely attended nothing is a real `0` and must not be confused with it.

**Two columns here are deliberately *not* term-scoped**, unlike everything around them: `pending_count` and `last_seen_at`. A pending submission from last term still needs an officer, and "when did we last see this person" is an all-time question. Both are defensible, but they sit beside current-term point columns, so the UI has to label them or they will be read as current-term figures. **Resolved in phase 3** (v1.29): both moved off the directory table onto `/admin/members/[id]`, into their own block headed "All-time", apart from the term-scoped figures. Phase 6's "not seen since" filter must carry the same label.

**`events_possible` counts only events that have ended, and the UI has to say the same thing in three states rather than two** (v1.29). The member detail page's events grid marks each of the term's published events attended, missed, or **upcoming** — an event that has not happened yet is in nobody's denominator, and painting it as a miss would contradict the rate rendered directly above it and make every member look worst at the start of a term, when the roster is most under scrutiny. `classifyTermEvents` in `lib/members.ts` owns the classification, takes `now` as an argument so it is testable, and uses the same half-open boundary as the view.

⚠️ **The grid and this view can legitimately disagree, and neither is derived from the other.** `attendance_agg` above counts present rows against any non-cancelled current-term event — **drafts and not-yet-ended events included** — while the grid is published-only. A member marked present at a draft event therefore raises `events_attended` without appearing in the grid. Rare, and it will read as a bug to whoever finds it, so: the view is the authority on the numbers, the grid is the per-event breakdown. The integration test pins that the grid's attended + missed equals `events_possible`.

`source` is exposed so officers can filter to self-registered members and review what the check-in form has added (§4.2).

**One dues column, and it is a boolean** (migration 19, v1.34). `dues_paid_current_term` is the entire answer to "official or unofficial", scoped to `current_term()` like everything else here, and derived from `dues_payments` and nothing else. The directory renders it **Paid / Not Paid** — one word, no coverage detail — for the same reason the phase-3 trim exists: the table answers the question officers filter on, and the member detail page answers everything else.

**There is deliberately no "paid through" column, and the reason is that terms do not sort.** `'Fall 2026'` precedes `'Spring 2026'` alphabetically and follows it chronologically, so `max(term)` over a member's covered terms is wrong in a way that reads as right — it returns "Spring" for someone paid through Fall. A latest-covered-term column would therefore need a sortable key that nothing else in the schema wants. The member detail page reads that member's `dues_payments` rows directly instead, exactly as it already does for point adjustments, and orders them with `terms_from` semantics rather than a string compare (§4.7).

**A voided payment can make a member unofficial retroactively**, and that is correct rather than a bug: the boolean is a live derivation, not a stored flag, so correcting a mis-parsed payment corrects the status in the same instant. Officers should expect it, which is why the void flow requires a reason and writes an audit row.

⚠️ **This column appends, and that is load-bearing.** `create or replace view` can only add columns at the end (see the rule below), so `dues_paid_current_term` sits last and migration 19 needs no `drop`. That matters more here than the tidiness suggests: a `drop` + `create` silently re-opens the anon read that migration 15 closed, because `alter default privileges` grants new tables *and views* to `anon`. Any future change to this view that cannot be expressed as an append must re-issue both the `revoke` and the `grant` in the same migration.

### 4.6 Event edit semantics

Events are editable at any point, including after attendance exists. That flexibility creates four cases the UI has to handle deliberately:

| Edit | Effect on existing attendance | Behavior |
|---|---|---|
| Change `points` | Recomputes every attendee's total retroactively | Allowed, but warn with the count of members affected before saving |
| Narrow the check-in window | Existing `present` rows may now fall outside it | **Not retroactive.** Recorded attendance is a fact; the window is only consulted at resolution time. Warn, don't revoke. |
| Move `starts_at` / `ends_at` | Same as above | Allowed with the same warning |
| Move `starts_at` **across a term boundary** | The event and all its attendance silently move to the other term's leaderboard | `term` is generated from `starts_at` (§4.7), so this happens automatically with no prompt. Detect it in the edit form — compare `term_of(old)` with `term_of(new)` — and warn explicitly, since rescheduling a July meeting into August moves every attendee's points between semesters |
| Delete an event with attendance | Would orphan real records | Blocked. Offer `status = 'cancelled'` instead, which preserves history and removes it from the upcoming list |

Cancelled events are excluded from leaderboard totals but remain visible in a member's attendance history, so someone who attended an event that was later cancelled can still see they were there.

Every event edit writes an `admin_audit` row with the before/after JSON, which makes "why did everyone's total change last Tuesday" answerable.

---

### 4.7 Terms are derived, not typed

A term is a pure function of a date. Nobody types `'Fall 2026'` anywhere, so nobody can typo it, and events tag themselves as time goes on.

```sql
-- IMMUTABLE so it can back a generated column. See the caveat below.
create or replace function term_of(ts timestamptz)
returns text
language sql
immutable
as $$
  select case
    when extract(month from ts at time zone 'America/Chicago') >= 8
      then 'Fall '   || extract(year from ts at time zone 'America/Chicago')::int
      else 'Spring ' || extract(year from ts at time zone 'America/Chicago')::int
  end
$$;

-- The term the leaderboard ranks: automatic, unless an officer has pinned it.
create or replace function current_term()
returns text
language sql
stable
as $$
  select coalesce((select current_term from app_settings), term_of(now()))
$$;
```

**Boundaries are half-open**, so every instant belongs to exactly one term with no overlap and no gap:

| Range | Term |
|---|---|
| Aug 1 2026 00:00 → Dec 31 2026 23:59 | `Fall 2026` |
| Jan 1 2027 00:00 → Jul 31 2027 23:59 | `Spring 2027` |

January 1 is Spring. August 1 is Fall. Summer events fall in Spring — a June meeting is `Spring 2027` — which follows from the two-season rule rather than being an oversight. Add a `Summer` branch to `term_of()` if that ever stops being acceptable; it is a one-function change plus a regeneration of the stored column.

**Anchored to `America/Chicago`, not UTC.** An event at 7pm Central on July 31 is 00:00 UTC on August 1 — anchoring to UTC would file it under Fall. The org is in Austin, so the local calendar is the correct one.

**Caveat on `IMMUTABLE`.** `at time zone` is officially `STABLE`, because timezone rules can change when tzdata is updated, so marking this function `IMMUTABLE` is a deliberate (and conventional) overstatement to make the generated column legal. The exposure is that a tzdata change could in principle leave a stored value stale. For this to matter, a tzdata update would have to shift America/Chicago's offset across an exact term boundary — an event at literally midnight on August 1. Accepted.

**What follows from `events.term` being generated:**

- It can never be null, since `starts_at` is `not null`. This closes the "should term be `not null`" question — the column cannot be wrong or missing.
- It cannot be overridden. Moving an event across a boundary re-tags it automatically, which also means an event rescheduled from July to August moves between terms and changes both members' standings — the §4.6 edit-impact warning should say so.
- `point_adjustments.term` is **defaulted, not generated**, precisely because it does need overriding: a bonus awarded in Spring for Fall work belongs to Fall. This is the independence §4.4 relies on.

**Terms also have to advance, not just be named** (migration 19, built v1.38). A dues payment buys one term or two, so "the term after this one" becomes a schema-level question for the first time. **Four** immutable functions, beside `term_of` and derived from the same two-season rule — the count grew by two during the build, and the reason is the interesting part.

```sql
-- A term as a monotonically increasing integer. Spring sorts before Fall
-- within a year:  Spring 2026 → 4052,  Fall 2026 → 4053,  Spring 2027 → 4054.
create or replace function public.term_index(t text)
returns integer language sql immutable
as $$
  select case
    when t is null then null
    else split_part(t, ' ', 2)::int * 2
       + case when split_part(t, ' ', 1) = 'Fall' then 1 else 0 end
  end
$$;

-- The inverse.
create or replace function public.term_at_index(i integer)
returns text language sql immutable
as $$
  select case
    when i is null then null
    else case when i % 2 = 1 then 'Fall ' else 'Spring ' end || (i / 2)::text
  end
$$;

-- 'Fall 2026' → 'Spring 2027';  'Spring 2027' → 'Fall 2027'.
create or replace function public.next_term(t text)
returns text language sql immutable
as $$ select public.term_at_index(public.term_index(t) + 1) $$;

-- The n consecutive terms starting at `start`. Null n yields null, which is
-- what makes dues_payments.covered_terms cover nothing until an officer
-- decides how many terms a payment bought.
create or replace function public.terms_from(start text, n int)
returns text[] language sql immutable
as $$
  select case
    when start is null or n is null or n < 1 then null
    else (
      select array_agg(public.term_at_index(public.term_index(start) + step)
                       order by step)
      from generate_series(0, n - 1) as step
    )
  end
$$;
```

**Why an index rather than iterating `next_term`, which is what this section used to show.** Two reasons, and the second is the one that matters. `covered_terms` is a **generated column**, so its expression must be `IMMUTABLE` — an index makes stepping plain addition with no recursion. And a successor function alone cannot answer *"which of these two terms is later"*, which is the question the trap below is actually about. An index gives a **total order** for free, and `isLaterTerm` in `lib/dues.ts` is that order made available to application code.

🪤 **Terms do not sort lexicographically, and this is the trap these functions exist to avoid.** `'Fall 2026' < 'Spring 2026'` is true as a string compare and false as a calendar fact. Any "which term is later" question — the latest term a member is paid through, the ordering of a payment history — must go through `term_index`, never `max()` or `order by term`. It is the same class of error as `new Date("2026-09-01T18:00")`: plausible output, wrong answer, no error anywhere.

**A payment's covered terms are derived, never typed** — the same rule this section opens with, applied to money. `dues_payments.start_term` defaults from `term_of(paid_at)` and `covered_terms` is generated from it, so no officer types a term string into a payment. `start_term` is nonetheless **overridable**, like `point_adjustments.term` and for a related reason: summer falls in Spring under the boundaries above, so a July payment for the coming academic year would otherwise buy a term with three weeks left in it. The import preview flags May–July payments for exactly this.

## 5. Route Structure

```
/                      Landing page — org info, upcoming events, join CTA
/about                 Org overview, mission, history, FAQ        (static)
/gallery               Event photos                                (static)
/officers              Officer roster with LinkedIn links          (static)
/projects              Past and current client projects            (static)
/contact               Contact details and form                    (static)
/attend                Public check-in form
/leaderboard           Public standings
/lookup                Member self-service attendance history
/admin/login           Officer sign-in
/admin                 Dashboard — recent check-ins, pending review count
/admin/events          Schedule list — filter by term, status, category
/admin/events/new      Create one event, as a draft or published
/admin/events/series   Create a recurring series — expanded to one draft per date
/admin/events/[id]     Edit event, view its attendance, duplicate, cancel
/admin/members         Roster directory — sort, filter, select, copy, export
/admin/members/export  Route Handler — CSV or .xlsx of the selected rows and
                       chosen fields; writes the 'roster' audit receipt
                       (Stage 6 phase 5)
/admin/members/[id]    Member detail — full history, adjustments, notes,
                       and the current term's events with an attendance
                       indicator (Stage 6 phase 3)
/admin/members/fields  Custom field definitions — create, edit, archive
                       (Stage 6 phase 4)
/admin/points          Point adjustment ledger — every grant, filterable by officer
/admin/points/new      Grant points to one or more members in a single action
/admin/points/[id]     Adjustment detail — void it with a reason, and its history
/admin/dues            Dues ledger — every payment, filterable by state, term,
                       member, and date; the needs-review count is the number
                       an officer acts on            (Stage 6.5 phase 3)
/admin/dues/import     Upload a Venmo statement CSV — parse, preview, confirm.
                       A Server Action, not a Route Handler: only downloads
                       need Content-Disposition      (Stage 6.5 phase 2)
/admin/dues/[id]       Payment detail — reassign the member, correct the term
                       or the term count, void it with a reason, and its
                       history                       (Stage 6.5 phase 3)
/admin/attendance      Review queue — all submissions, filterable by status
/admin/attendance/[id] Submission detail: raw form data, suggestions, override actions
/admin/audit           Full activity log across all entities
```

Everything under `/admin/*` (except `/admin/login`) is gated by `proxy.ts` (Next 16's rename of `middleware.ts`), which checks for a valid session and a matching `admin_profiles` row.

**`/admin/audit` is not built by Stage 5** (v1.20). The per-entity history an officer actually reaches for — "what happened to *this* submission" — is a shared `AuditTrail` component on the detail surfaces, which is where the question gets asked. The global cross-entity log remains worth building for the "show me everything this officer did last month" query §4.2 describes, but it is a later stage and the nav entry stays disabled until then.

---

## 6. Security Model

The public check-in form is the main attack surface: it accepts unauthenticated writes.

| Concern | Mitigation |
|---|---|
| Anon key over-permission | RLS: anon role can `select` only from `leaderboard` and published `events`. All writes go through Server Actions. |
| Spam / bot submissions | Honeypot field, per-IP rate limit on the check-in action, submissions rejected outside any open window |
| Check-in on behalf of someone else | Accepted risk for v1 — same as a paper sign-in sheet. Mitigate later with a rotating per-event code displayed at the venue. |
| Attendance data enumeration | `/lookup` requires EID **and** matching email before returning history |
| Roster PII exposure | Emails and EIDs never returned to unauthenticated clients under any route |
| Roster pollution via self-registration | The check-in form can create members (§4.2), so junk rows are reachable by anyone who can submit during an open window. Bounded by the window, honeypot, and rate limit; contained by matching on ID and then email before creating, and since v1.22 by requiring an explicit "this is my first MISA event" claim plus a confirmation pass. Visible via `members.source = 'self_checkin'` in the directory. Impact is cleanup, not data loss. **Note what the confirmation is:** a guard against honest typos, not a control. A scripted POST carrying `step=confirm` creates a member in one request without the review screen ever rendering — correct, because the server re-derives the whole outcome rather than trusting the previewed payload, but it means the throttle is still the only thing standing in an attacker's way. |
| Roster membership is probeable | **Accepted, and it contradicts the officer-login row on purpose** (v1.22). §4.2's re-prompt says "we don't have that info on file", so anyone submitting during a check-in window learns whether a given EID is on the roster. Officer sign-in deliberately does the opposite — one identical failure for "wrong password" and "no such user" — and the two will read as an inconsistency to whoever finds them next unless the difference is written down. The roster is a club list, not a security boundary, and UT EIDs are semi-public; the alternative was an indistinguishable failure that gives a member with a typo no way to tell what went wrong. Bounded three ways: event resolution runs first, so the oracle is closed outside check-in windows entirely; the per-IP throttle applies to both passes; and the answer is a bare boolean — no name, email, or ID of the matched member ever reaches the client, including on the confirmation screen. |
| Officer grants attendance or points improperly | Every override and adjustment writes an `admin_audit` row with actor, timestamp, before/after values, and a required reason. Triggers reject `UPDATE` and `DELETE`, so the log is append-only for the app and every client role. **Note the limit:** a table owner can disable the trigger, so this constrains the application, not someone with direct database access. Stage 8's RLS policies are what close the client-role path properly. |
| Bulk roster export leaks member PII | Export is the largest PII egress point in the system, and a downloaded `.xlsx` or CSV outlives the session that produced it — it lands on a personal laptop and is never revoked. Gate it behind an authenticated session (`getOfficer()` in the Route Handler, 403 on failure), log every export to `admin_audit` with the filter, the **chosen field list**, the format, and the row count, and consider restricting it to the `admin` role. The field picker is a small mitigation as well as a feature: an officer who needs t-shirt sizes should not have to download every email to get them. |
| Spreadsheet formula injection via member-supplied text | Member names and emails are attacker-chosen — anyone who can check in during an open window supplies their own (see the self-registration row above), so a member named `=HYPERLINK("http://…"&A1,"click")` is reachable by design. Excel and Sheets evaluate a cell beginning `=`, `+`, `-`, or `@` when parsing **CSV**; the officer who opens the export is the victim, not the server. Mitigate in `lib/export.ts` at the CSV writer: prefix any cell matching that pattern with a single quote, or refuse the leading character. **The `.xlsx` path is not exposed** — cells are written as typed strings and stay inert — which is one more reason the two writers must not share a "just join with commas" shortcut. |
| Dues records are financial-adjacent PII | `dues_payments` holds who paid, how much, when, their Venmo display name and handle, and their free-text note — a category of data nothing else in this system carries, and the reason the threat-model boundary below had to be narrowed. **What it deliberately does not hold: no card numbers, no bank details, no Venmo credentials, and no ability to move money.** The site reads a statement after the fact; the payment happened elsewhere (§1.3, §2.2). Mitigations are the ones already in place rather than new machinery — RLS deny-all on the table, reachable only through `member_directory` (which exposes a **boolean**, never an amount) and officer-authenticated screens, every correction and void audited. Treat a dump of this table as materially worse than a roster dump when scoping Stage 8. |
| The uploaded statement is the whole org's payment history in one file | An officer uploads a CSV that, by construction, contains every dues transaction for a month — a larger single artifact than anything else that enters this system. **Never persist the file**: parse it, keep the rows, discard the text. Bound the accepted size and row count and refuse rather than truncate (the §2.2 cap rule). The two-step preview keeps the text in the browser between steps rather than in a staging table, so there is no server-side copy to leak or forget. Parse defensively — an uploaded CSV is untrusted input even when the officer uploading it is not. |
| Payment notes are member-supplied text | The note is written by the payer, so it is attacker-chosen in exactly the way member names are (see the formula-injection row above), and it reaches both the officer's screen and any export that includes it. Same mitigation, same writer: escape it in `lib/export.ts`'s CSV path, render it as text and never as markup. A note can also *name another member's EID* — that is a reconciliation hazard rather than an injection one, and it is why matching requires exactly one resolving token and queues anything ambiguous. |
| `/lookup` reveals dues status | Stage 7's member self-service page will show the member their own dues status, which widens the accepted "is this EID on the roster" oracle (see the row above) to "has this person paid". **Materially more sensitive than roster membership**, and accepted only because `/lookup` already requires EID **and** matching email — a stricter gate than the check-in oracle, which needs the EID alone. Do not relax that gate, and do not add dues status to any surface reachable with the EID alone, `/leaderboard` included (§9 #1, #12). |
| Orphan submissions used to fabricate attendance | Check-ins are only accepted within 48 hours of a published event; everything outside that is refused, not queued |
| Preview deployments writing to the production database | Vercel previews inherit production env vars, so every PR preview is a second, public check-in form pointed at the real Supabase project. Keep Vercel Deployment Protection at **Standard Protection**: production public, previews gated. Revisit if previews ever get their own Supabase project. **Verified July 2026** — check it by response behaviour rather than by the dashboard label: the production alias must return `200` while a per-deployment URL returns `302` to `vercel.com/sso-api`. If both return `200`, protection is Disabled and every preview is publicly writable. |
| Admin privilege escalation | `admin_profiles` is not writable by any client role; officers are added via the Supabase dashboard or a seeded SQL script |

**Threat model boundary:** this system protects against casual abuse and accidental data exposure. It is not designed to withstand a determined attacker. Scope the security work accordingly — the RLS policies matter far more than, say, elaborate bot detection.

⚠️ **This paragraph used to end "and it holds no financial or highly sensitive data", and Stage 6.5 made that false** (v1.34). The narrower claim that replaces it: **no credential, card, or bank detail ever enters this system, and it cannot move money.** What it now holds is a record that money arrived — amounts, dates, Venmo display handles, and payer notes — which is financial *information* without being financial *access*. That is still the low-stakes end of the spectrum, and it does not change the conclusion above about where the effort goes. It does change two things concretely: a `dues_payments` dump is worse than a roster dump and should be weighted that way in Stage 8, and the sentence is no longer available as a reason to skip a security question. If a future change adds a checkout, this boundary needs rewriting again rather than stretching.

---

## 7. Project Stages

Stages are ordered so that each one ends with something demonstrable. Effort estimates assume part-time work alongside coursework.

---

### Stage 0 — Foundations
**Goal:** A deployed skeleton, so deployment is never the thing that blocks a feature.

- Initialize Next.js + TypeScript + Tailwind
- Create GitHub repo; connect to Vercel; confirm push-to-deploy on `*.vercel.app`
- Create Supabase project; store keys in Vercel env vars and `.env.local`
- Verify a server-side Supabase query renders on a deployed page

**Exit criteria:** a live URL that reads one row from Postgres.
**Effort:** ~half a day.

**✅ Complete (2026-07-29).** Live at `misa-website-beta.vercel.app`, deploying from `Texas-MISA/MISA-Website` on push to `main`.

---

### Stage 1 — Data Layer
**Goal:** The schema exists and enforces its own rules.

- Write migrations for `members`, `events`, `attendance`, `point_adjustments`, `admin_profiles`, `admin_audit`
- Add constraints, the `open_event_at()` and `nearby_events()` functions, and the `leaderboard` and `member_directory` views
- Generate TypeScript types from the schema
- Seed with realistic fake data — 30+ members, 10+ past events, varied attendance

**Exit criteria:** invalid data (overlapping events, duplicate check-ins, `ends_at` before `starts_at`) is rejected by the database, verified by hand in the SQL editor.
**Effort:** 1–2 days. Do not rush this stage; schema changes get expensive once UI depends on them.

**✅ Complete (2026-07-29).** Eight migrations, verified against the live project by attempting each violation and checking the SQLSTATE. Seeded with 32 members, 15 events, and 208 attendance rows covering pending, rejected, cancelled-event, and officer-entered cases. See `tasks.md` for the full result table.

---

### Stage 2 — Public Site
**Goal:** Something worth showing people.

Scope settled in v1.17: **recreate the existing Squarespace site**
([txmisa.org](https://www.txmisa.org/)) rather than invent a landing page, so
the content problem is solved by carrying over copy that already exists and the
design becomes an editing problem rather than a blank page. Full survey in
`docs/existing-site-inventory.md`.

- Six pages: landing, `/about`, `/gallery`, `/officers`, `/projects`, `/contact`
- Shared header/footer chrome on the `(public)` route group
- Upcoming events pulled live from `events where status = 'published'` — the one
  section with no counterpart in the old site, and the reason this app exists
- Officer roster (static content is fine)
- Mobile-first responsive layout

**Deferred deliberately:** photography and partner logos (real people's photos
and trademarked logos don't go in a public repo without permission), and the
contact form's backend — it renders disabled, with email as the working path.

**Exit criteria:** a stranger understands what the org does and when it meets.
**Effort:** 2–3 days, mostly content and design rather than logic.

---

### Stage 3 — Attendance Capture ✅ built & tested (v1.18)
**Goal:** The core feature. This is the reason the project exists.

- `/attend` form: name, EID, email — live, linked from the nav and the home page's events section
- Server Action `submitCheckin` (`app/actions/attendance.ts`) resolving via `open_event_at()`; the testable core is `resolveCheckin` in `lib/checkin.ts`, using the service-role client (`lib/supabase/admin.ts`, guarded by `server-only`)
- Both links resolved → `present`. Every submission this action *writes* has a member link — matched, or created behind the v1.22 confirmation — so the only pending rows it produces are **orphans** (no event link); the member sees the received-awaiting-review message
- No published event within the 48-hour orphan window → refused outright, nothing written
- Success, pending, duplicate (prior-aware), refused, invalid, rate-limited, and error states all render distinctly
- Honeypot field + per-IP rate limiting via `checkin_throttle` (see the v1.18 changelog for both mechanisms and the duplicate rule)

**Exit criteria: met, verified through a real browser against the local stack** — during-window ⇒ `present` on the correct event with the member self-registered (`source='self_checkin'`); an hour after close ⇒ `pending` orphan; with nothing inside 48 hours ⇒ refused with zero rows written. The test list below runs as Vitest integration tests (37 passing).

**Test cases to write explicitly:**
- Before window opens / during / after window closes
- Just outside the window vs. far outside the orphan grace window
- Two events back to back with adjacent windows
- Duplicate submission by the same EID
- Duplicate where the first submission is still `pending`
- EID not on the roster
- Whitespace, casing, and formatting variance in EIDs

---

### Stage 4 — Admin Foundation & Event Management
**Goal:** Officers can run the schedule entirely from the UI, and can reshape it at any point without a developer.

**Auth and shell**
- Supabase Auth email/password sign-in at `/admin/login`
- `proxy.ts` gating `/admin/*` against a valid session + `admin_profiles` row
- Persistent admin nav; dashboard with recent check-ins and a pending-review badge

**Event management**
- Full CRUD, editable at any time — before, during, or after the event has happened
- **Draft → published → cancelled** lifecycle, so a schedule can be built up privately and released at once
- **Duplicate event** — one click to clone a past event's title, duration, window offsets, points, and category. This is the single highest-leverage admin feature for an org with a weekly general meeting.
- **Recurring series creation** — "every Tuesday 6–7pm until Dec 4" generates the batch in one action, sharing a `series_id` so the set can be edited or cancelled together
- Independent check-in window controls, with sensible defaults derived from the event time and a quick "open 15 min early / close 15 min late" preset
- Per-event `points`, `category`, and `term`
- Overlap validation on publish, so no two published events can be open simultaneously
- **Edit-impact warnings** implementing the rules in §4.6: changing points shows how many members' totals will shift; narrowing a window shows how many existing check-ins now fall outside it; deleting an event with attendance is blocked with a prompt to cancel instead
- Every mutation writes to `admin_audit`

**Exit criteria:** an officer with no database access builds a 12-week recurring schedule, publishes it, then reschedules one week's meeting and changes its point value — seeing an accurate warning about who is affected before saving.
**Effort:** 6–7 days. The recurrence and duplication work is what makes this stage worth its size; skipping it means every meeting is entered by hand forever.

---

### Stage 5 — Attendance Review & Manual Adjustments ✅ complete (v1.24)
**Goal:** Officers can see every submission, correct any of them, and award points that didn't come from a check-in. Until this ships, pending rows accumulate with no way to resolve them.

**Shipped in five demonstrable phases**, because the stage is 5–6 days and splits cleanly at the read/write boundary:

| Phase | Scope | State |
|---|---|---|
| 1 | Migration 13, `lib/attendance.ts`, `lib/points.ts`, zod schemas, audit vocabulary, read-only `/admin/attendance` | ✅ built & verified |
| 2 | `/admin/attendance/[id]` — raw submission, ranked suggestions, audit trail; still read-only | ✅ built & verified |
| 3 | Mutations: resolve, approve, reject, reopen, bulk assign, manual entry, all-status event picker | ✅ built & verified |
| 4 | `/admin/points` — grant, ledger, void | ✅ built & verified |
| 5 | Docs, invariants, `tasks.md`, final read-through | ✅ done (v1.24) |

**Phases 1–4 were each merged to `main` and deployed as they finished**, rather than the whole stage landing at once. Worth repeating for the next stage: the queue was resolving real submissions in production while `/admin/points` was still being built, and production `admin_audit` shows officer activity dated against each phase as it went live.

**Everything through phase 2 is read-only**, which is deliberate: the queue and the detail page are worth having on their own — an officer can at least *see* what is unresolved and why — and shipping the reads first means the suggestion ranking gets exercised against real data before any mutation depends on it being right. That paid for itself twice: the ranker's distance-2 problem and a highlight that marked punctuation instead of the differing digit were both found by looking at real rows, while nothing was yet writable.

**The all-status event picker moved from phase 2 to phase 3.** `nearby_events()` is published-only and returns nothing beyond the grace window, so suggestions alone cannot express every legitimate assignment — but a picker is a form control, and phase 2 has no forms.

**Resolution is one save per officer intent** (v1.21). An officer fixing a submission typically has to correct a typo, set an event, link a member, and approve — and the natural implementation makes that four writes and four audit rows. It is one: the detail form submits the corrected fields together with both links, and the APPROVE button carries `intent=approve` so the same statement also sets `status = 'present'`. The first build got this wrong in a way worth recording, because it was invisible to the tests — the button's enabled state was derived from the server's copy of the row rather than the live `<select>`, so picking an event left APPROVE greyed out and the officer had to save, wait, and approve separately. The design was intact and the experience was the thing it was meant to prevent.

**Bulk assign is explicit-selection-only and partial-success.** Stage 5 introduces the first bulk action in the system, so Stage 6's select-all rule is pulled forward here: only checked IDs are ever operated on, never "everything matching this filter." The pre-flight must also dedupe *within* the selection — two selected rows can be the same person — and the operation splits into two statements, because rows with no member link cannot become `present` without violating `present_requires_resolution`. Auto-approve is an opt-in checkbox rather than implied by choosing an event; silently approving forty rows because an officer picked an event from a dropdown is precisely the boundary-moving the design note below warns against.

**Audit granularity follows officer intent, not columns.** Assigning an event and linking a member happen in one click and write one `attendance.updated` row; `before`/`after` already record exactly which columns moved, so splitting them into separate actions adds rows without adding information. Bulk operations reuse the single-row verbs and carry their batch context in `note`, so a row's history reads identically whether the change came from the detail page or the queue.

**Review queue (`/admin/attendance`)**
- Table of all submissions: submitted name, ID, email, exact timestamp, resolved event, status
- Filters by status, date range, and event; default view is `pending`, oldest first
- Pending count surfaced as a badge on the admin dashboard so the queue doesn't rot

**Submission detail (`/admin/attendance/[id]`)**
- Raw form data exactly as the member typed it, with the submission timestamp shown to the minute
- **Suggested events** from `nearby_events()`, ranked by proximity and annotated with the gap — "General Meeting, closed 41 minutes before this submission"
- **Suggested members** when the EID doesn't match: fuzzy matches on name and email, with the near-miss ID shown for comparison
- Actions: assign event, link member, approve, reject, edit submitted fields, add a note
- Approving is blocked in the UI until both links are set — the database would reject it anyway via `present_requires_resolution`, but the UI should say so before the officer clicks

**Supporting work**
- Bulk assign, for the common case where a whole group checked in after the meeting ended
- Manual creation of an attendance row for a member who never submitted anything at all (`source = 'admin_manual'`)
- Every action writes an `admin_audit` row; the detail page shows that row's full history
- Optional resolution note, and a prompt for one on reject

**Point adjustments (`/admin/points`)**
- Award or deduct points for any member outside of event attendance: volunteering, recruiting a new member, competition placement, leadership work, or correcting a past mistake
- Required reason and category on every grant — the form cannot submit without them
- Grant to a single member, or to a multi-select group in one action (e.g. everyone who staffed the info booth)
- Optional link to a related event for context
- Ledger view of all adjustments, filterable by officer, category, date range, and member — so the question "who has been handing out points" has a one-screen answer
- Void with a reason rather than delete; voided rows stay visible, struck through, and stop counting immediately

**Exit criteria:** an officer takes a submission that arrived 40 minutes after an event closed, assigns it to the correct event, approves it, sees the member's leaderboard count increase, and can later see exactly who made that change and when. Separately, an officer awards 5 bonus points to three members at once with a reason, sees those points in the `bonus_points` column of the admin directory distinct from attendance points, and sees the members' public leaderboard totals rise by 5 with no breakdown shown.

**Met — with one honest qualification about *where* it was seen** (v1.24). Everything an officer does is verified through the UI: assign-and-approve in one click, one `attendance.approved` audit row with the right before/after, the multi-member grant, and the void. But the two "sees the result" clauses name screens Stage 5 does not build — the admin directory is Stage 6 and `/leaderboard` is Stage 7 — so those were verified against the views themselves. On the seeded roster, `member_directory` keeps the split while `leaderboard` publishes one total that equals `attendance_points + bonus_points`, a negative adjustment reduces it, and a voided one contributes nothing. That is §4.4 and §9 #11 behaving as written; what remains unproven until Stage 6 and Stage 7 is only that a screen renders those columns. Recorded rather than quietly counted as met, because a stage marked complete against criteria it could not fully test is how a gap survives to launch.

**Effort:** 5–6 days. The suggestion ranking is what turns the review queue from a tedious data-entry screen into a two-click operation — worth the extra time.

**Design note:** resist the urge to auto-resolve near-misses. A submission five minutes past the window is *probably* legitimate, but auto-approving it just moves the boundary and invites the same problem five minutes later. Keep the human in the loop and make the human's job fast instead.

---

### Stage 6 — Member Directory 🔨 phases 1, 2a, 2 and 3 of 9 built & deployed · re-planned 2026-08-01 (v1.26)
**Goal:** Officers can slice the roster any way they need and get the result out of the system in one action. This is the screen officers will actually live in.

**Nine phases** — six originally, re-planned after phase 1 shipped (see the v1.26 note at the top of this document for the four decisions and their reasoning). Same shape as Stage 5: each ends in something demonstrable and merges to `main` as it lands. `tasks.md` carries the working detail.

| Phase | Scope | State |
|---|---|---|
| 1 | Migration 14, `lib/filters.ts`, read-only `/admin/members` — sorting, pagination, view-column filters | ✅ built & browser-verified, partly superseded by 3 |
| 2a | Migration 15 — close the anon read of `member_directory`; `tests/security.test.ts` | ✅ built & deployed |
| 2 | The EID switch — migrations 16 and 17, the ranker retune, seed and fixture regeneration | ✅ built & deployed |
| 3 | The reshaped four-column directory **and** `/admin/members/[id]` | ✅ built — no migration needed |
| 4 | Custom fields — definitions, dropdown values, inline editing, sorting | ✅ built, browser-verified & deployed (migration 18) |
| 5a | Selection — row checkboxes, "select all N matching", the field picker, clipboard, CSV, and the codebase's first Route Handler | ✅ built, browser-verified & deployed |
| 5b | The `.xlsx` workbook — hand-rolled and dependency-free | ✅ built & deployed; confirmed by opening it in real Excel |
| — | ⏸ **Stage 6.5 (dues) interrupts here** — see below | 🚧 phase 1 of 4 built |
| 5c | Filter by categorical fields — custom fields, dues status, `source`. **After 6.5**, because it filters on the dues column | |
| 6 | Relational filters (attended or missed a given event, has pending, not seen since) | |
| 7 | Saved filter presets and CSV roster import | |
| 8 | The merge tool — its own estimate, see below | |
| 9 | Docs and a closing read-through | |

✅ **Phase 1 was walked through a browser (2026-08-01), and it earned its keep.** Sorting, the tie-break across a page boundary, pagination, and the rate-threshold arithmetic were all correct. The screen was not: the five numeric filter boxes were uncontrolled (`defaultValue`), which React reads only at mount, so CLEAR — a client-side push with no remount — left the officer's typed numbers on screen above a count that no longer applied them. Displayed filter and applied filter disagreed, which is the same partial-list failure phase 5's export exists to avoid, arriving through the filter instead of through pagination. Fixed by moving both translations into `lib/filters.ts` (`memberFilterFields`, `memberFilterUrl`).

That is now four consecutive phases where a browser pass found something the suite could not — and this one **could not** have been caught by a test, since `vitest` runs `environment: "node"` and cannot render a component. The guard is a source assertion instead. Keep doing the walkthrough.

✅ **Phase 4's walkthrough (2026-08-03) was the first to come through clean** — no application defect. Worth recording *why*, because it is not luck: the two failure modes most likely to appear were designed against explicitly and then verified head-on. Two custom fields set back to back on one row produced no phantom conflict (the compare-and-set token is owned by the row rather than copied into each cell); and a custom sort survived typing in the search box (`memberFilterUrl` re-parses what it builds, and had to be given the field definitions to do it). Both had been caught earlier — the first in design, the second as a live bug found and fixed within the same session. **This does not argue for dropping the walkthrough**; it argues that a phase whose hazards are written down in advance is the one that survives it.

🪤 **The walkthrough did find something, and it was in the tooling rather than the app.** A dev server started as a background task died on an uncaught `EPIPE` when its stdout pipe closed — without exiting. It spun while every request hung, so the browser kept rendering a *stale DOM* that looked exactly like a real rendering defect, and produced a confident and completely wrong bug report before anyone thought to `curl` the server. The operational rule now recorded in `tasks.md`: **when the UI shows something impossible, verify the server is answering before believing the screen.**

**Two phases that must not be separated.** Phase 3 reduces the directory to four columns and builds the member detail page in the same phase, because the detail page is where the removed columns go. Shipping the reduction first would make attendance rate, pending count, and last seen unreachable from the UI entirely.

**The directory — what is displayed**
- **Name, Email, EID, Total Points**, plus officer-defined custom-field columns
- Name links to `/admin/members/[id]`
- Sortable: exactly the displayed columns, custom fields included. Server-side against `member_directory`, never client-side — required for correct behaviour with pagination, and the reason a custom field's value has to be a *column* the database can order by rather than something assembled in the app.
- Filterable: the displayed columns, plus two deliberate exceptions — **active/inactive**, kept as a scope selector rather than a column filter (dropping it would strand inactive members, who are excluded from `leaderboard` too), and **free-text search across name / email / EID**, which touches only displayed columns.
- Phase 6 adds the relational filters — attended or missed a given event, has pending submissions, not seen since a date. These narrow on data the table does not show, so they get their own labelled panel rather than sitting among the column filters.

**The member detail page — everything displaced from the directory**
- Joined, source, active, events attended / possible, attendance rate, attendance points, bonus points
- **Pending count and last seen, labelled all-time.** These are the two columns in `member_directory` that are not term-scoped, and putting them beside term-scoped figures in a table is what made that ambiguous. Here they sit apart and say so.
- **A grid of the current term's events with an attendance indicator.** Three states, not two: attended, missed, and **upcoming** — `events_possible` counts only events that have ended, so treating a future event as a miss makes every member look worse at the start of a term. Published events only; a cancelled event credits nobody.
- Point adjustment history, officer notes, and the shared audit trail

**Custom fields (phase 4)**
- Officer-defined, dropdown-first: T-shirt size → S/M/L, Major → a list, Committee → a list. A definition carries its options, its display order, whether it appears in the directory, and **whether it is editable inline** — chosen at creation.
- ⚠️ **This example used to be "Paid Dues → Yes/No", and it is not one any more** (v1.34). Dues stopped being something an officer ticks and became something the system calculates from real payments — see Stage 6.5 below. The keys `dues`, `dues_paid`, and `dues_paid_current_term` are now **reserved**, in migration 19's CHECK and in `RESERVED_FIELD_KEYS`, specifically so nobody can recreate the hand-ticked dropdown beside the calculated column and leave the roster with two answers to one question. Reserving `dues` alone would not do it: `dues_paid` is the name somebody reaches for first, and it is the one phase 4's own walkthrough used — that fixture was deleted from the local database on 2026-08-05, when dues stopped being a custom field. The custom-field mechanism is unchanged and still correct; what changed is that dues turned out to be the wrong thing to build on it.
- Non-calculated fields are edited directly from the directory table, which is what makes them worth having: the alternative is opening 40 member pages to record who ordered which shirt size.
- Values are stored as JSONB on `members` so PostgREST can sort on them; definitions live in their own table and are **archived, never deleted**, since deleting one would silently rewrite what the audit log refers to.
- Every edit is an audited member mutation with a compare-and-set on `members.updated_at` — a column the table did not have before migration 18, because nothing edited a member until now.

*What building it actually settled (2026-08-03):*
- **The compare-and-set token is row-level, so the row owns it, not the cell.** Every inline cell in a row posts the same `updated_at`. Per-cell copies would strand the siblings the moment one saved, and the officer's next edit in that row would report a conflict it had no business reporting. The row holds it in state and adopts the fresh one each save returns — which is why the table stays a Server Component and the *row* is the client boundary. `member_directory` grew `updated_at` for the same reason: both editing screens read the view and compare against the table.
- 🔓 **The definition key is a security control.** It is interpolated into an `order=` term, and an unconstrained one is a sort-injection surface — a comma is parsed as a second order column, while a space or a `"` is accepted *silently*, so "PostgREST rejected it when I tried" is not a boundary. `^[a-z][a-z0-9_]{0,39}$` is enforced in the zod schema, in the migration's CHECK, and again where the order string is built. Sort keys are additionally namespaced `cf:` so an officer-defined field can never shadow a built-in.
- **Nothing ties a stored value to its definition's option list, deliberately.** Editing a list orphans values rather than rewriting members' answers. That creates a rendering obligation, because a `<select>` matching no `<option>` shows blank: an orphan renders as a disabled "no longer an option" entry, so it can be read and cleared but not re-applied.
- **Any officer may define a field and edit a value** (§9 #6 — the audit log is the control, not a role gate). `app/actions/members.ts` carries no role check and says so, so it does not get added back as an oversight.
- **`editable_inline` is a placement flag, not an authorization boundary.** The detail page edits fields with it off, through the same action.

**Selection and extraction (phase 5)**

Three paths out of the system, and they are not redundant: the clipboard is for pasting into something already open, CSV is the interchange format anything can read, and xlsx is the file an officer double-clicks.

*Which rows* — the same answer for all of them:
- Row checkboxes plus **"select all N matching this filter"** — explicitly distinct from "select the 25 rows on this page." Getting this wrong is the classic bug in this kind of screen, and it silently produces a partial email list.

*Which columns* — a **field picker**, new in v1.30 and shared by both file formats:
- The export is not the four columns the directory displays. It is a chosen subset of everything known about a member — the directory columns, the detail page's aggregates (attendance rate, events attended and possible, last seen, joined, source, status), and every custom field.
- Defaults to the displayed columns plus email, which is the common case; the picker is for the officer who wants names and t-shirt sizes and nothing else. Stage 6.5 phase 4 adds dues status to the catalogue as one more entry.
- The chosen field list goes in the audit receipt alongside the filter. Once columns are a choice, "who exported what" stops being answerable from the filter alone.

*Clipboard*
- **Copy emails** as a comma-separated string, ready to paste into a To: field. This is the workflow officers care about most; make it one click with a visible confirmation of how many addresses were copied.
- **Copy as TSV** — pastes directly into Sheets or Excel with columns intact
- **Copy names** for announcements or shoutouts

*Files*
- **Download CSV** — the interchange format, and the one that keeps working if the xlsx writer is ever removed. Pure string formatting in `lib/export.ts`, no dependency.
- **Download `.xlsx`** (v1.30) — a real Excel workbook, not a CSV with the extension changed: one sheet named for the filter, a header row, sensible column widths, points and counts written as **numbers** rather than text, and dates as dates. The point is that it opens ready to sort and pivot, with no import dialog and no "convert to number" pass. Empty `attendance_rate` stays empty, never `0` — the §4.5 null-is-not-zero rule survives the export.
- **Both formats carry the same rows**, because both go through `applyMemberFilter` — the file cannot disagree with the count beside the button unless someone writes a second query, which §4.5 exists to prevent. Columns are the one thing that legitimately differs from the screen, and only because the officer chose them.
- Exports logged to `admin_audit` per §6, each as its own receipt row carrying the filter, the chosen fields, the format, and the row count

*How it is served* — a **Route Handler** (`GET /admin/members/export`), the first in this codebase:
- An xlsx is binary and the download needs `Content-Disposition`; a Server Action returns a value, not a response, so it cannot set either. CSV goes the same way for consistency and because both need the same audit write.
- It starts with `getOfficer()` and returns **403** on failure — not `requireOfficer()`, whose `redirect()` would answer a download request with a login page.
- It writes the audit row **before** streaming, so a client that disconnects mid-download still leaves a receipt. An export that reached the query is an export.
- Generation is buffered in memory (a workbook is a zip; there is no meaningful streaming path). Fine at club scale — a few hundred members — and the reason a hard row cap on the export is a sensible guard rather than a limitation.

**Supporting work**
- Saved filter presets, shared across officers — "award eligible", "missed last 3 meetings", "inactive since October" (phase 7)
- CSV roster import with a preview-and-confirm step, duplicate detection on the normalized EID, and a dry-run row count before committing (phase 7)
- **Merging duplicate members** — see below; this is the piece with real domain logic in it (phase 8)

**Two consequences of §4.2's exact-match check-in land here** (recorded v1.21, while building Stage 5). Neither is a defect in the check-in path — both are the deliberate design's bill, and the directory is where it comes due.

**1. Duplicate members still accumulate, and nothing merges them — but the main source is gone** (revised v1.22). Check-in used to match on `normalized_eid`, then `lower(email)`, then *create*, so a member who mistyped **both** was indistinguishable from a genuinely new person — the two were the same insert — and someone mistyping repeatedly could leave several ghosts. Under §4.2's confirmation flow that submission is refused and re-prompted, writing nothing. What remains is narrower: someone who ticks "this is my first MISA event" *and* types badly, which is a single row rather than a stream, plus the officer-queued collision noted below. Ghosts stay findable — `members.source = 'self_checkin'` marks every auto-created row. What is still missing is the merge itself, and it is not trivial: merging must repoint `attendance.member_id` and `point_adjustments.member_id`, and can hit `attendance_one_per_event` when both identities attended the same event, which is a real conflict needing a decision (keep one, reject the other) rather than a silent drop. Expect a preview-and-confirm flow like the CSV import, and one `admin_audit` row naming both sides. Smaller in expectation than it was, so it can follow the directory rather than gate it.

**1a. A confirmed first-timer can leave a member row with no attendance.** If an officer has already queued a manual row carrying that EID for the event, the member is created and the attendance insert then fails on `attendance_one_per_event`, leaving a `self_checkin` row credited with nothing. Pre-existing, rare, and deliberately not fixed in v1.22: the pre-check that would catch it is a fourth duplicate check, against §4.2's "three checks, not one". Another row for the directory to surface, and another reason merge tooling should assume the roster is untidy.

**2. A valid-but-wrong EID silently credits the wrong member.** The ID lookup runs *before* the email lookup, so someone who mistypes into **another member's** real EID is recorded as that person, even though their own email was correct and would have matched. It is rare and it is not obviously fixable by reordering — people mistype and share emails too, so email-first trades one silent mis-credit for another — but it is the one path where the exact-match design attributes attendance to the wrong human with nothing surfaced to anyone. The directory is where it would be noticed ("why does this member have an event they didn't attend?"), so the member detail page should make a member's attendance easy to scan, and any merge tooling should assume mis-credits exist. Revisit if it ever actually happens; a cheap partial mitigation is to flag, at check-in, when the matched member's email differs from the submitted one.

⚠️ **The EID switch makes this materially more likely, for a reason worth stating plainly** (v1.26). UT EIDs are derived from name initials, so the near-miss population is *correlated with the roster* rather than scattered across a numeric range — students with similar names hold similar EIDs. Under `UT` + a sequential number, a one-character typo landed on a real person only by coincidence and on a plausibly-confusable person almost never. Under EIDs it does both more often. The mitigation does not change — the detail page is still where it surfaces — but this moves from "revisit if it ever happens" toward "expect it", and it is the strongest argument for the email-mismatch flag at check-in.

**Exit criteria** (revised v1.26, re-pointed v1.34): an officer filters the directory to members who have **not paid dues for the current term**, sees an accurate count, clicks copy-emails, and pastes a complete list into an email client — with the list containing every matching member, not just the visible page.

**The criterion is unchanged in substance and changed in mechanism, which affects when it can be claimed.** It has read "Paid Dues = No" since v1.26, when that was a hand-ticked custom field and the query would have been met at the end of phase 5. Under Stage 6.5 dues is a calculated column, so the filter it names does not exist until 6.5 phase 4 — and 6.5 slots between phases 5 and 6 precisely so this stays honest. Phase 5 ships the selection and export machinery; 6.5 makes dues real; the criterion is then demonstrated against the real column at the end of 6.5 phase 4. Demonstrating it against a hand-ticked dropdown in the interim would prove the export works and prove nothing about the question officers are actually asking.

The criterion previously read "attended fewer than three events this term". That query no longer fits the screen it is meant to demonstrate: `events_attended` is not a directory column after phase 3, and filtering narrows to what is displayed. It moves to the relational filters in phase 6.

**Effort:** 4–5 days as originally scoped, and the re-plan adds materially to it — the EID switch is wide and mechanical rather than hard (roughly 41 files, and the seed and fixture regeneration is the bulk of it), while custom fields are a genuine subsystem: a definitions table, an editing surface in a table that was a Server Component, and sorting on values the view cannot hold as columns. The merge tool remains its own estimate on top; that one *is* new domain logic. Otherwise mostly query and UI-state work, but the select-all-matching semantics, the import preview, the inline-edit compare-and-set, and any merge all deserve real test coverage.

---

### Stage 6.5 — Dues & Membership Status 📋 planned, unbuilt (v1.34)
**Goal:** Officers can answer "is this an official member?" from the directory, and the answer comes from money that actually arrived rather than from a box somebody remembered to tick.

**Numbered 6.5 rather than 7 on purpose.** It is stage-sized — a migration, a ledger, an import flow, an editor, a derived column — but renumbering Stages 7 through 10 would touch every stage reference in this document, `tasks.md`, `CLAUDE.md`, and the changelog above, for no gain. It **interrupts Stage 6 between phases 5 and 6**: phase 5 ships the export machinery, 6.5 makes dues real, and Stage 6's exit criterion is then demonstrated against the real column.

| Phase | Scope | State |
|---|---|---|
| 1 | Migration 19, `term_index` / `term_at_index` / `next_term` / `terms_from`, `lib/dues.ts` (parse, term math, matching), the `member_directory` column, the reserved-key widening, tests | ✅ **built 2026-08-06** |
| 2 | The import — `/admin/dues/import`, the two-step parse-preview-commit flow, `app/actions/dues.ts`, batch receipts, audit | ✅ **built 2026-08-06** |
| 3 | The ledger and the editor — `/admin/dues`, `/admin/dues/[id]`, reassign / correct / void, the needs-review queue | |
| 4 | The directory column and filter, the detail page's payment history, and dues added to phase 5's export catalogue | **Stage 6 exit criteria met here** |

Full spec, including the parse decision table: [`docs/dues-and-membership.md`](dues-and-membership.md).

**Official and unofficial**
- The difference is dues, and **dues means a non-voided payment covering the current term** — `member_directory.dues_paid_current_term` (§4.5), rendered **Paid / Not Paid**, filterable, sortable, and nothing more elaborate than that in the table.
- **It gates nothing** (§9 #12). Check-in, points, the leaderboard, and every existing rule are untouched. This is the reversible choice: gating can be added later without a migration, and gating the *leaderboard* would have made the public board reveal who has paid, which §9 #1 identifies as the one privacy decision that cannot be walked back once a search engine has cached it.

**Why a CSV upload rather than an integration**
- Venmo has no API, and its statement export has no year-to-date option — a monthly CSV is genuinely the best available input, not a shortcut. Accept that and design for its consequences instead of around them.
- Officers will upload **overlapping** statements (the 10th and the 28th) to keep the data fresher than monthly. De-duplication is therefore a correctness requirement of the normal path, not an edge case, and the whole design turns on the dedupe key being right.
- 🪤 **Dedupe on Venmo's transaction ID or not at all.** A fingerprint over amount, date, and payer *looks* sufficient and is not: two members can send $30 in the same minute, and collapsing them loses a payment somebody made and can prove they made. ✅ **A real export was checked on 2026-08-05 and carries the ID column**, which is what closed the one open question this stage had. Record the exact header names and the amount format in the spec doc when phase 1 starts — the parser is written against a real header, not a remembered one.

**Matching a payment to a member**
- The link is the **note**, where the payer writes their EID. Matching needs no EID regex: tokenize the note, apply the same fold `members.normalized_eid` uses, and look for a token that *is* some member's normalized EID. Exactly one → linked. Zero → unmatched. Two or more distinct members → queued. The schema has never constrained EID shape and this design does not start.
- **Exact match only.** Stage 5's "don't auto-resolve near-misses" carries over intact and for the same reason. The review queue may *offer* ranked suggestions — reusing `scoreMemberCandidates` from `lib/attendance.ts` rather than growing a second ranker — with nothing preselected.
- **A payment note never creates a member.** Direct extension of §4.2's rule that creating a member is not part of check-in resolution; `createMember` in `lib/checkin.ts` stays the only unauthenticated path that inserts a member.
- **Nothing that arrived as money is dropped on the floor** (§4.2, extended). An odd amount, an unreadable note, no note — the row is stored and queued.

**The review axis is a nullable column, not a status enum**
- `terms_covered` null means "no officer has decided how many terms this bought". $30 and $50 (configured, §4.1) resolve automatically; $35 because somebody tipped, $60 because somebody covered a friend, $20 because somebody underpaid — all parse, all link, all wait.
- `covered_terms` is generated from it, so an undecided row covers nothing and counts for nothing until it is decided. That is the safe default: it under-reports membership rather than over-reporting it, and the queue makes the gap visible.
- Needs-review is `voided_at is null and (member_id is null or terms_covered is null)` — one predicate, two nullable columns, no third concept.

**The import flow — two steps, and the file stays in the browser**
1. A client component reads the CSV with `FileReader` and posts the text to a **parse-only** Server Action, which returns counts and rows: matched, duplicate-skipped, unmatched, needs review. Nothing is written.
2. The same component posts the same text to the commit action, which **re-parses server-side** and writes.
- The server re-derives the whole outcome rather than trusting the previewed payload — the same posture, and for the same reason, as `/attend`'s `step=confirm` (§4.2). A preview is a courtesy to the officer, never an input to the decision.
- No staging table and no base64 round trip. The CSV text lives in client memory between the two steps, which is fine at monthly-statement size and means there is no server-side copy of the org's payment history sitting around (§6).
- Upload is a **Server Action**, not a Route Handler. A Server Action accepts a `File` in `FormData`; the Route Handler rule in this codebase is about *downloads* needing `Content-Disposition`, which is the opposite direction.
- Each import writes one `admin_audit` receipt under entity type `'dues_payment'`, carrying the batch id, the file name, and the four counts. `import_batch_id` on every row makes a bad import reviewable and bulk-voidable without a staging table.

**Correcting what the parser got wrong**
- `/admin/dues/[id]` reassigns the member, sets or corrects `terms_covered` and `start_term`, and voids with a reason. Compare-and-set on `updated_at`, audited like every other officer mutation.
- **Editable *and* voidable**, which is the union of the two patterns already in the schema and worth stating: a payment is editable because the parser can attribute it wrongly and correcting that is legitimate; it is voidable rather than deletable because money arriving is a fact. `point_adjustments` is voidable but not editable; `attendance` is editable but not voidable; this is both, deliberately.
- ⚠️ **Voiding a payment can make a member unofficial retroactively.** Correct — the status is a live derivation, not a stored flag — and surprising, which is why the void requires a reason.

**Exit criteria:** an officer uploads two overlapping Venmo statements back to back; the second reports the earlier payments as duplicates and adds only what is new; a payment whose note carried a typo'd EID appears in the review queue, is assigned to the right member in one action, and that member's row in the directory flips to **Paid** — after which filtering the directory to Not Paid and clicking copy-emails produces a complete list, which is Stage 6's criterion met against the real column.

**Effort:** 3–4 days. The parse and term math are pure and testable and will not be where the time goes; the import preview, the needs-review queue, and getting the dedupe genuinely right will be. Budget real test coverage for the overlapping-statement case specifically — it is the normal path here, it is the one a demo will not exercise, and it is the one whose failure silently double-counts somebody's dues.

---

### Stage 7 — Member-Facing Views
**Goal:** Members can answer their own questions.

- `/leaderboard` — one row per member for the current term, ranked on `total_points`, ties alphabetical (§4.4)
- **`/leaderboard` must set `robots: { index: false, follow: false }`** (§9 #1, resolved). The page is reachable by anyone with the link; it must not be crawlable. `app/admin/(shell)/layout.tsx` already does exactly this and is the pattern to copy. Getting this wrong is not a bug you can fix afterwards — once students' names are indexed against their point totals, the cache outlives the deploy that caused it
- **The active term shown prominently on the page.** It is officer-set with no automatic rollover, so a stale term must be visible rather than silently assumed correct
- `/lookup` — EID + email, returns per-event attended/missed summary
- **Dues status on `/lookup`, and only there** (v1.34). The member sees whether they are an official member for the current term and what they are paid through — the question they will otherwise ask an officer by text message. 🔓 **It stays behind the EID + email gate and goes nowhere else.** §6 accepts that check-in makes roster membership probeable with an EID alone; extending that to "has this person paid" is a different order of exposure, and the double gate is the entire reason this is acceptable. It must never reach `/leaderboard`, which is public and (§9 #1) uncorrectable once indexed
- Any point adjustments shown with their reason. The public board is a bare total, so this is the *only* place a member can see why their total exceeds their attendance count — which makes it more important here, not less
- Pending submissions shown distinctly from confirmed ones, so a member who checked in late knows their form was received and is awaiting review rather than assuming it vanished
- Attendance-rate calculation and a visual summary of the semester

**🪤 Carried forward from Stage 5 — add the `/leaderboard` revalidation the day the route ships.** `revalidatePoints` in `app/actions/points.ts` revalidates the ledger and the adjustment detail, and deliberately does not revalidate `/admin` (nothing on the dashboard aggregates points). It cannot yet revalidate `/leaderboard`, because there is no such route. Granting and voiding both move public standings, so a board that silently serves a stale cache is the failure mode — and it would be found three stages after the code that caused it. The comment in `revalidatePoints` says the same thing; this is the copy that will actually be read while building this stage.

**Exit criteria:** a member can determine their own standing, why it is what it is, which specific events they missed, and whether anything of theirs is still pending — without asking an officer.
**Effort:** 3 days.

---

### Stage 8 — Hardening & Data Integrity
**Goal:** Trust the data enough to base decisions on it.

- Write and test every RLS policy; attempt each forbidden operation with the anon key and confirm it fails
- Confirm `admin_audit` is append-only: no client role can update or delete a row
- Verify officers cannot grant points or approve attendance for themselves without it being visible in the ledger
- Attendance and adjustment export for archival
- Error boundaries, loading states, empty states

**Exit criteria:** attempting to read the roster, write attendance, grant points, or alter an audit row directly with the anon key fails for every table.
**Effort:** 3–4 days. Historically the stage most likely to be skipped and most likely to be regretted.

---

### Stage 9 — Launch
**Goal:** In real use by real members.

- Custom domain purchase + DNS to Vercel; update Supabase redirect URLs
- Migrate historical data from the existing spreadsheet tracker
- Officer walkthrough and a one-page written handoff guide — the account side is just the shared login plus §2.3; the guide's real content is operations (review queue, semester wake-up check, event duplication)
- Soft launch at one event with a paper backup sign-in sheet on hand

**Exit criteria:** one full event runs on the system with no manual intervention.
**Effort:** 1–2 days plus migration time, which depends on how clean the existing data is.

---

### Stage 10 — Post-v1 Backlog
Not commitments — a parking lot, roughly ordered by value per unit of effort.

- QR code per event linking to a pre-filled check-in
- Rotating per-event check-in code to prevent remote check-ins
- Email the member automatically when their pending submission is approved or rejected
- Member-initiated attendance appeal from `/lookup`, which opens a pending row directly in the review queue
- Email reminders before events and end-of-semester standing summaries
- Officer roles with differentiated permissions
- Attendance analytics: trends over time, retention curves, event-type comparison
- Member accounts with saved profiles
- Public event calendar feed (iCal)

**"Dues tracking and payment status" was on this list and is now Stage 6.5** (v1.34). What remains deliberately out of scope, and should stay on this list rather than creeping into 6.5:

- **In-app payment.** A checkout button is not a bigger version of what 6.5 builds — it is a different system with card data, a processor, refunds, and chargebacks in it, and it converts §1.3's non-goal and §2.2's Vercel Hobby clause from "does not apply" to "applies". Proposing it is a hosting-plan decision as much as a feature request.
- **Automated reminders to unpaid members.** Cheap to build on top of the dues column and easy to get wrong in a way that emails somebody who paid in cash last week. Wants a human in the loop until the data has been trusted for a semester; copy-emails from the directory is that human loop.
- **Refund handling as its own concept.** A refund is currently a void with a reason, which records that the payment no longer counts without pretending the system moved money. A first-class refund only makes sense alongside in-app payment.
- **Partial-payment tracking and payment plans.** An underpayment is an undecided row today (nullable `terms_covered`) and an officer resolves it. Modelling a balance is a real feature and nobody has asked for it.

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase free-tier project pauses between semesters | Medium | Medium | Calendar reminder to wake the project before the first event of each term |
| Members check in without attending | Medium | Low | Accepted for v1; per-event codes in Stage 10 |
| Schema change needed after UI is built | Medium | Medium | Invest in Stage 1; seed realistic data early to surface modeling gaps |
| Overlapping events create ambiguous matching | Low | High | Constraint at publish time; explicit test coverage in Stage 3 |
| Pending queue is never reviewed and members lose credit | Medium | High | Pending badge on the admin dashboard; oldest-first default sort; make queue review part of the officer handoff doc |
| Late check-in becomes the norm once members learn overrides exist | Medium | Medium | Widen `checkin_closes_at` if it's systemic; the audit log makes the pattern visible per member |
| Discretionary points quietly decide the leaderboard | Medium | Medium | **Weakened by design (§4.4):** the public leaderboard shows a single total, so members cannot see the composition of the standings. Remaining controls are officer-side only — the split columns in `member_directory`, the required reason on every grant, and the `/admin/points` ledger surfacing per-officer patterns |
| Empty leaderboard at the start of a term | Medium | Low | Rollover is automatic on Aug 1 / Jan 1 (§4.7), so the new term's board is all zeros until the first event. Pin `app_settings.current_term` to the previous term over the break, or accept it. Display the active term on the page either way |
| Event rescheduled across a term boundary moves points between semesters | Low | Medium | `events.term` is generated from `starts_at`, so it re-tags silently. The edit form compares `term_of(old)` with `term_of(new)` and warns (§4.6) |
| Officer edits an event's points and silently changes past standings | Medium | Medium | Edit-impact warning with affected-member count before saving; before/after captured in `admin_audit` |
| Bulk email copy grabs only the visible page | Medium | Low | Explicit "select all N matching" semantics with the count shown on the copy confirmation; covered by tests in Stage 6 |
| Project has no maintainer after handoff | High | High | Written handoff doc, plain-vanilla stack, no exotic dependencies; all services under one dedicated, transferable org account and the database recreatable from the repo (§2.3) |
| MISA email lost or inaccessible | Low | High | It is the password-reset address for every other account, so this is the worst single failure. Keep ≥2 GitHub org Owners, and store 2FA recovery codes outside the account they protect (§2.4, §2.5) |
| Credentials live only on one officer's laptop | High | High | Currently true of the Supabase database password. Resolve §2.5 and fill in §2.4 before handoff — a password nobody else can reach is the same as a lost one |
| Scope creep delays past the semester start | High | Medium | Stage 10 exists precisely so good ideas can be recorded and deferred |
| A mutation succeeds but its `admin_audit` row does not | Low | Medium | **Accepted for v1 (Stage 4).** PostgREST cannot transact across statements, so the mutation and the audit insert are two round trips. The action logs the failure and still reports success, because the change really happened and reporting failure would invite a duplicate retry. Controls: every mutation's audit row is asserted in the Vitest suite, and the fix — one plpgsql RPC per mutation doing both in one transaction — is a post-v1 item |
| No officer can sign in because nobody can reset a password | Medium | High | There is no self-serve password reset: it needs SMTP, and the built-in sender is capped at 2 emails/hour and not for production. The v1 path is `scripts/create-officer.mjs --reset-password` run by another officer, or the Supabase dashboard. Keep ≥2 officers with `admin_profiles` rows so this is never one person's problem (§2.4) |
| A recurring series silently shifts an hour after the November clock change | Low | Medium | Series expansion iterates Central civil dates and attaches wall time last, never adding 7×24h to a UTC instant. Locked down by fixtures either side of the 2026-11-01 transition |
| Test suite fails intermittently and the failures get dismissed as flaky | Medium | High | **Found and fixed in Stage 5 (v1.20), and it predated Stage 5.** Vitest ran test files in parallel while every integration file shared the one local Supabase stack; its Kong gateway returns 502s (`An invalid response was received from the upstream server`) under concurrent workers. A *different* test failed on each run and each passed in isolation, so it read as a bad assertion rather than as saturation — roughly a 50% per-run failure rate. `fileParallelism: false` in `vitest.config.ts` fixes it: 0 failures across repeated runs, whole suite still ~4s. The danger was never the flake itself but the habit it teaches — a suite that cries wolf is one whose real failures get re-run instead of read |
| Officer distrusts a correct screen because a view filter is invisible | Medium | Medium | Approving against a draft event moves the public board (the `leaderboard` view excludes only `cancelled`), and approving for an inactive member moves nothing public (the view filters `m.active`). Both are correct and both look wrong. `previewResolution()` surfaces each as a named warning at resolution time (§4.4) |

---

## 9. Open Decisions

### Resolved before Stage 1 (2026-07-29)

The five that affect the schema. Decided together; the schema in §4 reflects them.

2. **Roster policy** — ✅ **Self-registering, confirmed by the member** (revised v1.22; originally "self-registering, no confirmation"). Lookup order is `normalized_eid`, then `lower(email)`; matching on email second contains the common typo case. What happens when both miss depends on the member's own "this is my first MISA event" claim: ticked, they confirm their details on a review screen and are added immediately as `source = 'self_checkin'`, active, with no officer approval; unticked, nothing is written and they are re-prompted. The original decision created a member unconditionally, which made a double typo and a genuinely new person the same insert. The residual risk moved with it — no longer a duplicate person, but someone who cannot get their details right getting no attendance at all, recovered by officer manual entry. `members.source` still marks self-registered rows for review. Zero-friction check-in at recruiting events is preserved for everyone the roster already knows: their path is unchanged and still a single submit.
3. **Points weighting** — ✅ **Per-event `points`, default 1.** Flat scoring in practice, weighting available without a migration.
4. **Semester boundaries** — ✅ **One leaderboard, current term only, terms derived from dates.** One row per member ranked on a single `total_points` figure with no attendance/bonus breakdown; ties alphabetical. `events.term` is a generated column computing `'Fall YYYY'` / `'Spring YYYY'` from `starts_at` (§4.7), so terms are never typed and rollover happens on its own each August and January. `app_settings.current_term` is a nullable override for pinning the board on a finished term. This reverses the split-column position earlier versions argued for; see §4.4 for what that costs and where the oversight moved.
5. **Excused absences** — ✅ **Deferred to post-v1.** Attendance rate stays raw `attended / possible`. `point_adjustments` already handles the standing side with a required reason, so the gap is cosmetic rather than punitive.
7. **Orphan grace window** — ✅ **48 hours**, as one exported constant feeding `nearby_events()`.

### Resolved at Stage 5 (2026-07-31)

All four land in the review queue or the points ledger, and building either one decides them by default — so they were decided explicitly instead.

They share a premise, and the consistency is the point: **the audit log and the ledger are the control, not a gate.** A system that gates point grants but not attendance approvals teaches officers that the gates are arbitrary, which is worse than having none.

6. **Override authority** — ✅ **Any officer may approve a pending row.** A gate funnels every correction through one person, which in a student org means corrections wait for whoever is busiest; and the failure it guards against is visible in `admin_audit` either way.
8. **Resolution deadline** — ✅ **None enforced in v1.** The mitigations are the dashboard pending badge and the oldest-first default sort on `/admin/attendance`, both built in phase 1. A hard deadline would silently destroy credit for a member who did attend, which is the one failure mode §4.2 exists to make impossible.
9. **Point grant caps** — ✅ **No restrictions.** Any officer may grant any amount; no `admin`-role threshold. A cap invites splitting a grant in two, which leaves the total unchanged and the ledger *less* readable. The required reason and the ledger are the control. `lib/points.ts` carries `MAX_POINTS_PER_GRANT = 500`, which is an input-sanity guard against a fat-fingered 5000 and explicitly **not** this policy — do not let it drift into being cited as one.
10. **Self-grants** — ✅ **Allowed**, always visible in the ledger with the granting officer named. Blocking it outright doesn't prevent the behaviour, it relocates it to "could you grant me these" — after which the ledger shows a grant from someone with no visible stake, which is harder to audit rather than easier. `grantPoints` therefore carries no self-grant check, and no officer↔member linkage is needed (there is no FK between `auth.users` and `members`, so such a check would have to match on email or EID — an inference this decision makes unnecessary).

**Revisit all four together if points ever decide something material** — officer eligibility, a funded trip, a leadership slot. Every one of them is defensible because standings are currently social rather than consequential; that premise is what changes, not the individual arguments.

The two member-facing decisions were settled in the same pass:

1. **Leaderboard visibility** — ✅ **Public, but never indexed.** Reachable by anyone with the link; `robots: { index: false, follow: false }` on the route. The board has to be glanceable to be worth building, but a search cache outlives the deploy that filled it, so indexing real names against point totals is the one part of this that cannot be walked back. See §4.4 and the Stage 7 checklist.
11. **Bonus points in public standings** — ✅ **A single total, attendance and bonus added silently.** This confirms §4.4 rather than changing it, and closes the contradiction the row had carried since v1.16: it was written expecting a separate public column, which §4.4 later resolved against. The doc is now self-consistent, and the split stays officer-only in `member_directory` and the `/admin/points` ledger. Accepted cost, stated plainly: a member sees a number and cannot tell that five of their thirteen points were granted rather than earned. The underlying data is unchanged, so restoring a split later is a view change with no migration.

### Resolved at Stage 6.5 (2026-08-05)

One decision, and it earns a place here rather than in Stage 10 because it constrains the schema and the security model rather than describing a feature.

12. **Membership status and what it gates** — ✅ **Official membership is dues-paid for the current term, and it gates nothing.** It is a directory column, a filter, and a line on the member's own `/lookup`; check-in, point accrual, and the leaderboard are untouched. Three alternatives were considered and all three were rejected on the same grounds — that they are hard to walk back. Gating the **leaderboard** would make the public board reveal who has paid, and §9 #1 above establishes that a public board is the one privacy choice this project cannot undo once a search engine has cached it. Gating **check-in** would contradict §4.2's rule that nothing resolving to a known member is dropped on the floor, turning an unpaid member away at the door with no record they attended. Gating **point accrual** would need retroactive backfill the moment somebody paid late, which is real complexity bought for a policy nobody has asked for. The reporting-only choice costs nothing and is reversible: adding a gate later is application logic over a column that already exists, and needs no migration. **Revisit if dues ever decide something material** — an officer-eligibility rule, a funded trip — which is the same trigger the four Stage 5 decisions above share, and for the same reason: these are all social until they are not.

---

### Still open

**None.** All twelve are resolved. Anything new belongs in §7 Stage 10 as backlog rather than being appended here — this section is the record of what was decided, not a running inbox. #12 was added deliberately, under its own heading, because Stage 6.5 raised a genuine schema-and-security decision; that is the bar, and "we should note this somewhere" is not it.

---

## 10. Repository Layout

```
/app
  /(public)
    page.tsx                 landing
    /about, /gallery, /officers, /projects, /contact
    /attend/page.tsx
    /leaderboard/page.tsx    Stage 7
    /lookup/page.tsx         Stage 7
  /admin
    /login/page.tsx          outside the (shell) group — see the note below
    /(shell)                 authed chrome; route groups don't appear in URLs
      page.tsx
      /events/...
      /attendance/...
      /points/...
      /members/...           directory, /[id] detail page, and /fields (list,
                             /new, /[id]) for the custom-field definitions.
                             /export/route.ts is phase 5 — the one Route
                             Handler, because a download needs response headers.
                             _components: member-table.tsx stays a SERVER
                             component; directory-row.tsx is the client row that
                             owns the compare-and-set token; member-field-cell.tsx
                             is the one editable cell, shared with /[id]
      /dues/...              Stage 6.5 — the ledger, /[id] payment detail, and
                             /import. The import is a Server Action, NOT a route
                             handler: a Server Action takes a File in FormData,
                             and only downloads need response headers. Its client
                             component holds the CSV text between the preview
                             step and the commit step, so nothing is staged
                             server-side
  /actions
    attendance.ts            submitCheckin ONLY — see note below
    attendance-review.ts     officer resolution mutations
    events.ts
    points.ts                grantPoints, voidAdjustment — and nothing else
    auth.ts                  sign in / sign out
    members.ts               setMemberFieldValue, saveMemberNotes,
                             saveFieldDefinition, setFieldArchived. No role
                             check anywhere in it, deliberately (§9 #6)
    dues.ts                  Stage 6.5 — previewImport (parse only, writes
                             nothing), commitImport (re-parses server-side
                             rather than trusting the preview), and the
                             corrections: reassign, set terms, void
    audit.ts                 shared admin_audit writer (no "use server")
/lib
  supabase/
    server.ts                anon server client
    client.ts                browser client
    admin.ts                 service-role client, `server-only`-guarded —
                             the only place it is constructed (§6)
  types/database.ts          generated types
  validation.ts              zod schemas
  attendance.ts              resolution core: interval parsing, gap
                             description, member scoring, previewResolution
  points.ts                  point categories, formatting, grant bounds
  events.ts                  event domain core
  checkin.ts                 check-in resolution core
  auth.ts                    getOfficer / requireOfficer
  event-options.ts           all-status event list, shared by queue filter,
                             resolution form, manual entry
  member-options.ts          bounded active-roster scan, shared by the
                             resolution form, manual entry, grant picker
  admin-profiles.ts          fetchOfficerNames — actor_id FKs auth.users,
                             which has no PostgREST path to admin_profiles
  site.ts / officers.ts      org copy and the officer roster
  filters.ts                 directory filter → SQL translation. One filter
                             object, one translation; pagination stays outside
                             it so the export is the same query (§4.5)
  export.ts                  CSV / TSV / clipboard formatting and the exportable
                             field catalogue (phase 5a). Pure — rows and a field
                             list in, a string out; the audit write and the
                             response headers belong to the Route Handler. The
                             typed ExportCell union is what lets the CSV formula
                             guard fire on text and never on numbers
  xlsx.ts                    the workbook writer (phase 5b) — a ZIP container
                             over node:zlib plus the six OOXML parts. Split from
                             export.ts rather than folded into it, and
                             hand-rolled rather than a dependency: SheetJS's npm
                             package is four years stale and exceljs inactive
                             since Oct 2023. Consumes the SAME projectRow output
                             as the CSV writer; only the formatting differs, and
                             the two must never share a "join with commas"
                             shortcut
  members.ts                 member domain core: classifyTermEvents (the detail
                             page's three-state grid), formatAttendanceRate,
                             and the custom-field core — FIELD_KEY_PATTERN (a
                             security control, not a naming rule), the `cf:`
                             sort namespace, fieldValue / setFieldValue,
                             fieldOptions (the orphan case), isAllowedFieldValue,
                             withoutToken, and the two AUDITED_*_COLUMNS lists
  member-fields.ts           fetchFieldDefinitions — the live definitions, read
                             once per request and shared by the directory's
                             columns and sort, the detail page, the fields admin
                             screen, and phase 5's field catalogue. Deliberately
                             uncapped: nobody hand-creates 500 dropdowns, and
                             show_in_directory is the bound that matters
  dues.ts                    Stage 6.5 phase 1, built — the dues domain core,
                             pure like the rest of this list. parseCsv (a real
                             tokenizer: the Venmo footer is a quoted field
                             spanning newlines, so split("\n") breaks on the
                             last record of every file), parseVenmoStatement,
                             parseAmountCents (the sign is a separate token
                             before the $), parseVenmoDatetime (⚠️ the stamp
                             carries NO timezone — treated as Central wall
                             time), matchNote, termsForAmount, planPayment —
                             the decision table in one place — and the term
                             arithmetic. 🪤 Terms do not sort
                             lexicographically: every "which term is later"
                             question goes through termIndex / isLaterTerm
                             here, never a string compare at a call site
/supabase
  /migrations                versioned SQL
  seed.sql
/components
  /ui                        shared primitives
  ...
proxy.ts                     admin route protection (Next 16 rename of middleware.ts)
```

**Why officer attendance mutations live apart from `app/actions/attendance.ts`** (v1.20): that module holds `submitCheckin`, the single unauthenticated write path in the whole system and what §6 calls the main attack surface. Every export of a `"use server"` module is a publicly callable endpoint, so keeping it a one-export file makes "what can an anonymous user POST to" a one-file answer — and removes the chance of someone adding an unguarded export next to a guarded one. Officer mutations go in `attendance-review.ts`, where every export opens with `getOfficer()`.

**`/admin/login` sits outside the `(shell)` route group deliberately.** The shell's `layout.tsx` calls `requireOfficer()`, so a login page inside it could never be reached by anyone who needed it — the page would redirect to itself. Route groups don't appear in URLs, so the route table in §5 is unaffected by the grouping.

**`lib/` modules ending in a domain name are pure** — no `next/*` imports, no `server-only` guard — so Vitest calls them directly with injected clients and timestamps. `events.ts`, `checkin.ts`, `attendance.ts`, and `points.ts` all follow this. Anything request-shaped belongs in `app/actions/`. This is what keeps the resolution logic testable without a running Next server.

**The `*-options.ts` modules are a different thing and shouldn't be mistaken for domain cores.** `event-options.ts`, `member-options.ts`, and `admin-profiles.ts` are shared *fetches* — each takes a client and returns a list a page renders. They exist because three call sites needed the same query and the copies had already drifted once. They format their labels server-side, which is not incidental: `Intl.DateTimeFormat` inside a Client Component is a hydration mismatch, so a picker's option text has to arrive as a prop.
