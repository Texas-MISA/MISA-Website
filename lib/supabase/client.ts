import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Client Components. Holds only the anon key.
 *
 * 🔓 The browser writes exactly ONE thing: a house bingo video's bytes,
 * uploaded to Storage with a signed upload token that the officer-only Server
 * Action prepareBingoVideoUpload (app/actions/bingo.ts) mints for one path
 * (user's decision, 2026-10-10). A video is too big for a function body, which
 * is the whole reason for the exception. Every other mutation goes through a
 * Server Action or a Route Handler (§3), and nothing else may use this client
 * to write. Its one importer is the bingo proof form, and
 * tests/bingo-admin.test.ts keeps it that way.
 *
 * 🔓 SESSIONLESS, on purpose. @supabase/ssr's browser client otherwise reads
 * the officer's session out of the auth cookies (they are not HttpOnly), sends
 * the officer's token in place of the anon key, and starts refreshing it from
 * the browser. That refresh is a second client-side write, to Auth, racing the
 * refresh proxy.ts makes on every request. With persistence, refresh and URL
 * detection off, this client is the anon key and nothing more, and the signed
 * token alone authorises the upload.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
