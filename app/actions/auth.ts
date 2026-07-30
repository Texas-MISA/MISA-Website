"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation";

// Officer sign-in and sign-out (§5, §6). These use the anon SSR client, not
// the service role: signInWithPassword needs to write session cookies, which
// works in a Server Action (unlike during Server Component rendering — see
// lib/supabase/server.ts).

export type SignInState =
  | { status: "idle" }
  | { status: "failed" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"email" | "password", string[]>>;
    };

export async function signIn(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "email");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "invalid", fieldErrors };
  }

  let destination: string;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    // One state for "no such user" and "wrong password" alike — distinguishing
    // them would turn this form into a membership oracle.
    if (error || !data.user) return { status: "failed" };

    // A valid Supabase user is not automatically an officer. Without this
    // check they land in a redirect loop: proxy.ts sees a session and sends
    // them to /admin, the shell layout finds no admin_profiles row and sends
    // them back to /admin/login, which proxy.ts bounces again.
    const db = createAdminClient();
    const { data: profile } = await db
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      return { status: "failed" };
    }

    destination = safeNext(formData.get("next"));
  } catch (e) {
    console.error("signIn failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }

  // Outside the try/catch on purpose: redirect() signals by throwing a
  // NEXT_REDIRECT exception, and a catch block would swallow it into a
  // generic error while the officer stays stranded on the login page.
  redirect(destination);
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    console.error("signOut failed:", e instanceof Error ? e.message : String(e));
    // Fall through to the redirect regardless: proxy.ts will bounce them back
    // to the login page anyway, and stranding someone who asked to sign out on
    // an error page is the worse failure.
  }

  redirect("/admin/login");
}

/**
 * Where to send an officer after signing in.
 *
 * The `next` parameter comes from the URL, so it is attacker-supplied: without
 * this check the login form is an open redirect that sends officers to an
 * arbitrary site after a genuine-looking sign-in. Only same-origin admin paths
 * are allowed — a leading `//` or a backslash can both be read as a host by
 * some clients, so neither survives.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "/admin";
  if (!raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("//") || raw.includes("\\")) return "/admin";
  return raw;
}
