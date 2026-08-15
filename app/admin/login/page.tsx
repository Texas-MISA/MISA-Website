import type { Metadata } from "next";

import { Wordmark } from "@/components/ui/wordmark";

import { LoginForm } from "./_components/login-form";

// Officer sign-in (§5). This route sits OUTSIDE app/admin/(shell)/, whose
// layout calls requireOfficer() — putting the login page inside it would make
// signing in impossible.

export const metadata: Metadata = {
  title: "Officer Sign-In",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-misa-panel px-6 py-16">
      <div className="w-full max-w-sm border border-misa-border bg-background">
        {/* Wordmark draws in currentColor, so it comes out white on navy. */}
        <div className="flex justify-center bg-misa-blue py-6 text-white">
          <Wordmark />
        </div>
        <div className="px-6 py-8">
          <h1 className="text-center font-display text-3xl font-semibold tracking-[-0.02em]">
            Officer Sign-In
          </h1>
          <p className="mt-2 text-center text-sm text-foreground/70">
            For MISA officers only. Members check in at{" "}
            <a
              href="/attend"
              className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              /attend
            </a>
            .
          </p>
          <div className="mt-8">
            <LoginForm next={next} />
          </div>
        </div>
      </div>
    </main>
  );
}
