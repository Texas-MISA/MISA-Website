import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Client Components.
 *
 * Holds only the anon key. Per the architecture doc (§3), the browser never
 * writes — all mutations go through Server Actions or Route Handlers. This
 * client exists for the few places the browser reads public data directly
 * (published events, the leaderboard view) or, from Stage 4, carries an
 * officer's auth session.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
