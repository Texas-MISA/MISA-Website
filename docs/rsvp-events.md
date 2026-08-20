# RSVP events — attendance taken from a list, not from a form

**Status:** 📋 **NOT BUILT.** Requested 2026-08-19. Nothing described here
exists: `events` has no attendance mode, there is no `event_rsvps` table, no
`/rsvp` route and no officer check-off screen. This document is the plan.

**What was asked for**, in substance: a new *kind* of event where members do not
enter their own attendance. Selecting that kind enables a shareable RSVP link on
the event's detail page. Members RSVP with name, email and EID, and see a
disclaimer that **not showing up after an RSVP may carry a penalty**, and that
anyone who cannot attend should **contact MISA at least 24 hours ahead**.
Officers then tick people off the RSVP list to write their attendance, with a
manual path for someone who came without RSVPing. Members **cannot** use
`/attend` for such an event.

Everything below is about making that fit the system that already exists rather
than bolting a second attendance mechanism beside the first. Three things decide
the shape, and they are worth reading before the schema:

1. **"Cannot use `/attend`" has to be enforced in SQL**, not in the form,
   because the form is not where the decision is made — `open_event_at()` is.
2. **An RSVP is not attendance.** It is a claim about the future. Nothing about
   it may reach the leaderboard, and the attendance row it eventually produces
   must be an ordinary attendance row that every existing screen already
   understands.
3. **"May carry a penalty" is the sentence in here with consequences.** The
   moment points can be taken away for not turning up, standings stop being
   social — which is the stated trigger to re-open four resolved decisions. See
   *The penalty*, §7; it is not a footnote.

---

## The shape in one pass

