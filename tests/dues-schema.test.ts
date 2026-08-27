import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  cleanup,
  createTestMember,
  getTestOfficer,
  newTracker,
  testClient,
  testIdentity,
  type Tracker,
} from "./helpers";

// Integration tests for the dues SCHEMA (§7 Stage 6.5 phase 1) against the
// local stack. The parser, the matcher and the term arithmetic are covered
// purely in dues.test.ts; what can only be checked here is that the database
// enforces the guarantees the design leans on — the ones an application-level
// test would pass while the constraint quietly did nothing.
//
// The import action lands in phase 2, so these drive dues_payments directly.
// The "an unresolvable note creates no member" test belongs with that action
// and is deliberately not faked here.

const db = testClient();
const track: Tracker = newTracker();

let officerId = "";
let memberId = "";
const batchId = crypto.randomUUID();
const txnIds: string[] = [];

function txn(suffix: string): string {
  const id = `t3q-dues-${batchId.slice(0, 8)}-${suffix}`;
  txnIds.push(id);
  return id;
}

async function currentTerm(): Promise<string> {
  const { data, error } = await db.rpc("current_term");
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

beforeAll(async () => {
  officerId = await getTestOfficer(db);
  memberId = await createTestMember(db, track, testIdentity());
}, 60_000);

afterAll(async () => {
  // Payments reference the member with ON DELETE RESTRICT, so they have to go
  // first — which is itself the behaviour the FK exists to produce.
  if (txnIds.length > 0) {
    await db.from("dues_payments").delete().in("venmo_txn_id", txnIds);
  }
  await cleanup(db, track);
});

async function insertPayment(
  overrides: Record<string, unknown> = {}
): Promise<{ error: { message: string; code: string } | null }> {
  const { error } = await db.from("dues_payments").insert({
    venmo_txn_id: txn(String(Math.random()).slice(2, 10)),
    member_id: memberId,
    paid_at: new Date().toISOString(),
    amount_cents: 5000,
    import_batch_id: batchId,
    imported_by: officerId,
    ...overrides,
  });
  return { error: error ? { message: error.message, code: error.code } : null };
}

describe("the dedupe index", () => {
  it("🔓 refuses a transaction id that is already stored", async () => {
    const id = txn("dupe");
    const first = await insertPayment({ venmo_txn_id: id });
    expect(first.error).toBeNull();

    const second = await insertPayment({ venmo_txn_id: id });
    expect(second.error?.code).toBe("23505");
  });

  it("⚠️ still refuses it after the payment has been VOIDED", async () => {
    // The property the whole overlapping-statement design rests on. Officers
    // upload the same month twice on purpose, so re-importing a statement whose
    // payment an officer already corrected must stay a no-op rather than
    // resurrect it. A partial index excluding voided rows would silently undo
    // that correction on the next upload.
    const id = txn("voided");
    expect((await insertPayment({ venmo_txn_id: id })).error).toBeNull();

    const { error: voidError } = await db
      .from("dues_payments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officerId,
        void_reason: "test void",
      })
      .eq("venmo_txn_id", id);
    expect(voidError).toBeNull();

    const again = await insertPayment({ venmo_txn_id: id });
    expect(again.error?.code).toBe("23505");
  });
});

describe("covered_terms", () => {
  it("is generated from start_term and terms_covered", async () => {
    const id = txn("covered");
    expect(
      (await insertPayment({
        venmo_txn_id: id,
        start_term: "Fall 2026",
        terms_covered: 2,
      })).error
    ).toBeNull();

    const { data } = await db
      .from("dues_payments")
      .select("covered_terms")
      .eq("venmo_txn_id", id)
      .single();

    expect(data?.covered_terms).toEqual(["Fall 2026", "Spring 2027"]);
  });

  it("⚠️ covers NOTHING while terms_covered is null", async () => {
    // The review mechanism. An amount matching neither price links to its
    // member and waits, and until an officer decides it must not count as
    // membership — the failure direction is under-reporting, which the queue
    // makes visible.
    const id = txn("undecided");
    expect(
      (await insertPayment({
        venmo_txn_id: id,
        amount_cents: 4200,
        terms_covered: null,
      })).error
    ).toBeNull();

    const { data } = await db
      .from("dues_payments")
      .select("covered_terms")
      .eq("venmo_txn_id", id)
      .single();

    expect(data?.covered_terms).toBeNull();
  });
});

