import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Uses the anon key: every query made through this client is subject to RLS,
 * which assumes the anon role is hostile (architecture doc §3, §6). Officer
 * sessions ride along via auth cookies once Supabase Auth is wired up in
 * Stage 4.
 *
 * Call per request — never cache the returned client across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
            // cookies() is read-only during Server Component rendering.
            // Session refresh happens in proxy.ts instead (Stage 4), so
            // swallowing the write here is safe.
          }
        },
      },
    }
  );
}
