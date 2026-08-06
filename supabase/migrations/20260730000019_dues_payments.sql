-- Stage 6.5 phase 1 (§4.1, §4.5, §4.7, §7 Stage 6.5): dues, and with them the
-- split between official and unofficial members.
--
-- Until now this schema treated "Paid Dues → Yes/No" as the canonical
-- officer-defined custom field — a dropdown ticked by hand, forty times, from a
-- Venmo screen open in another tab. That was the wrong MECHANISM rather than a
-- stale example. Dues status is a fact about payments, so it is derived from
-- payments, and the hand-ticked version is forbidden outright by the
-- reserved-key widening in section 6 below.
--
-- Venmo has no API and no year-to-date export, so a monthly statement CSV is
-- genuinely the best available input rather than a shortcut. Two consequences
-- shape everything here:
--
--   * Officers upload statements on OVERLAPPING ranges on purpose, to keep the
--     roster fresher than monthly. A payment is therefore seen many times and
--     must be stored once — de-duplication is the normal path, not an edge
--     case, which is why venmo_txn_id carries a unique index that spans voided
--     rows.
--   * The payment→member link is member-supplied free text in the note. It will
--     sometimes be wrong, doubled, or absent, so member_id is nullable and such
--     a row is queued rather than discarded (§4.2).
--
-- What was rejected: a status enum alongside terms_covered (a second way to say
-- the same thing — the nullable column IS the review axis), and a content
-- fingerprint as the dedupe key (see the note on venmo_txn_id).

-- ---------------------------------------------------------------------------
-- 1. Term arithmetic
-- ---------------------------------------------------------------------------
--
-- 🪤 Terms do not sort lexicographically. 'Fall 2026' < 'Spring 2026' is true
-- as a string compare and false as a calendar fact, and that mistake produces
-- plausible output with no error anywhere. Every "which term is later" question
-- in this schema goes through the index below — never through `order by term`
-- or `max(term)`.
--
-- The index is the whole trick: two terms per year, Spring before Fall, so
--     Spring 2026 → 4052, Fall 2026 → 4053, Spring 2027 → 4054.
-- Stepping is addition, ordering is integer comparison, and both functions stay
-- IMMUTABLE with no recursion — which they must be, because covered_terms is a
-- generated column and Postgres will only accept an immutable expression there.
create or replace function public.term_index(t text)
returns integer
language sql
immutable
as $$
  select case
    when t is null then null
    else split_part(t, ' ', 2)::int * 2
       + case when split_part(t, ' ', 1) = 'Fall' then 1 else 0 end
  end
$$;

comment on function public.term_index(text) is
  'A term as a monotonically increasing integer, so terms can be ordered and '
  'stepped arithmetically. Spring sorts before Fall within a year. This is the '
  'only correct way to compare two terms — a string compare puts Fall first.';

create or replace function public.term_at_index(i integer)
returns text
language sql
immutable
as $$
  select case
    when i is null then null
    else case when i % 2 = 1 then 'Fall ' else 'Spring ' end || (i / 2)::text
  end
$$;

-- The term after this one. Fall 2026 → Spring 2027, Spring 2027 → Fall 2027.
create or replace function public.next_term(t text)
returns text
language sql
immutable
as $$
  select public.term_at_index(public.term_index(t) + 1)
$$;

-- The n terms a payment covers, starting at `start`.
--
-- NULL in, NULL out, and that is load-bearing rather than defensive: a payment
-- whose amount matched neither configured price parses, links to its member,
-- and waits with terms_covered null. Because covered_terms is generated from
-- this, such a row covers NOTHING and the member reads as Not Paid until an
-- officer decides. The failure direction is deliberately under-reporting
-- membership — which the review queue makes visible — rather than
-- over-reporting it, which nothing would surface.
create or replace function public.terms_from(start text, n int)
returns text[]
language sql
immutable
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

comment on function public.terms_from(text, int) is
  'terms_from(''Fall 2026'', 2) = {''Fall 2026'',''Spring 2027''}. '
  'terms_from(anything, null) is null, so a payment awaiting an officer''s '
  'decision covers no terms at all.';

