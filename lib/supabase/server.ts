import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Uses the anon key: every query made through this client is subject to RLS,
 * which assumes the anon role is hostile (architecture doc §3, §6). Officer
 * sessions ride along via the auth cookies this client reads.
 *
 * Call per request — never cache the returned client across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // cookies() is read-only during Server Component rendering, but
            // writable in Server Actions and Route Handlers — so sign-in
            // persists its cookies fine and only render-time refreshes land
            // here. Those are covered by proxy.ts, which runs on every /admin
            // request and is where token refresh actually sticks. Swallowing
            // the write is only safe because proxy.ts exists; see its comment
            // for what breaks otherwise.
          }
        },
      },
    }
  );
}
