// Stands in for the `server-only` marker package under Vitest.
//
// That package deliberately throws when imported outside a React Server
// Component. The modules these tests need — lib/supabase/admin.ts and
// app/actions/audit.ts — import it precisely because they must never reach the
// browser bundle. Vitest is neither a browser nor a bundler, so the guard has
// nothing to protect here and only blocks the tests from loading.
//
// Aliased in vitest.config.ts. Nothing imports this directly.
export {};
