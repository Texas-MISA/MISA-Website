import { createClient } from "@/lib/supabase/server";

// Throwaway page for the Stage 0 exit criteria: prove a Server Component can
// read a row from Postgres on the deployed URL. Delete this route, and drop
// the _stage0_check table, once Stage 1 has real tables to read from.

// Force a request-time read; without this the page is prerendered at build
// and would prove nothing about the deployed runtime.
export const dynamic = "force-dynamic";

export default async function DbCheckPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("_stage0_check")
    .select("id, note")
    .single();

  return (
    <main className="mx-auto max-w-xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg font-bold">Stage 0 — database read check</h1>

      {error ? (
        <div className="rounded border border-red-500 bg-red-50 p-4 text-red-900">
          <p className="font-bold">FAILED</p>
          <p className="mt-2">{error.message}</p>
          {error.code && <p className="mt-1 opacity-70">code: {error.code}</p>}
        </div>
      ) : (
        <div className="rounded border border-green-600 bg-green-50 p-4 text-green-900">
          <p className="font-bold">OK</p>
          <p className="mt-2">
            row {data.id}: {data.note}
          </p>
        </div>
      )}

      <p className="mt-6 opacity-60">
        Read at {new Date().toISOString()} via the anon key, subject to RLS.
      </p>
    </main>
  );
}
