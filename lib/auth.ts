import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The officer authorization boundary (§5, §6) — the Data Access Layer Next's
// authentication guide asks for. proxy.ts does an optimistic session check;
// this is the real one, and it is the only place that decides whether someone
// is an officer.
//
// Unlike lib/checkin.ts and lib/events.ts, this file is deliberately coupled
// to the framework (it reads cookies and issues redirects), so it is covered
// by the actions' integration tests and manual verification rather than by
// unit tests.

export type OfficerRole = "officer" | "admin";

export type Officer = {
  userId: string;
  email: string;
  displayName: string | null;
  role: OfficerRole;
};

/**
 * The signed-in officer, or null.
 *
 * Wrapped in React `cache()` so the shell layout, the page, and any nested
 * Server Components share one auth round trip per render pass. The cache is
 * per-request; it does not leak between users or across a Server Action and
 * the render that follows it.
 */
export const getOfficer = cache(async (): Promise<Officer | null> => {
  const supabase = await createClient();

  // getUser(), never getSession(): the session cookie is attacker-controllable
  // and only getUser() validates the JWT against the Auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // admin_profiles is deny-all under RLS until Stage 8, so this lookup MUST
  // use the service-role client — an anon/authenticated select returns zero
  // rows and every officer would be locked out.
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_profiles")
    .select("user_id, display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("officer profile lookup failed:", error.message);
    return null;
  }
  // A valid Supabase user with no admin_profiles row is not an officer. This
  // is the §6 privilege-escalation control: signing up is not the same as
  // being granted access, and no client role can write this table.
  if (!data) return null;

  return {
    userId: data.user_id,
    email: user.email ?? "",
    displayName: data.display_name,
    role: data.role as OfficerRole,
  };
});

/**
 * The signed-in officer, redirecting to the login page when there isn't one.
 *
 * Call this from every admin page and layout — not just the layout. Layouts do
 * not re-run on client-side navigation between sibling routes, so a page that
 * relies on its layout's check alone stays reachable after the session dies.
 * `cache()` makes the extra call free within a render.
 *
 * Never call this from a Server Action: redirect() throws a NEXT_REDIRECT
 * control-flow exception, and the house action shape wraps its body in
 * try/catch, which would swallow it into a generic error. Actions call
 * getOfficer() and return an "unauthorized" state instead.
 */
export async function requireOfficer(): Promise<Officer> {
  const officer = await getOfficer();
  if (!officer) redirect("/admin/login");
  return officer;
}