-- ---------------------------------------------------------------------------
-- 2. Prices
-- ---------------------------------------------------------------------------
--
-- Cents, never a float. Configurable rather than constants in the application,
-- because raising dues is an officer decision and should not be a deploy.
--
-- ⚠️ Read at IMPORT time only. terms_covered is stored on each payment row, so
-- raising the price next year never rewrites what last year's payments bought.
alter table public.app_settings
  add column dues_one_term_cents integer not null default 3000
    check (dues_one_term_cents > 0),
  add column dues_two_term_cents integer not null default 5000
    check (dues_two_term_cents > 0);

-- ---------------------------------------------------------------------------
-- 3. The payments
-- ---------------------------------------------------------------------------
--
-- Shape is the union of the two patterns already in this schema: EDITABLE like
-- attendance (the parser can attribute a payment to the wrong member and
-- correcting that is legitimate, so there is a real updated_at CAS token) and
-- VOIDABLE like point_adjustments (money arriving is a fact, so a void is
-- one-way and carries a reason). point_adjustments is voidable but not
-- editable; attendance is editable but not voidable. This is deliberately both.
create table public.dues_payments (
  id             uuid primary key default gen_random_uuid(),

  -- 🔓 Venmo's own transaction id, and the entire de-duplication story.
  --
  -- A fingerprint over (datetime, amount, payer, note) is NOT an acceptable
  -- substitute, and the reason is worth keeping because the temptation will
  -- return if Venmo ever changes its export: two members can send $30 in the
  -- same minute with the note "dues", and a fingerprint collapses them into one
  -- row. The second member is then unpaid with no trace of their payment
  -- anywhere in the system — money received and no record of it.
  venmo_txn_id   text not null,

  -- Null means the note resolved to no member, or to more than one. Such a row
  -- is stored and queued, never discarded (§4.2 extended: nothing that arrived
  -- as money is dropped on the floor), and never creates a member.
  --
  -- RESTRICT, not CASCADE, diverging from point_adjustments on purpose: this
  -- row records that money arrived, and losing it because a member row went
  -- away is the wrong trade. It also makes the merge tool (Stage 6 phase 8)
  -- fail loudly if it forgets to repoint dues alongside attendance and points.
  member_id      uuid references public.members(id) on delete restrict,

  paid_at        timestamptz not null,

  -- Cents, never a float and never a numeric the application might round
  -- differently from Postgres. Positive only: a refund is a void with a reason,
  -- not a negative payment. The asymmetry with point_adjustments is deliberate
  -- — points are a score, this is a receipt.
  amount_cents   integer not null check (amount_cents > 0),

  note           text,

  -- From the statement, and the only way an officer can reconcile a payment
  -- whose note carried no usable EID. New PII; §6 carries a row for it.
  payer_name     text,
  payer_handle   text,

  -- The token parsed out of the note, stored raw beside its fold, exactly as
  -- attendance stores submitted_eid beside normalized_eid. The expression is
  -- character-for-character the one on members.normalized_eid, because the
  -- match is an equality against that column and two folds that drift would
  -- silently stop matching.
  submitted_eid  text,
  normalized_eid text generated always as
                 (lower(regexp_replace(coalesce(submitted_eid, ''),
                                       '\s|-', '', 'g'))) stored,

  -- Which term the payment starts covering. NOT generated, because an officer
  -- must be able to override it: §4.7 puts May–July in Spring, so a July
  -- payment intended for the coming year would otherwise buy a term with three
  -- weeks left in it.
  --
  -- ⚠️ **THE DEFAULT IS A FALLBACK, NOT THE ANSWER. The application must set
  -- this column explicitly.** The default asks term_of(NOW()) — the import time
  -- — and the right question is term_of(PAID_AT). A Postgres column default
  -- cannot reference another column, so this default is incapable of expressing
  -- what the column means, and the two answers differ for every statement
  -- uploaded after a term boundary, which is the ordinary case rather than an
  -- edge one. `termOf()` in lib/dues.ts is the mirror the import uses.
  --
  -- (Comment added 2026-08-06 after the phase-2 walkthrough found the preview
  -- saying a June payment counted as Spring while the stored row said Fall.
  -- Comment-only: SQL comments are not schema, so a db reset still produces a
  -- byte-identical database and this applied migration has not drifted.)
  start_term     text not null default public.term_of(now()),

  -- NULLABLE, and that nullability is the entire review mechanism. Null means
  -- "no officer has decided how many terms this bought" — an amount matching
  -- neither configured price (someone tipped, someone covered a friend, someone
  -- underpaid) parses fine, links to its member, and waits.
  terms_covered  smallint check (terms_covered is null
                                 or terms_covered between 1 and 4),

  -- Generated, so a row awaiting a decision covers nothing and counts for
  -- nothing. terms_from() is immutable precisely so it can appear here.
  covered_terms  text[] generated always as
                 (public.terms_from(start_term, terms_covered)) stored,

  -- Which uploaded statement this arrived in, so a bad import is reviewable and
  -- bulk-voidable in one action without a staging table.
  import_batch_id uuid not null,
  imported_by    uuid not null references auth.users(id),
  imported_at    timestamptz not null default now(),

  voided_at      timestamptz,
  voided_by      uuid references auth.users(id),
  void_reason    text,

  -- Written as equalities of null-ness so they also reject a voided_by or a
  -- void_reason left behind on a row that is not voided — the same form as
  -- point_adjustments' void_requires_reason.
  constraint dues_void_is_complete check (
    (voided_at is null) = (voided_by is null)
  ),
  constraint dues_void_requires_reason check (
    (voided_at is null) = (void_reason is null)
  ),

  -- Editable, unlike a point adjustment, so it needs a real CAS token.
  updated_at     timestamptz not null default now()
);