| | |
|---|---|
| New column | `events.attendance_mode` — `'checkin'` (today's behaviour, the default) or `'rsvp'` |
| New column | `events.rsvp_closes_at` — nullable, falls back to `starts_at` |
| New table | `event_rsvps` — one row per person per event, deny-all RLS |
| New public route | `/rsvp/[id]` — the shareable link |
| New officer route | `/admin/events/[id]/rsvps` — the list, the check-off, the manual add |
| New action file | `app/actions/rsvp.ts` — `submitRsvp` only, the **fourth** unauthenticated endpoint |
| New action file | `app/actions/rsvp-review.ts` — officer-side: check off, link, cancel, add manually |
| New core | `lib/rsvp.ts` — window, resolution, no-show derivation, check-off planning |
| Changed SQL | `open_event_at()`, `nearby_events()`, `events_no_overlapping_checkin`, `attendance.source`, `admin_audit_entity_type_check` |
| Unchanged | `leaderboard`, `member_directory`, `/attend`'s copy, `/lookup`, every existing screen's semantics |

---

## 1. Enforcing "not through `/attend`" — three places, all in SQL

`/attend` does not choose an event. `resolveCheckin` asks the database
(`open_event_at(now)`), and the window semantics live entirely in SQL precisely
so they cannot drift between the constraint, the function and the app. So the
mode filter goes in the same place, and the check-in form needs no knowledge of
RSVP events at all.

**All three must move together**, and the third is the one that gets forgotten:

```sql
-- 1. The event that /attend resolves to. THE control.
create or replace function public.open_event_at(ts timestamptz default now())
returns setof public.events language sql stable as $$
  select * from public.events
  where status = 'published'
    and attendance_mode = 'checkin'          -- ← new
    and ts >= coalesce(checkin_opens_at, starts_at)
    and ts <  coalesce(checkin_closes_at, ends_at)
  order by starts_at desc limit 1;
$$;

-- 2. The orphan suggestions. Without this, a member who tries /attend during
--    the banquet is not refused — they are QUEUED as pending against it, and
--    an officer resolves them straight into the event they were not allowed to
--    check into. The rule would hold on the happy path and leak on the queue.
create or replace function public.nearby_events(...) ...
  where e.status = 'published'
    and e.attendance_mode = 'checkin'        -- ← new
    and ts between ...

-- 3. The exclusion constraint. An RSVP event no longer claims any check-in
--    instant, so it must stop reserving one — otherwise a 6–9pm banquet makes
--    a concurrent workshop unpublishable for a reason nobody can see.
alter table public.events drop constraint events_no_overlapping_checkin;
alter table public.events add constraint events_no_overlapping_checkin
  exclude using gist (
    tstzrange(coalesce(checkin_opens_at, starts_at),
              coalesce(checkin_closes_at, ends_at), '[)') with &&)
  where (status = 'published' and attendance_mode = 'checkin');
```

🪤 **Narrowing the constraint means switching an event's mode can now fail.** An
RSVP event overlapping a published check-in event is legal; flipping it to
`'checkin'` raises `23P01` on the UPDATE. That is correct — but `saveEvent` must
catch it and render a field-level message, or an officer sees a generic error on
a form that looks fine. The same treatment `valid_window` already gets.

**The member-facing result is the message that already exists.** No open event
means the existing refusal or orphan path, and no new copy — so nothing here
widens §6's roster-membership oracle, because event resolution runs first and
refusal short-circuits it. Someone posting to `/attend` during a banquet learns
only that no event is open, which is exactly what they learn in July.

🪤 **The real failure mode is navigational, not technical.** Any surface listing
upcoming events must send an RSVP event to `/rsvp/[id]` and never to `/attend`.
A member who follows a stale link and gets "no event is open right now" while
standing in the room reads that as a broken site, and will say so to an officer
rather than to the form.

📌 **`previewResolution` gains a warning**, not a block: an officer *may* assign
a queued submission to an RSVP event, because officer manual entry is the
standing recovery path (§4.2) and blocking it would strand the one member whose
RSVP never arrived. It joins the draft-event and inactive-member warnings in
`lib/attendance.ts` — the same category, for the same reason: correct, and it
looks wrong.

---

## 2. Schema — one migration (26)

### 2.1 Two columns on `events`

```sql
alter table public.events
  add column attendance_mode text not null default 'checkin'
    check (attendance_mode in ('checkin','rsvp')),
  add column rsvp_closes_at timestamptz,
  add constraint valid_rsvp_window check (
    rsvp_closes_at is null or rsvp_closes_at <= ends_at
  );
```

**Why a column and not a `category` value.** `category` is deliberately free
text — the app offers a vocabulary, the database does not constrain it. Gating
the check-in form on a free-text field means a typo (`'rvsp'`) silently reopens
`/attend` for an event that must not accept it. A closed CHECK makes the wrong
value a write failure instead of a privacy-shaped surprise.

**Why not a boolean `rsvp_only`.** The name is a mode, and it is read in three
SQL bodies and half a dozen screens; `attendance_mode = 'rsvp'` says what it
means at every one of them, and a third mode later is a widened CHECK rather
than a second boolean that can contradict the first.

**`rsvp_closes_at` is one column meaning exactly one thing.** The temptation is
to reuse `checkin_opens_at` / `checkin_closes_at` — they are dead weight on an
RSVP event now that `open_event_at()` ignores it. Don't: `valid_checkin_window`
constrains them, the exclusion constraint reads them, and a column that means
"check-in window" on one row and "RSVP deadline" on another is a pun that will
be resolved wrongly by whoever meets it second. Null falls back to `starts_at`,
the same coalesce pattern the check-in columns already use.

⚠️ **`rsvp_closes_at` is not the 24-hour cancellation deadline.** It is when the
list stops accepting new names. The 24 hours is a club policy about cancelling
an RSVP already made, and nothing in the system computes it — see §5.

### 2.2 `event_rsvps`

```sql
create table public.event_rsvps (
  id               uuid primary key default gen_random_uuid(),
  -- restrict, not cascade or set null: an RSVP with no event is meaningless,
  -- and silently vaporising the list is worse than a loud refusal. See below.
  event_id         uuid not null references public.events(id) on delete restrict,
  -- Nullable, resolved best-effort. An RSVP from someone the roster does not
  -- know is a real RSVP; it just cannot be checked off until it is linked.
  member_id        uuid references public.members(id) on delete set null,
  submitted_name   text not null,
  submitted_eid    text not null,
  -- IDENTICAL to members.normalized_eid and attendance.normalized_eid as they
  -- stand after migration 16 — lower(), not upper(). tests/normalization.test.ts
  -- must grow a third case rather than trusting this to be copied right.
  normalized_eid   text generated always as
                     (lower(regexp_replace(submitted_eid, '\s|-', '', 'g'))) stored,
  submitted_email  text not null,
  submitted_at     timestamptz not null default now(),
  -- Liveness is a nullable timestamp, exactly like point_adjustments.voided_at
  -- and officer_invites' claim: one column, and no status enum that can
  -- disagree with it. cancelled_at also carries the fact the 24-hour rule
  -- needs — WHEN.
  cancelled_at     timestamptz,
  cancelled_reason text,
  note             text,
  updated_at       timestamptz not null default now(),
  constraint event_rsvps_name_not_blank  check (length(trim(submitted_name))  > 0),
  constraint event_rsvps_eid_not_blank   check (length(trim(submitted_eid))   > 0),
  constraint event_rsvps_email_not_blank check (length(trim(submitted_email)) > 0),
  constraint event_rsvps_cancel_reason_needs_cancel check (
    cancelled_reason is null or cancelled_at is not null
  )
);

-- One live RSVP per person per event. Partial on cancelled_at so a cancelled
-- RSVP can be re-made, mirroring attendance_one_per_event's exclusion of
-- rejected rows, for the same reason.
create unique index event_rsvps_one_per_event
  on public.event_rsvps (event_id, normalized_eid)
  where cancelled_at is null;

create index event_rsvps_event_idx  on public.event_rsvps (event_id, submitted_at);
create index event_rsvps_member_idx on public.event_rsvps (member_id)
  where member_id is not null;

create trigger event_rsvps_set_updated_at
  before update on public.event_rsvps
  for each row execute function public.set_updated_at();

alter table public.event_rsvps enable row level security;
-- Deny-all, no policies, service role only — the house rule for every new
-- table. The RSVP page writes through a Server Action like every other write.
```

**What is deliberately NOT on this table:**

- 🔓 **No `attended` flag and no `attendance_id`.** Whether an RSVP turned into
  attendance is derivable — a non-rejected `attendance` row for
  `(event_id, member_id)` — and an unmatched RSVP cannot have one at all,
  because `present_requires_resolution` forbids it. A stored flag would be a
  second source for one fact and would go stale the instant an officer rejects
  the attendance row. Same doctrine as *dues status is calculated, never
  ticked*.
- **No `status` enum.** `cancelled_at is null` is the whole of liveness, and it
  is the one definition — the shape `inviteState` and `voided_at` already use.
- **No capacity or waitlist.** A cap turns RSVP into a race with an ordering
  policy and a promotion rule, which is a different feature. If the officer
  needs one, it is its own plan; do not add a number that silently truncates.
- **No token per RSVP.** Nothing here is a capability — see §4.

⚠️ **`on delete restrict` means `deleteEvent` must re-count RSVPs and refuse**,
exactly as it already refuses to delete an event with attendance, and offer
`status = 'cancelled'` instead. The FK is the loud backstop behind that check,
not a substitute for it: the invariant from the merge tool applies here too —
only a `restrict` FK fails loudly, and that is why it was chosen over the
`set null` that `attendance.event_id` carries.

### 2.3 A third `attendance.source`

```sql
alter table public.attendance drop constraint attendance_source_check;
alter table public.attendance add constraint attendance_source_check
  check (source in ('self_checkin','admin_manual','rsvp'));
```

A check-off is neither a self check-in nor an officer typing in someone who
never used the form — and `source` exists so that reading the ledger back a year
later distinguishes exactly these. The manual-add path on the same screen keeps
`'admin_manual'`, because that is what it is; two paths, two sources, and the
distinction is the point.

⚠️ **Widening the SQL check and widening the TypeScript is ONE edit.** The
identical pattern drifted twice on `admin_audit.entity_type` — migration 19
added `'dues_payment'` to the constraint and not to the union, and the union
carries a 🐛 note saying so. The four places here: `ATTENDANCE_SOURCES` and
`formatAttendanceSource` in `lib/attendance.ts`, the queue's source filter in
`lib/ledger-filters.ts`, and the attendance archive's column in
`lib/export-ledgers.ts`.

### 2.4 Audit vocabulary

```sql
alter table public.admin_audit drop constraint admin_audit_entity_type_check;
alter table public.admin_audit add constraint admin_audit_entity_type_check
  check (entity_type in (…, 'event_rsvp'));
```

Its own entity type, not `event` and not `attendance`: an RSVP is a row with its
own history, and "someone cancelled Priya's RSVP" is not an event edit. The same
reasoning that gave `member_field` and `member_preset` theirs.

New `AuditAction` values — **added in the same commit as the CHECK**:

- `rsvp.cancelled` — an officer withdraws an RSVP, with a reason.
- `rsvp.linked` — an officer points an unmatched RSVP at a member.
- `attendance.created` is **reused** for the check-off. Granularity follows
  officer intent, and the attendance row's own history should read the same
  whether it came from the queue, the manual form or the RSVP list; the batch
  context travels in `note`, as bulk assignment's already does.

📌 **An RSVP submission itself writes no audit row.** There is no acting officer,
and `submitted_at` plus the row already record it — the same call
`members.source = 'self_checkin'` makes for self-registration.

---

## 3. `lib/rsvp.ts` — the core

Pure, no `next/*` imports, callable from Vitest with injected timestamps — the
contract `lib/checkin.ts` and `lib/events.ts` already hold, and for the same
reason: the RSVP page is a Client Component and will import from it.

- `rsvpWindow(event, now)` → `"open" | "closed" | "not_rsvp_event"`. Half-open
  at the top: `now < coalesce(rsvp_closes_at, starts_at)`. **The page and the
  action both call it, and the action's call is the one that counts** — a page
  rendered at 23:59 submits at 00:01.
- `resolveRsvp(db, eventId, input, now)` → the write path's core: window check,
  best-effort member lookup, insert, duplicate handling. Returns a discriminated
  result. **Never creates a member** (see §4).
- `classifyRsvp(rsvp, attendanceRows, event, now)` → `"attended" | "no_show" |
  "awaiting" | "cancelled"`. A no-show is **only** derivable after `ends_at`;
  before then an RSVP with no attendance row is `awaiting`, never a no-show.
  This is the same three-state discipline as the member events grid, where an
  event that has not ended is not a miss.
- `planCheckoff(selected, existingAttendance)` → the bulk plan: who will be
  written, who is skipped and why (already present, cancelled, unlinked). The
  pre-flight dedupes *within* the selection, like `planBulkAssign`.
- `RSVP_RATE_LIMIT_MAX`, `MAX_CHECKOFF` — both documented at their definitions,
  both refuse rather than truncate.

---

## 4. The public page and the one new unauthenticated endpoint

### Route

`app/(public)/rsvp/[id]/page.tsx`. The `[id]` is the **event's uuid**, and it is
**not a secret** — it is on a link the officer posts in a group chat. Say so in
the code rather than letting a future reader infer that the uuid is doing
security work, as the officer-invite token genuinely does. Nothing behind this
route is protected by knowing the id: the page shows the event's own public
details and a form, and no other person's data appears on it under any
condition.

The page **404s** unless the event is `published` **and**
`attendance_mode = 'rsvp'`, and renders a closed state (with the officer contact
address, no form) once `rsvpWindow` says closed. It reads published events
through the anon client on `lib/supabase/server.ts`, keeping the
`events_public_read` grant exercised in production the way `/leaderboard` does.

### The action

`app/actions/rsvp.ts`, exporting **`submitRsvp` and nothing else**. This makes it
the **fourth** file an anonymous user can POST to, after
`app/actions/attendance.ts` (write), `app/actions/lookup.ts` (read) and
`app/actions/officer-invite.ts` (write, and the consequential one). §6's sentence
about that being a two-file, two-symbol answer has already been amended once;
amend it again rather than letting it quietly become false. The single-export
rule is the whole reason the answer stays enumerable.

Order of operations, mirroring `submitCheckin` exactly:

1. **Honeypot first**, so it covers every path.
2. Echo caps on the raw values before validation — a hand-rolled POST must not
   get a megabyte reflected back into the response.
3. `rsvpSchema` (zod) in `lib/validation.ts`, reusing check-in's field rules
   including the normalization floor that stops `-` collapsing every submission
   into one phantom identity.
4. **Its own throttle bucket: `hashClientIp("rsvp")`.** Disjoint from
   `"checkin"` and `"lookup"` by the standing rule — `RATE_LIMIT_MAX` is a room
   capacity, and an RSVP link circulating in a group chat must not be able to
   exhaust the slots a room full of people need to check in with.
   `RSVP_RATE_LIMIT_MAX` is smaller than check-in's 90: nobody RSVPs ninety
   times, and there is no venue NAT concentrating a crowd behind one address at
   RSVP time.
5. Re-derive the event and the window **server-side**. Never trust the page.
6. `resolveRsvp`.

### 🔓 The RSVP form is a weaker oracle than `/attend`, and it must stay that way

`/attend` tells an unrecognised submitter "we don't have that info on file" — an
accepted, bounded roster-membership oracle (§6). **The RSVP form must not have
one at all**, and it does not need one, because unlike check-in it has no
decision that depends on the answer:

- **It accepts everyone.** A prospective member RSVPing to a banquet is a
  first-class case, not an error. There is no `unmatched` branch.
- **Member resolution is silent and best-effort** — `normalized_eid`, then
  `lower(email)`, the §4.2 order, exactly as check-in does it, but the result
  goes into a nullable column instead of into a message.
- 🔓 **It never creates a member.** The one unauthenticated member-creating path
  in this system is `createMember` behind check-in's confirmation pass, and it
  stays the one. An RSVP is a claim about the future; a roster row created from
  one is a person who may never appear. This follows the dues rule verbatim: a
  payment note never creates a member, and an RSVP is weaker evidence than
  money.
- 🔓 **A duplicate RSVP returns the SAME state and the SAME words as a fresh
  one.** One message for both, deliberately — the `/lookup` doctrine. "You're on
  the list" is true either way, and splitting it into "you're *already* on the
  list" hands back a per-event attendance-intent oracle to anyone with the link
  and an EID. Implement it as: catch `23505` on the unique index and return
  success. Do not read-then-branch.
- **It never displays who else has RSVP'd.** No count, no names, no "12 people
  are coming". The list is officer-only, and a count is a roster-size signal
  that costs nothing to withhold.

Net: the response is identical for every well-formed submission. The residual
exposure is spam — invented EIDs on a list — bounded by the honeypot, the
throttle, the published-and-open window, and one row per EID. That is cleanup,
not data loss, and it is strictly less than what check-in already accepts, since
no `members` row can result.

### The copy, and what this plan must not write

🔴 **The disclaimer, the penalty sentence and the 24-hour notice are facts about
the club, and the officer authors them.** The standing rule is that no page may
invent a fact about MISA; a sentence asserting that a penalty exists is exactly
such a fact, and a stronger one than most. This plan therefore specifies the
*slots*, not the words:

- a penalty disclaimer shown **above the submit button**, not in a footer;
- a cancellation instruction naming `CONTACT_EMAIL` from `lib/site.ts` and the
  24-hour figure;
- both stored in `lib/site.ts` alongside the rest of the org copy, never
  hardcoded into the page.

📌 **There is no confirmation email.** This project has no SMTP — that is why
officer invites are copied by hand — so the on-screen confirmation is the whole
receipt a member gets. The officer should know that before promising anyone
otherwise, and the confirmation state should be written to be worth
screenshotting.

### Design

`/rsvp/[id]` is a new public page landing mid-redesign. `/attend`,
`/leaderboard` and `/lookup` are v2 phase 3's scope; this form is their sibling
and should be built on the same primitives at the same time rather than
inheriting v1 composition and being rebuilt twice.

---

## 5. Cancelling — and why the 24 hours is copy, not logic

**No self-serve cancellation in v1.** The officer asked for "contact MISA at
least 24 hours ahead", and that is also the cheaper design by a wide margin: a
self-serve cancel needs a per-RSVP capability token, which means a fifth
unauthenticated endpoint, a stored digest, an expiry, and a whole invite-shaped
containment argument — for a link people will lose. A member emails; an officer
cancels the RSVP on the roster screen with a reason; `cancelled_at` records when,
and the partial unique index frees the slot so they can RSVP again later.

⚠️ **Nothing in the system evaluates the 24 hours.** `cancelled_at` and
`starts_at` are both on screen and the arithmetic is one glance, but no code
compares them, no flag is raised, and nothing is withheld. That is deliberate:
the deadline is a policy an officer applies with judgement (a member in hospital
at hour 12 is not the case the rule is for), and a system that computed
"LATE CANCELLATION" in red would be quoted at people as though it had decided
something. Keep the human in the loop and make their job fast instead — the same
rule that forbids auto-resolving near-misses.

---

## 6. The officer surface

### `/admin/events/[id]/rsvps` — the list

Its own route rather than a panel on the event detail page: it carries
selection, a bulk mutation and a member picker, and the detail page is already
the event form plus its attendance. The event page shows a count and a link, and
the shareable URL with a copy button — that is the "enable the link" the request
asks for, and it appears only when `attendance_mode = 'rsvp'`.

One table, one row per RSVP, showing the submitted name / EID / email **as
submitted**, the RSVP time, and a state pill from `classifyRsvp`:

| State | Meaning |
|---|---|
| **Awaiting** | RSVP'd, event has not ended, no attendance row |
| **Attended** | a non-rejected `attendance` row exists for this member and event |
| **No-show** | event has ended, RSVP live, no attendance row |
| **Cancelled** | `cancelled_at` set — shown with when, and struck through |
| **Unlinked** | `member_id is null` — needs a member before it can be checked off |

**Unlinked is a fourth axis, not a fifth state**, and must render as its own
thing rather than being folded into no-show. The distinction is the one the
whole system keeps making: *we could not tell* is never *definitely not*.

### The check-off

Checkboxes plus one **"Mark selected as attended"** action, and it obeys every
bulk rule already in force:

- **Explicitly checked ids only.** No "everyone on the list" mode — there is no
  filter behind this screen for a filter-mode selection to re-run.
- **Partial success, reported.** Requested minus written, with a per-row reason:
  already recorded, cancelled, unlinked. The pre-flight dedupes within the
  selection and pre-reads the event's existing attendance so a person already
  present is *skipped*, not allowed to fail the whole statement on
  `attendance_one_per_event`.
- **`MAX_CHECKOFF` refuses, never truncates**, when a selection is oversized.
- **One `attendance.created` audit row per row written**, via `writeAuditBatch`.

Each write is an ordinary attendance insert — `event_id`, `member_id`, the three
`submitted_*` values copied from the RSVP row, `status = 'present'`,
`source = 'rsvp'`. It satisfies `present_requires_resolution` by construction,
and every existing screen, view, export and archive understands it with no
change.

⚠️ **Unchecking is not a delete.** Once written, removing credit goes through the
existing reject path on the attendance row, with its reason and its audit trail.
An attendance row is never silently removed because a box was unticked — and
because the RSVP's "attended" state is *derived*, rejecting the attendance row
makes the list read correctly again on its own.

### Linking an unmatched RSVP

Inline member picker (`fetchMemberOptions`, the bounded roster scan), setting
`member_id` and writing `rsvp.linked`. The RSVP row is compare-and-set on
`updated_at`, carried as **the raw PostgREST string** — the microsecond-
truncation trap applies to this table exactly as it does to the other four.

🔴 **There is a gap here, and it is the one open question that blocks a clean
answer: this system has no officer-facing "create a member" screen.**
`/admin/members` has import (bulk, create-only) and merge, and §5's route table
has no `/admin/members/new` — verified, not assumed. So an RSVP from a genuine
newcomer can be *linked* to someone who already exists and otherwise cannot be
resolved except by a one-row CSV import, which is absurd. Two ways out, and the
officer picks in §9:

1. **Build `/admin/members/new` first** — a small, audited, officer-side create
   (`source = 'admin'`), useful far beyond this feature and arguably a gap the
   roster has had since Stage 6.
2. **Scope v1 to existing members**, and tell officers to import newcomers.
   Cheaper now, and it will be the first complaint.

Recommendation: **(1)**, as a prerequisite phase. It is genuinely small, and the
alternative puts a dead end at the end of the happiest path this feature has — a
banquet full of prospective members.

### The manual add — "someone who did not RSVP"

A second control on the same screen: pick a member, write attendance directly
with `source = 'admin_manual'`. It writes **no** `event_rsvps` row — they did not
RSVP, and manufacturing one to make the table tidy would put a fabricated claim
in the record that a later no-show report would read back as real.

This is `createManualAttendance` with the event pinned. **Reuse the action; do
not fork it.** The existing `/admin/attendance/new` stays exactly as it is — it
is still the recovery path for a check-in event.

---

## 7. The penalty — recorded by a human, never applied by the system

The mechanism already exists and needs no new machinery: a **negative
`point_adjustment` with a required reason**, granted from `/admin/points/new`,
voidable, audited, visible in the ledger. Negative adjustments were allowed from
the start precisely so bonuses, penalties and corrections would be one mechanism
rather than three.

So the whole of the build is a convenience: the no-show list on the RSVP screen
links to `/admin/points/new` with those members preselected. **No automatic
grant, no scheduled job, and no "apply penalties" button that writes N
adjustments from a rule.** Every existing control — the required reason, the
ledger, the void path — depends on a person having decided.

### ⚠️ The governance consequence, which is the real cost of this feature

Four resolved decisions (§9 #6 override authority, #9 grant caps, #10
self-grants, #12 what membership gates) share one premise, stated in the doc:
**standings are currently social rather than consequential**, and every one of
those arguments is defensible only while that holds. #5 (excused absences) was
deferred on the same basis.

A published sentence saying *not showing up may carry a penalty* is the first
thing in this system that makes points **cost** something. It does not
automatically break those decisions — but it is exactly the trigger they name for
re-reading them together, and an excused-absence concept becomes much harder to
keep deferred the moment a member with a genuine reason loses points.

📌 **Raise this with the officer before building, not after.** The cheap version
that keeps the premise intact: the disclaimer says a no-show **may affect future
RSVP access or officer discretion**, and points are left out of it entirely. That
is a real deterrent, needs no schema, and does not convert the leaderboard into
something with stakes. If the officer wants points on the line, that is their
call to make explicitly — record it in §9 as decision #14, the way #12 and #13
earned their place.

---

## 8. What deliberately does not change

- **`leaderboard` and `member_directory`.** RSVP attendance arrives as ordinary
  `present` rows and flows through both untouched.
- **`/attend`, `/lookup`, `/leaderboard`.** No copy change, no new state, no new
  message. A member's `/lookup` history shows a banquet exactly as it shows a
  workshop.
- **The check-in duplicate rule, the orphan window, the 48-hour refusal.** All
  untouched — they now simply never see an RSVP event.
- **`events_possible`** — the attendance-rate denominator counts every published,
  ended, current-term event, RSVP ones included. **That is a decision, not an
  oversight** (§9 below): a capacity-limited banquet in everyone's denominator
  understates every rate. If it must change, it is one predicate in the
  `possible` CTE, and `create or replace view` handles it because the column
  list does not move.
- **The member events grid** on `/admin/members/[id]` shows RSVP events like any
  other, with the same attended / missed / upcoming semantics.

---

## 9. Open decisions the officer owns

1. **Does the penalty involve points?** See §7. Recommend **no** for v1 — a
   disclaimer about officer discretion and future RSVP access, keeping §9
   #6/#9/#10/#12's shared premise intact. If yes, it is a §9 decision entry.
2. **Officer-side member creation** — build `/admin/members/new` as a
   prerequisite (recommended), or ship v1 able to link only to existing members.
   See §6.
3. **Do RSVP events count toward attendance rate?** Recommend **yes**, unchanged
   — consistency beats a second flag, and the rate is already raw. Revisit if
   RSVP events turn out to be capacity-limited or invite-only, at which point
   they are not "possible" for everyone and the denominator lies.
4. **Should the RSVP list be exportable?** A CSV of names, EIDs and emails is the
   largest PII egress in the system and already has a full apparatus —
   `getOfficer()` in a Route Handler, the audit receipt, the formula guard, the
   xlsx path. A caterer's headcount is the obvious real need. Recommend
   deferring: officers can read the screen for v1, and an export is a clean later
   addition that reuses `lib/export.ts` wholesale.
5. **The default `rsvp_closes_at`** the create form offers — event start, or
   24/48 hours before it. A form default, not a constraint.

---

## 10. Build order

Each phase ends with something demonstrable, per the standing rule.

- **Phase 0 (conditional)** — `/admin/members/new`, if decision 2 goes that way.
- **Phase 1 — migration 26 and `lib/rsvp.ts`.** Both columns, the table, all
  three SQL changes, the two CHECK widenings, regenerated
  `lib/types/database.ts`, and the pure core with its tests. **Demonstrable with
  no UI at all:** `/attend` refuses during a published RSVP event.
- **Phase 2 — the public page and `submitRsvp`.** The link works end to end and
  rows land in the table.
- **Phase 3 — the officer roster and check-off.** Linking, cancelling, the manual
  add, and the copy-link control on the event page.
- **Phase 4 — the no-show view and the penalty link.** Read-only plus one
  prefilled link; no new mutation.
- **Phase 5 — docs.** Below.

---

## 11. Docs that must change in the same commit as the code

- **`docs/student-org-website-architecture.md`** — §4.1 (two columns, one table,
  the third `source`), §4.2 (a design note: an RSVP is intent, not attendance,
  and never creates a member), §4.3 (all three window changes, and that the mode
  filter is now a *fourth* place the half-open rule must agree), §4.6 (deleting
  an event with RSVPs), §5 (both new routes — the table is checked code → table
  by `tests/docs.test.ts`, so writing them down early is legal and writing them
  down late is a red test), §6 (the fourth unauthenticated endpoint, the
  no-oracle argument, the new throttle bucket), §9 (#14 if the penalty involves
  points), §10 (the new modules), and a version header bump.
- **`CLAUDE.md`** — the invariants worth promoting: the three-places-plus-one
  mode filter, no member creation from an RSVP, one message for a duplicate,
  liveness is `cancelled_at`, attended is derived, the penalty is never
  automatic. Plus the layout block.
- **`docs/invariants.md`** — the evidence behind each of those.
- **`tasks.md`** — the stage entry and its phases.
- **`docs/build-log.md`** — what the walkthrough found, written after.

---

## 12. Verification

**Unit (`lib/rsvp.ts`)** — window open/closed either side of `rsvp_closes_at` and
of the `starts_at` fallback; `classifyRsvp` returning `awaiting` before `ends_at`
and `no_show` after; a cancelled RSVP never classifying as a no-show;
`planCheckoff` skipping already-present, cancelled and unlinked rows and deduping
within the selection.

**Integration (local stack)** — the ones that would catch a real regression:

1. 🔓 **A published RSVP event does not open `/attend`.** `open_event_at()`
   returns nothing during its window, and `submitCheckin` refuses.
2. 🔓 **…and does not queue either.** `nearby_events()` omits it, so a submission
   during that window with no other event nearby is **refused**, not stored as
   `pending`.
3. **A check-in event may be published overlapping an RSVP event**, and flipping
   the RSVP event to `'checkin'` then raises `23P01` and is surfaced as a field
   error rather than a generic failure.
4. 🔓 **A duplicate RSVP returns byte-identical state to a fresh one.** Written as
   an assertion on the serialized result, not on a status string — this is the
   oracle test, and it must fail if someone "makes it more helpful".
5. 🔓 **No `members` row is created by any RSVP path**, including an RSVP whose
   EID and email both miss. Assert the roster count is unchanged.
6. **Check-off writes `present` rows with `source = 'rsvp'`**, is idempotent on a
   second run (reported as skipped, not failed), and refuses an unlinked row.
7. **Cancelling frees the unique index** and the same person can RSVP again.
8. **Deleting an event with RSVPs is refused** with the message, and the
   `restrict` FK holds if the application check is bypassed.
9. **`/rsvp/[id]` 404s** for a draft event, a cancelled event, and a `'checkin'`
   event.
10. **The RSVP response contains no identifier the caller did not supply** and no
    other member's data — the same assertion `/lookup` carries.

**Security** — `event_rsvps` joins the exhaustive sweep in
`tests/security.test.ts`: every verb × anon × authenticated, each write probe
re-read as service role. 🪤 Probe with a **complete** payload; `insert({})` trips
NOT NULL before permission is consulted and proves nothing. Assert `42501`
specifically.

**Normalization** — `tests/normalization.test.ts` gains `event_rsvps` as a third
case, asserting the generated column equals `normalizeEid` for the same
pathological inputs. Three tables now carry that expression and they must not be
allowed to drift.

**Docs** — `tests/docs.test.ts` covers both new routes automatically once they
exist; add them to §5 in the same commit.

**Browser walkthrough** — publish an RSVP event; open the share link in a private
window and RSVP as a known member, an unknown person, and the same person twice;
confirm `/attend` refuses during the window; check two people off; reject one and
watch the list state go back; cancel one; add a member who never RSVP'd; confirm
the no-show list after `ends_at`.
