-- Stage 0 teardown. The landing page now reads published events live, so the
-- throwaway verification table (and app/db-check/, deleted alongside this)
-- has served its purpose. The 00000000000000_stage0_check migration stays in
-- history so a fresh `db reset` replays cleanly; this drop supersedes it.
-- Its RLS policy goes with the table.

drop table public._stage0_check;
