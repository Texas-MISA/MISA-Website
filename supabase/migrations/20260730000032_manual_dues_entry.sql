-- Migration 32 — manual dues entry: a payment that did not come through a
-- Venmo statement, recorded by an officer (docs/dues-and-membership.md,
-- "manual dues entry"; requested 2026-08-15, method list decided by the officer
-- on 2026-10-05).
--
-- 📌 THIS RECORDS A PAYMENT, NOT A STATUS. A manual payment is an ordinary
-- dues_payments row, so member_directory.dues_paid_term keeps deriving
-- membership from covered_terms exactly as it does today, and the row inherits
-- the edit path, the void path, the audit trail and the term arithmetic without
-- any of them changing. There is no view change here: migrations 29–31 read
-- only member_id, voided_at and covered_terms from this table, and none of them
-- assumes a transaction id.
--
-- The schema was written when Venmo was the only source, and two of its
-- NOT NULLs say so:
--
--   1. venmo_txn_id. A cash payment has no transaction id. It becomes NULLABLE.
--      ⚠️ Never synthesise one (`manual:<uuid>`): every reader of the column
--      would then be wrong about what it means, and the import's dedupe is the
--      one thing in this schema that must stay obviously correct.
--   2. import_batch_id. A manual row arrived in no upload, so it becomes
--      NULLABLE too. Bulk-void-by-batch therefore stays an import-only tool,
--      which is right: there is no batch to undo.
--
-- and two things are added:
--
--   3. `source`: 'venmo_import' (the default) or the method the officer picked,
--      'cash', 'zelle' or 'other'. The default is what keeps every existing row
--      and every insert commitImport makes exactly as they were.
--      📌 There is deliberately NO manual 'venmo'. A Venmo payment typed in by
--      hand would be counted a second time when its statement is imported, and
--      the dedupe could not catch it: the hand-typed row has no transaction id
--      to collide on. A Venmo payment waits for its statement.
--   4. dues_source_matches_provenance: an imported row carries BOTH its
--      transaction id and its batch, and a manual row carries NEITHER.
--
-- Unchanged on purpose:
--
--   * amount_cents > 0. ⚠️ A comped or waived membership is OUT OF SCOPE. It
--     would be amount_cents = 0, and a receipt for money that never arrived is
--     a different thing from a payment; it gets decided separately rather than
--     by relaxing this check as a side effect.
--   * imported_by and imported_at keep their names and stay NOT NULL. On a
--     manual row they mean who recorded it and when (see the column comments
--     below). A rename would churn every reader for a wording improvement.
--
-- 🔓 THE UNIQUE INDEX IS LEFT EXACTLY AS IT IS — FULL, NOT PARTIAL. The written
-- plan said to make dues_payments_txn_idx partial (`where venmo_txn_id is not
-- null`), and that would have broken the import outright:
--
--   * A partial unique index can be the arbiter of ON CONFLICT only when the
--     statement repeats its predicate:
--     `on conflict (venmo_txn_id) where venmo_txn_id is not null`.
--   * commitImport writes through PostgREST, whose `on_conflict` parameter
--     names columns and cannot carry a predicate. Its upsert would fail with
--     42P10, "there is no unique or exclusion constraint matching the ON
--     CONFLICT specification" — on every import. (Measured against a temp
--     table on the local stack before this file was written.)
--   * The partial index buys nothing anyway. Postgres treats NULLs as DISTINCT
--     in a unique index by default, so any number of manual rows with a null
--     transaction id coexist under the full index as it stands.
--
-- So the import keeps working, the index still SPANS VOIDED ROWS (migration
-- 19's reason: re-importing a statement whose payment an officer voided must
-- stay a no-op), and the assertion block at the end refuses to finish if the
-- index has stopped being a full unique index on this column.
-- tests/dues-schema.test.ts pins the upsert with manual rows present.
--
-- A constant default, so adding `source` is a catalogue change: no row is
-- rewritten, the dues_payments_set_updated_at trigger does not fire, and no
-- officer's compare-and-set token moves underneath them.
--
-- ⚠️ DEPLOY ORDER: this migration BEFORE the code. The code selects `source`,
-- and a select naming a column the database lacks is a 42703 on every dues
-- screen. The reverse is harmless: code that predates this migration never
-- names `source`, its inserts take the default, and they carry both ids, so
-- the new CHECK accepts them.

