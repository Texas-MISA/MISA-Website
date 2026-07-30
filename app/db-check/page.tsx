import { createClient } from "@/lib/supabase/server";

// Throwaway page for the Stage 0 exit criteria: prove a Server Component can
// read a row from Postgres on the deployed URL. Delete this route, and the
// 00000000000000_stage0_check migration, once Stage 1 has real tables.

// Force a request-time read; without this the page is prerendered at build
// and would prove nothing about the deployed runtime.
export const dynamic = "force-dynamic";

type Result =
  | { kind: "ok"; id: number; note: string }
  | { kind: "error"; message: string; code?: string };

async function read(): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("_stage0_check")
      .select("id, note")
      .single();

    if (error) return { kind: "error", message: error.message, code: error.code };
    return { kind: "ok", id: data.id, note: data.note };
  } catch (e) {
    // Catches the throw from createServerClient when env vars are missing,
    // so a misconfigured deploy reports the cause instead of a bare 500.
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export default async function DbCheckPage() {
  const result = await read();

  // Env presence only — never render the key itself.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="mx-auto max-w-xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg font-bold">Stage 0 — database read check</h1>

      {result.kind === "ok" ? (
        <div className="rounded border border-green-600 bg-green-50 p-4 text-green-900">
          <p className="font-bold">OK</p>
          <p className="mt-2">
            row {result.id}: {result.note}
          </p>
        </div>
      ) : (
        <div className="rounded border border-red-500 bg-red-50 p-4 text-red-900">
          <p className="font-bold">FAILED</p>
          <p className="mt-2">{result.message}</p>
          {result.code && <p className="mt-1 opacity-70">code: {result.code}</p>}
        </div>
      )}

      <dl className="mt-6 space-y-1 opacity-70">
        <div>
          NEXT_PUBLIC_SUPABASE_URL: {url ? url : "MISSING"}
        </div>
        <div>
          NEXT_PUBLIC_SUPABASE_ANON_KEY:{" "}
          {key ? `present (${key.slice(0, 12)}…, ${key.length} chars)` : "MISSING"}
        </div>
        <div>read at {new Date().toISOString()}</div>
      </dl>
    </main>
  );
}