describe("member_directory.dues_paid_term", () => {
  // ⚠️ Its own member, not the file's shared one. An earlier block in this file
  // gives that member a payment covering the current term, so a `before` of
  // false would already be false only by luck of execution order — and the
  // whole point of this test is the transition.
  it("flips on when a covering payment exists, and back off when voided", async () => {
    const term = await currentTerm();
    const id = txn("directory");
    const subject = await createTestMember(db, track, testIdentity());

    const read = async () =>
      (
        await db
          .from("member_directory")
          .select("dues_paid_term")
          .eq("id", subject)
          .single()
      ).data?.dues_paid_term;

    expect(await read()).toBe(false);

    expect(
      (await insertPayment({
        venmo_txn_id: id,
        member_id: subject,
        start_term: term,
        terms_covered: 1,
      })).error
    ).toBeNull();

    expect(await read()).toBe(true);

    await db
      .from("dues_payments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officerId,
        void_reason: "test void",
      })
      .eq("venmo_txn_id", id);

    // Membership is a live derivation, not a stored flag, so voiding makes a
    // member unofficial retroactively. That is correct and will surprise
    // somebody — which is why the void requires a reason.
    expect(await read()).toBe(false);
  });
});

describe("the constraints", () => {
  it("refuses a non-positive amount", async () => {
    // A refund is a void with a reason, not a negative payment.
    expect((await insertPayment({ amount_cents: 0 })).error?.code).toBe("23514");
    expect((await insertPayment({ amount_cents: -100 })).error?.code).toBe(
      "23514"
    );
  });

  it("refuses a void with no reason, and a reason with no void", async () => {
    const id = txn("voidrules");
    await insertPayment({ venmo_txn_id: id });

    const noReason = await db
      .from("dues_payments")
      .update({ voided_at: new Date().toISOString(), voided_by: officerId })
      .eq("venmo_txn_id", id);
    expect(noReason.error?.code).toBe("23514");

    const noVoid = await db
      .from("dues_payments")
      .update({ void_reason: "orphaned" })
      .eq("venmo_txn_id", id);
    expect(noVoid.error?.code).toBe("23514");
  });

  it("folds submitted_eid the same way members.normalized_eid does", async () => {
    const id = txn("fold");
    await insertPayment({ venmo_txn_id: id, submitted_eid: "RP-85 71" });

    const { data } = await db
      .from("dues_payments")
      .select("normalized_eid")
      .eq("venmo_txn_id", id)
      .single();

    // The match is an equality against members.normalized_eid, so two folds
    // that drift would silently stop matching anybody.
    expect(data?.normalized_eid).toBe("rp8571");
  });
});

describe("the reserved dues keys", () => {
  it("⚠️ are refused by the DATABASE, not merely by the zod schema", async () => {
    // Without this an officer recreates the hand-ticked dropdown beside the
    // calculated column and the roster carries two answers to one question.
    for (const key of ["dues", "dues_paid", "dues_paid_term"]) {
      const { error } = await db.from("member_field_definitions").insert({
        key,
        label: "Paid dues",
        kind: "select",
        options: ["Yes", "No"],
      });
      expect(error?.code, key).toBe("23514");
    }
  });
});

describe("anon", () => {
  it("cannot read dues_payments", async () => {
    // 🪤 The expected answer is 200 with an EMPTY body, not 401 — RLS with no
    // policies filters every row rather than refusing the request. Reading the
    // status alone would pass just as happily against a table that leaked.
    const anon = anonClient();
    const { data, error } = await anon
      .from("dues_payments")
      .select("id, amount_cents, payer_name")
      .limit(5);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