-- 🔓 The dedupe, and it SPANS VOIDED ROWS on purpose: re-importing a statement
-- whose payment an officer has already voided must stay a no-op rather than
-- resurrect it. A partial index excluding voided rows would silently undo an
-- officer's correction the next time the same month was uploaded.
create unique index dues_payments_txn_idx
  on public.dues_payments (venmo_txn_id);

create index dues_payments_member_idx
  on public.dues_payments (member_id);

-- Containment, for member_directory's dues_paid_current_term.
create index dues_payments_covered_idx
  on public.dues_payments using gin (covered_terms);

create index dues_payments_batch_idx
  on public.dues_payments (import_batch_id);

-- The needs-review queue: live rows that are unmatched, or matched but with
-- nobody having decided what they bought.
create index dues_payments_review_idx
  on public.dues_payments (imported_at desc)
  where voided_at is null and (member_id is null or terms_covered is null);

-- One set_updated_at() for the whole schema, defined with the events table.
create trigger dues_payments_set_updated_at
  before update on public.dues_payments
  for each row execute function public.set_updated_at();

-- Deny-all, like every other table. Reads reach officers through the
-- service-role client behind lib/auth.ts, never through the anon key.
alter table public.dues_payments enable row level security;

-- ---------------------------------------------------------------------------
-- 4. An audit shape for a payment
-- ---------------------------------------------------------------------------
--
-- ⚠️ admin_audit is append-only (P0001 on UPDATE and DELETE alike), so a row
-- written under a wrong entity_type can never be corrected. The widening lands
-- with the migration rather than when the first row is written.
alter table public.admin_audit
  drop constraint admin_audit_entity_type_check;

