import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

/**
 * Supabase client holding the service-role key. Bypasses RLS entirely.
 *
 * §3's write path: all writes go through Server Actions or Route Handlers
 * using the service role — never from the browser. The `server-only` import
 * makes any accidental client-side import a build error rather than a leaked
 * key.
 *
 * Only the check-in Server Action (app/actions/attendance.ts) and, later,
 * admin actions should import this. Reads that the anon role is allowed to
 * make belong on lib/supabase/server.ts instead, so RLS stays exercised.
 *
 * Call per request — never cache the returned client across requests.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // No cookies and no session: the service role is not a user.
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
