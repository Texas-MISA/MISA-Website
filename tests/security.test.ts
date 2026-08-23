import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { anonClient, signInAsOutsider, testClient } from "./helpers";

// What an unauthenticated visitor can reach, checked with the anon key rather
// than reasoned about (§6). Stage 8 owns this properly; this file existed early
// because one case was already wrong in production.
//
// 📌 Stage 8 grew it from SELECT-only into the full matrix §7's exit criterion
// asks for: every table × select/insert/update/delete × anon AND authenticated.
// The `authenticated` half is new and is not a formality — it is the role
// migration 22 had to revoke `member_directory` from, and the case this file
// admitted for two stages that it could not cover. See
// tests/authenticated-boundary.test.ts for the officer/non-officer distinction;
// this file is the exhaustive sweep.
//
// 🪤 The bug this was written for: `member_directory` was anon-readable on both
// databases, exposing every member's EID and email. It survived review
// because the obvious check passes — `members` itself denies correctly, RLS is
// enabled on every table, and there are no policies. The gap is that a **view
// has no RLS**. `member_directory` runs as owner (security_invoker off)
// precisely so it can aggregate past the deny-all tables beneath it, and
// 20260730000012_api_role_grants.sql grants `all privileges on all tables` —
// which includes views — to anon, on the stated reasoning that RLS would still
// be doing the denying. For a view, nothing was.
//
// So the load-bearing test here is not "member_directory is closed". It is the
// enumeration at the bottom: whatever views the migrations create, only the
// ones on the allowlist may be anon-readable. That is what makes the *next*
// view fail here instead of in production.

/**
 * The only relations anon may select from.
 *
 * Adding a name here is a privacy decision, not a maintenance chore: it means
 * an unauthenticated visitor may read every row the view returns, since a view
 * has no RLS to fall back on. Justify it in the migration.
 */
const ANON_READABLE = new Set([
  // Public standings (§4.4). Carries no eid and no email — that
  // omission is the entire reason it is allowed to be public.
  "leaderboard",
]);

/**
 * The exact columns anon may read from `leaderboard`.
 *
 * Pinned as a set, not a count: the assertion exists so that adding `eid` or
 * `email` to the one public view fails here instead of quietly making it the
 * next `member_directory`.
 *
 * 📌 `term` was appended by migration 21 (Stage 7 phase 1) so the public
 * board's heading and its rows come from one query. Widening this list is a
 * privacy decision every time — a term string names nobody, which is why that
 * one was allowed; do not treat a red assertion here as a test to update.
 */
const LEADERBOARD_COLUMNS = ["full_name", "id", "term", "total_points"];

/**
 * Every view the migrations create, read from source.
 *
 * Deliberately not a hardcoded list: a view added in a later migration is
 * picked up without anyone remembering this file exists. Names of views that
 * were later dropped are harmless — a missing relation errors for anon, which
 * is the same outcome the assertion wants.
 */
function declaredViews(): string[] {
  return declared(/create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)/gi);
}

/**
 * Every table the migrations create, read from source.
 *
 * Same reasoning as `declaredViews`, and the same payoff: the next table added
 * by a migration is swept by the matrix below without anyone remembering this
 * file exists. A table later dropped (`_stage0_check`, migration 10) is
 * harmless — a missing relation is refused, which is the outcome asserted.
 */
function declaredTables(): string[] {
  return declared(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi
  );
}

function declared(pattern: RegExp): string[] {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(new URL(file, dir), "utf8");
    for (const match of sql.matchAll(pattern)) names.add(match[1]);
  }
  return [...names].sort();
}

/**
 * The one table any API role may read, and the policy that allows it.
 *
 * `events_public_read` (migration 9) is the only RLS policy in the database,
 * and it is scoped to `status = 'published'`. Everything else is
 * RLS-enabled-with-no-policies, i.e. deny-all.
 */
const READABLE_TABLES = new Set(["events"]);

