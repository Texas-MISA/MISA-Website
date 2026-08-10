-- Stage 8 phase 2. One new admin_audit entity type: 'archive'.
--
-- The attendance and adjustment archival exports need a receipt, and neither
-- can file under an existing type. 'attendance' and 'point_adjustment' name a
-- SPECIFIC row — a receipt under one of them would read as an action taken
-- against that single submission or grant, which is exactly the mistake §6's
-- roster note warns about. 'roster' means the member list everywhere else in
-- the docs and redefining it would make every historical row ambiguous.
--
-- So: one type covering anything archival, with the entity in the payload
-- (`after.entity` is 'attendance' or 'adjustments'). One vocabulary entry for
-- both exports and for whatever archival target comes next, rather than a new
-- type each time.
--
-- Follows the 'roster' precedent exactly: entity_id is a fresh uuid nothing
-- references, because an export spans N rows rather than naming one, and
-- entity_id is `uuid not null` on purpose (making it nullable to accommodate
-- this would weaken the column for the eight types that DO name a real row).
--
-- ⚠️ This union has now drifted from the TypeScript side twice — 'roster' in
-- migration 14 and 'dues_payment' in migration 19, both caught after the fact.
-- admin_audit is append-only (P0001 on UPDATE and DELETE alike), so a row
-- written under a wrong entity_type can never be corrected. Widening this check
-- and widening AuditEntityType in app/actions/audit.ts is ONE edit; they are in
-- the same commit as this file, and tests/docs.test.ts is no help here because
-- it checks that names are documented, not that two lists agree.

alter table public.admin_audit
  drop constraint admin_audit_entity_type_check;

alter table public.admin_audit
  add constraint admin_audit_entity_type_check check (
    entity_type in (
      'attendance','event','member','point_adjustment','roster','member_field',
      'dues_payment','member_preset','archive'
    )
  );
