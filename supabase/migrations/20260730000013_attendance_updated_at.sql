-- Stage 5 groundwork (§7 Stage 5): make attendance rows safely editable by
-- more than one officer, and make the "a void always carries a reason" claim
-- in §4.2 true in the database rather than only in application code.

-- Officers resolve submissions from two screens at once — the queue and a
-- detail page open in another tab — so the review actions need the same
-- compare-and-set anchor the event editor uses (§4.6). Without it, two
-- officers assigning *different* events to the same still-pending row both
-- succeed and the later write wins silently.
--
-- Existing rows get the migration timestamp. That is not a claim that they
-- were edited now: this column is a concurrency anchor, not a fact about the
-- submission. submitted_at and resolved_at remain the facts.
alter table public.attendance
  add column updated_at timestamptz not null default now();

-- Reuses the trigger function defined with the events table; there is one
-- set_updated_at() for the whole schema.
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- point_adjustments already has void_is_complete, which pairs voided_at with
-- voided_by but says nothing about the reason. §4.2 argues the reason is the
-- point of voiding rather than deleting — "a void is itself a recorded action
-- with its own reason" — so an unexplained void is exactly the thing the
-- design set out to prevent. Enforce it here rather than trusting every future
-- caller to remember.
--
-- Written as an equality of null-ness so it also rejects a void_reason left
-- behind on a row that is not voided.
alter table public.point_adjustments
  add constraint void_requires_reason check (
    (voided_at is null) = (void_reason is null)
  );