-- ---------------------------------------------------------------------------
-- 1. The two NOT NULLs a manual row cannot satisfy.
-- ---------------------------------------------------------------------------
alter table public.dues_payments
  alter column venmo_txn_id drop not null;

alter table public.dues_payments
  alter column import_batch_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. Where the payment came from.
-- ---------------------------------------------------------------------------
--
-- lib/dues.ts PAYMENT_METHODS mirrors the three manual values. Change both
-- together, as with EVENT_CATEGORIES and MEMBER_TYPES.
alter table public.dues_payments
  add column source text not null default 'venmo_import'
    constraint dues_payments_source_valid
    check (source in ('venmo_import', 'cash', 'zelle', 'other'));

-- Written as two complete cases rather than as implications, so a manual row
-- carrying a transaction id is refused as firmly as an import missing one: a
-- manual row with an id would sit in the dedupe index and could make the next
-- import silently skip a real Venmo payment.
alter table public.dues_payments
  add constraint dues_source_matches_provenance check (
    (source = 'venmo_import'
       and venmo_txn_id is not null
       and import_batch_id is not null)
    or
    (source <> 'venmo_import'
       and venmo_txn_id is null
       and import_batch_id is null)
  );

comment on column public.dues_payments.source is
  'Where this payment came from. venmo_import: a row from a Venmo statement '
  'upload, carrying venmo_txn_id and import_batch_id. cash, zelle, other: '
  'recorded by hand by an officer, carrying neither '
  '(dues_source_matches_provenance). There is no manual venmo: a hand-typed '
  'Venmo payment would be counted again when its statement is imported.';

comment on column public.dues_payments.venmo_txn_id is
  'Venmo''s transaction id and the import''s dedupe key. dues_payments_txn_idx '
  'is a FULL unique index that spans voided rows; it must never become partial, '
  'because PostgREST''s on_conflict cannot name a predicate (migration 32). '
  'Null exactly when source is not venmo_import.';

comment on column public.dues_payments.import_batch_id is
  'The statement upload this row arrived in. Null exactly when source is not '
  'venmo_import: a manual payment arrived in no batch.';

comment on column public.dues_payments.imported_by is
  'The officer who brought this row in: who uploaded the statement for an '
  'import, who recorded the payment for cash, zelle or other.';

comment on column public.dues_payments.imported_at is
  'When this row was written: the upload time for an import, the recording '
  'time for a manual payment. When the money arrived is paid_at.';

-- ---------------------------------------------------------------------------
-- 3. Assert what the header claims.
-- ---------------------------------------------------------------------------
--
-- Read-only, in migration 26's style: an unasserted change is an optional
-- change. The index check is the one that matters — it is the thing this
-- migration promises NOT to change, and the change the plan proposed.
do $$
declare
  unique_index boolean;
  full_index boolean;
  indexed_column text;
  manual_rows int;
begin
  if to_regclass('public.dues_payments_txn_idx') is null then
    raise exception 'dues_payments_txn_idx is missing; the import dedupe needs it';
  end if;

  select i.indisunique,
         i.indpred is null,
         (select a.attname
            from pg_attribute a
           where a.attrelid = i.indrelid
             and a.attnum = i.indkey[0])
    into unique_index, full_index, indexed_column
    from pg_index i
   where i.indexrelid = 'public.dues_payments_txn_idx'::regclass;

  if not unique_index or not full_index or indexed_column <> 'venmo_txn_id' then
    raise exception
      'dues_payments_txn_idx must stay a FULL unique index on venmo_txn_id '
      '(unique %, full %, column %): a partial one breaks commitImport''s '
      'upsert with 42P10', unique_index, full_index, indexed_column;
  end if;

  -- Every row that exists today came from an import, so the default must have
  -- labelled all of them that way.
  select count(*) into manual_rows
    from public.dues_payments
   where source <> 'venmo_import';
  if manual_rows <> 0 then
    raise exception
      'every existing payment is an import, but % read otherwise', manual_rows;
  end if;
end
$$;