describe("anon access", () => {
  it("cannot read member_directory, which carries EIDs and emails", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("member_directory")
      .select("id")
      .limit(1);

    // Both halves asserted: the request is refused, and nothing came back.
    // The seed guarantees this view is non-empty, so "no rows" here cannot be
    // an accident of there being no data.
    expect(error).not.toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("still cannot read the members table directly", async () => {
    // The half that always passed. Asserted next to the view on purpose, so a
    // reader sees that this one being clean proves nothing about the other —
    // that inference is what let the bug through.
    const anon = anonClient();
    const { data } = await anon.from("members").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("can still read the leaderboard, which is public by design", async () => {
    const anon = anonClient();
    const { error } = await anon.from("leaderboard").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("gets no identifier columns from the leaderboard", async () => {
    // Why leaderboard is allowed to be the one public view. If eid or
    // email is ever added to it, this fails rather than quietly making it the
    // next member_directory.
    const anon = anonClient();
    const { data, error } = await anon.from("leaderboard").select("*").limit(5);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual(LEADERBOARD_COLUMNS);
    }
  });

  it("can select from no declared view except the allowlist", async () => {
    const anon = anonClient();
    const views = declaredViews();

    // Guards the guard: if the regex stops matching, this silently checks
    // nothing at all.
    expect(views).toContain("leaderboard");
    expect(views).toContain("member_directory");

    const readable: string[] = [];
    for (const view of views) {
      // Cast: the relation name comes from the migration files at runtime, so
      // it cannot be one of the generated literal types. That is the point —
      // a view added later must be probed without this file knowing its name.
      const { error } = await anon
        .from(view as "leaderboard")
        .select("*")
        .limit(1);
      if (error === null) readable.push(view);
    }

    expect(readable.sort()).toEqual([...ANON_READABLE].sort());
  });
});

describe("the service-role client is unaffected", () => {
  // The revoke's blast radius. Every admin screen reads through this client, so
  // if migration 22 had over-reached, this is where it shows.
  //
  // 📌 Stage 8 replaced the note that used to sit here ("`authenticated` is not
  // exercisable from here without minting a session, so service_role stands in")
  // — it IS exercisable now, and the matrix below does it properly.
  it("reads member_directory, which no API role may touch", async () => {
    const db = testClient();
    const { data, error } = await db
      .from("member_directory")
      .select("id")
      .limit(1);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(1);
  });

  it("can still write every table the app writes", async () => {
    // A narrow smoke test rather than a full CRUD sweep: the rest of the suite
    // (887 assertions across 30 files) exercises service-role writes constantly,
    // so this exists to fail FAST and legibly if a grant change lands wrong,
    // rather than as 400 confusing failures elsewhere.
    const db = testClient();
    const { error } = await db
      .from("checkin_throttle")
      .insert({ ip_hash: `security-test-${crypto.randomUUID()}` });
    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The matrix. §7's exit criterion, exhaustively.
// ---------------------------------------------------------------------------

/**
 * A refusal, asserted on the OUTCOME rather than on the error code.
 *
 * ⚠️ Reading the error alone is not enough and the distinction has teeth. RLS
 * denial and a missing GRANT fail differently (an empty result vs 42501), a
 * PostgREST write can "fail" while having changed a row, and — the case that
 * would make this whole file pass for the wrong reason — an INSERT with a
 * deliberately thin payload fails on a NOT NULL constraint whether or not the
 * role had permission. So every probe re-reads as service role and asserts the
 * row count did not move. That is the /attend lesson: a status-only assertion
 * passes while the database changes underneath it.
 */
async function countOf(table: string): Promise<number> {
  const db = testClient();
  const { count, error } = await db
    .from(table as "members")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`count(${table}) failed: ${error.message}`);
  return count ?? -1;
}

let liveTablesCache: string[] | null = null;

/**
 * The declared tables that still exist.
 *
 * 🪤 `declaredTables()` reads CREATE statements from source, so it also returns
 * `_stage0_check`, which migration 10 dropped. The view enumeration can shrug
 * that off — a missing relation is unreadable, which is the outcome it wants —
 * but the write probes below assert a *specific* refusal code, and a dropped
 * table answers `PGRST205` (not in the schema cache) rather than `42501`.
 * Found by breaking the suite on purpose; filtering here beats weakening the
 * assertion to accept both.
 */
async function liveTables(): Promise<string[]> {
  if (liveTablesCache) return liveTablesCache;
  const db = testClient();
  const live: string[] = [];
  for (const table of declaredTables()) {
    // ⚠️ A real row read, NOT countOf(). `head: true` returns an empty body,
    // and supabase-js leaves `error` null for a missing relation under it — so
    // countOf() answered -1 for the dropped table instead of throwing, and the
    // filter silently kept it. Costs one row per table, once.
    const { error } = await db
      .from(table as "members")
      .select("*")
      .limit(1);
    if (!error) live.push(table);
  }
  liveTablesCache = live;
  return live;
}

type Probe = { label: string; client: () => Promise<SupabaseLike> };
type SupabaseLike = ReturnType<typeof anonClient>;

const ROLES: Probe[] = [
  { label: "anon", client: async () => anonClient() },
  // A signed-in user with NO admin_profiles row — one confirmed email away for
  // anyone, since signup is enabled.
  { label: "authenticated", client: () => signInAsOutsider(testClient()) },
];

describe.each(ROLES)("$label cannot write to any table", ({ client }) => {
  it("enumerated the tables at all", async () => {
    // Guards the guard, same as the view enumeration above: if the regex stops
    // matching, every probe below silently sweeps an empty list.
    const tables = await liveTables();
    expect(tables).toContain("members");
    expect(tables).toContain("admin_audit");
    expect(tables).toContain("dues_payments");
    expect(tables.length).toBeGreaterThanOrEqual(12);
    expect(tables).toContain("checkin_origin");
    // The dropped table is filtered out, and that filtering is deliberate.
    expect(declaredTables()).toContain("_stage0_check");
    expect(tables).not.toContain("_stage0_check");
  });

  it("is refused INSERT everywhere, at the PERMISSION layer", async () => {
    // 🪤 This assertion is on the error CODE, and that is not pedantry — the
    // obvious version of this test is vacuous and was, until it was broken on
    // purpose. Probing with `insert({})` and asserting only "an error came
    // back" passes even when the role has full permission, because a thin
    // payload trips NOT NULL first. Measured against the local stack with a
    // grant and a permissive policy deliberately added to checkin_throttle:
    //
    //   no grant                     → 42501 "permission denied for table"
    //   grant, no policy (RLS denies)→ 42501 "new row violates row-level ..."
    //   grant + policy, {} payload   → 23502 not-null violation   ← FALSE PASS
    //   grant + policy, real payload → 201 Created                ← breach
    //
    // Both legitimate refusals are 42501. Anything else means the permission
    // and policy gates both let us through and only data validation stopped
    // us, which is a hole regardless of what the payload happened to be.
    const role = await client();
    for (const table of await liveTables()) {
      const before = await countOf(table);
      const { error } = await role
        .from(table as "members")
        .insert({} as never);
      expect(
        error?.code,
        `${table}: expected a 42501 permission/RLS refusal, got ${error?.code ?? "no error at all"} — ${error?.message ?? "the INSERT was accepted"}`
      ).toBe("42501");
      expect(await countOf(table), `${table} grew`).toBe(before);
    }
  });

  it("is refused UPDATE everywhere, and nothing changes", async () => {
    const role = await client();
    for (const table of await liveTables()) {
      const before = await countOf(table);
      // `neq` a uuid that cannot exist, so the filter matches every row: a
      // permitted UPDATE would touch the whole table, which is exactly the
      // blast radius worth proving impossible.
      const { error, data } = await role
        .from(table as "members")
        .update({} as never)
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .select();
      expect(
        error !== null || (data ?? []).length === 0,
        `${table} accepted an UPDATE`
      ).toBe(true);
      expect(await countOf(table)).toBe(before);
    }
  });

  it("is refused DELETE everywhere, and nothing is removed", async () => {
    const role = await client();
    for (const table of await liveTables()) {
      const before = await countOf(table);
      const { error, data } = await role
        .from(table as "members")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .select();
      expect(
        error !== null || (data ?? []).length === 0,
        `${table} accepted a DELETE`
      ).toBe(true);
      expect(await countOf(table), `${table} lost rows`).toBe(before);
    }
  });

  it("can read only `events`, and only published rows", async () => {
    const role = await client();
    const readable: string[] = [];
    for (const table of await liveTables()) {
      const { data, error } = await role
        .from(table as "members")
        .select("*")
        .limit(1);
      if (error === null && (data ?? []).length > 0) readable.push(table);
    }
    expect(readable.sort()).toEqual([...READABLE_TABLES].sort());
  });
});

describe.each(ROLES)("$label cannot touch checkin_origin", ({ client }) => {
  // 🪤 CALLED OUT SEPARATELY BECAUSE THE GENERIC SWEEP PASSES FOR THE WRONG
  // REASON HERE. Every probe above filters on `id`, and this table's primary
  // key is `attendance_id` — so the DELETE probe comes back 42703 ("column
  // checkin_origin.id does not exist"), which satisfies `error !== null` while
  // proving nothing about permissions. Same family as the empty-payload trap
  // this file already warns about: assert the refusal you mean.
  //
  // Verified by hand before this was written: with the correct column the
  // answer is 42501, not 42703.
  it("is refused a DELETE with 42501, not a column error", async () => {
    const role = await client();
    const { error } = await role
      .from("checkin_origin")
      .delete()
      .neq("attendance_id", "00000000-0000-0000-0000-000000000000");
    expect(error?.code).toBe("42501");
  });

  it("is refused an INSERT with 42501", async () => {
    const role = await client();
    const { error } = await role.from("checkin_origin").insert({
      attendance_id: "00000000-0000-0000-0000-000000000001",
      network_type: "campus",
    });
    expect(error?.code).toBe("42501");
  });

  // 🔓 The privacy assertion that matters most. An origin digest sitting beside
  // a member's identity is the thing this whole feature is built not to leak,
  // and anon HOLDS `select` on this table — migration 22's narrowed default
  // privileges grant it. RLS is the only thing keeping the rows invisible, so
  // an empty 200 here is the property under test, not an accident.
  //
  // 🪤 Writes its own fixture. seed.sql inserts no origin rows on purpose, so
  // probing the table as it ships would assert "you cannot see" against a table
  // where there is nothing to see — the assertion would pass forever and mean
  // nothing.
  it("reads no rows even though anon holds SELECT on the table", async () => {
    const db = testClient();
    const { data: host } = await db
      .from("attendance")
      .select("id")
      .limit(1)
      .single();
    expect(host, "seed has no attendance row to hang a fixture on").toBeTruthy();

    const { error: seedError } = await db.from("checkin_origin").insert({
      attendance_id: host!.id,
      origin_hash: "security-test-digest",
      network_type: "campus",
    });
    expect(seedError).toBeNull();

    try {
      const role = await client();
      const { data, error } = await role.from("checkin_origin").select("*");
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);

      // Guards the guard: the row really is there, as service role.
      const { data: visible } = await db
        .from("checkin_origin")
        .select("origin_hash")
        .eq("attendance_id", host!.id);
      expect((visible ?? []).length).toBe(1);
    } finally {
      await db.from("checkin_origin").delete().eq("attendance_id", host!.id);
    }
  });
});

describe.each(ROLES)("$label cannot tamper with admin_audit", ({ client }) => {
  // §7 bullet 2, called out separately because it is the log every other
  // control is audited into — and because TRUNCATE, which RLS cannot restrain
  // at all, is the one verb the append-only triggers never covered. Migration
  // 22 revoked it and added a statement-level trigger behind that.
  it("cannot update a row", async () => {
    const role = await client();
    const db = testClient();
    const { data: row } = await db
      .from("admin_audit")
      .select("id, action")
      .limit(1)
      .single();

    await role
      .from("admin_audit")
      .update({ action: "tampered" })
      .eq("id", row!.id);

    const { data: after } = await db
      .from("admin_audit")
      .select("action")
      .eq("id", row!.id)
      .single();
    expect(after!.action).toBe(row!.action);
  });

  it("cannot delete a row", async () => {
    const role = await client();
    const before = await countOf("admin_audit");
    await role.from("admin_audit").delete().gt("id", 0);
    expect(await countOf("admin_audit")).toBe(before);
  });
});

describe("append-only holds against the service role too", () => {
  // ⚠️ The role that bypasses RLS entirely, so the TRIGGER is the only control.
  // §6 used to hedge that the log is append-only "for the app and every client
  // role"; this is the assertion behind that sentence.
  it("refuses UPDATE with P0001", async () => {
    const db = testClient();
    const { data: row } = await db
      .from("admin_audit")
      .select("id")
      .limit(1)
      .single();
    const { error } = await db
      .from("admin_audit")
      .update({ action: "tampered" })
      .eq("id", row!.id);
    expect(error?.code).toBe("P0001");
  });

  it("refuses DELETE with P0001", async () => {
    const db = testClient();
    const { error } = await db.from("admin_audit").delete().gt("id", 0);
    expect(error?.code).toBe("P0001");
  });
});

// ---------------------------------------------------------------------------
// §7 bullet 3: an officer cannot act for themselves invisibly.
// ---------------------------------------------------------------------------

describe("officer actions are attributable", () => {
  // ⚠️ Read the bullet precisely. §9 #10 resolved that self-grants are
  // ALLOWED — blocking one just relocates it to "could you grant me these",
  // which is harder to audit. So the property to verify is not that they are
  // refused; it is that they are *visible*, with the granting officer named.
  //
  // The "use server" exports cannot be called from here (they need a request
  // context for cookies), so this follows the house pattern from
  // tests/point-actions.test.ts: assert the database behaviour the action
  // depends on, plus a source assertion for the decision itself.

  it("has no self-grant exemption in grantPoints, and says so", () => {
    const source = readFileSync(
      new URL("../app/actions/points.ts", import.meta.url),
      "utf8"
    );

    // The decision is recorded in prose at the top of the file, so a bare
    // /self.grant/ match finds the COMMENT saying there is no such check —
    // which is how the first version of this assertion failed while the code
    // was exactly right. Strip comments, then look for the code.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    // A self-grant check would have to compare the acting officer against a
    // member, and there is deliberately no officer↔member linkage anywhere in
    // the schema to compare against.
    expect(code).not.toMatch(/self[-_ ]?grant/i);
    expect(code).not.toMatch(/officer\.userId\s*[!=]==?\s*\w*[Mm]ember/);

    // And the absence stays deliberate rather than becoming an oversight.
    expect(source).toMatch(/no self-grant check/i);
  });

  it("cannot store an adjustment without naming who awarded it", () => {
    // awarded_by is NOT NULL and FKs auth.users with no ON DELETE, so an
    // adjustment can never be anonymous and the officer who made it can never
    // be deleted out from under it.
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20260730000005_point_adjustments.sql",
        import.meta.url
      ),
      "utf8"
    );
    expect(sql).toMatch(/awarded_by\s+uuid\s+not null/i);
  });

  it("records the acting officer on every audit row, append-only", async () => {
    const db = testClient();
    const { data } = await db
      .from("admin_audit")
      .select("actor_id, action")
      .limit(20);
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const row of data ?? []) expect(row.actor_id).not.toBeNull();
  });
});