alter table public.admin_audit
  add constraint admin_audit_entity_type_check check (
    entity_type in (
      'attendance','event','member','point_adjustment','roster','member_field',
      'dues_payment'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. The directory column
-- ---------------------------------------------------------------------------
--
-- `create or replace`, NOT drop and create. The replace form can only append
-- columns, which is all this needs, and dropping would take the grants with it
-- — member_directory is granted to authenticated as a §6 security boundary, and
-- a recreate silently re-inherits anon access from the default privileges set
-- in migration 12. That hole was found live in production and fixed in
-- migration 15; a drop here would re-open it.
--
-- Appending is why dues_paid_current_term goes last rather than beside the
-- other aggregates.
create or replace view public.member_directory as
with cur as (
  select public.current_term() as term
),
possible as (
  select count(*) as events_possible
  from public.events e
  where e.status = 'published'
    and e.ends_at < now()
    and e.term = (select term from cur)
),
attendance_agg as (
  select a.member_id,
         count(*)                   as events_attended,
         coalesce(sum(e.points), 0) as attendance_points
  from public.attendance a
  join public.events e on e.id = a.event_id
  where a.status = 'present'
    and e.status <> 'cancelled'
    and e.term = (select term from cur)
  group by a.member_id
),
bonus_agg as (
  select member_id, coalesce(sum(points), 0) as bonus_points
  from public.point_adjustments
  where voided_at is null
    and term = (select term from cur)
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
  coalesce(aa.events_attended, 0)   as events_attended,
  coalesce(aa.attendance_points, 0) as attendance_points,
  coalesce(ba.bonus_points, 0)      as bonus_points,
  coalesce(aa.attendance_points, 0)
    + coalesce(ba.bonus_points, 0)  as total_points,
  (select count(*) from public.attendance a
    where a.member_id = m.id and a.status = 'pending')      as pending_count,
  (select max(a.submitted_at) from public.attendance a
    where a.member_id = m.id and a.status = 'present')      as last_seen_at,
  (select events_possible from possible)                    as events_possible,
  round(
    coalesce(aa.events_attended, 0)::numeric
      / nullif((select events_possible from possible), 0),
    4
  )                                                         as attendance_rate,
  m.notes,
  m.custom_fields,
  m.updated_at,
  -- Appended by migration 19. The whole of "is this an official member", and
  -- deliberately a single boolean: the directory answers the question officers
  -- filter on, and the member detail page answers what they are paid through.
  --
  -- Current-term scoped like every other aggregate here (§4.4). Derived from
  -- dues_payments and nothing else, which is what makes a hand-ticked
  -- "Paid Dues" custom field a contradiction rather than a duplicate — see the
  -- reserved-key widening below.
  exists (
    select 1 from public.dues_payments dp
    where dp.member_id = m.id
      and dp.voided_at is null
      and dp.covered_terms @> array[(select term from cur)]
  )                                                         as dues_paid_current_term
from public.members m
left join attendance_agg aa on aa.member_id = m.id
left join bonus_agg      ba on ba.member_id = m.id;

-- `create or replace` preserves grants, so these are restated rather than
-- required — because the one thing that must never silently come back is anon
-- access to a view carrying every member's email and EID (migration 15).
revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Reserving the dues keys
-- ---------------------------------------------------------------------------
--
-- ⚠️ Without this an officer recreates the hand-ticked dropdown beside the
-- calculated column, and the roster carries two answers to one question with
-- nothing to say which is right.
--
-- Reserving `dues` alone is not enough: `dues_paid` is the name somebody
-- reaches for first, and it is literally the key phase 4's own browser
-- walkthrough created. That fixture was deleted from the local database on
-- 2026-08-05 so this CHECK has nothing left to trip over.
--
-- 📌 The generalisable part: ARCHIVING A DEFINITION DOES NOT FREE ITS KEY.
-- member_field_definitions_key_idx spans archived rows on purpose, so an
-- archived `dues_paid` is still a row this constraint would find. Any future
-- migration that forbids a key has to reckon with archived definitions holding
-- it, not just live ones.
--
-- RESERVED_FIELD_KEYS in lib/members.ts gains the same three keys in the same
-- commit — the SQL check and the TypeScript set are two halves of one rule.
alter table public.member_field_definitions
  drop constraint member_field_definitions_key_not_builtin;

alter table public.member_field_definitions
  add constraint member_field_definitions_key_not_builtin
    check (key not in (
      'id','eid','email','name','full_name','active','source','joined_at',
      'notes','custom_fields','total_points','attendance_points','bonus_points',
      'events_attended','events_possible','attendance_rate','pending_count',
      'last_seen_at',
      -- Stage 6.5: dues left the custom-field mechanism entirely.
      'dues','dues_paid','dues_paid_current_term'
    ));
