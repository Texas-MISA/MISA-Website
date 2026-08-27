import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  parseVenmoStatement,
  planPayment,
  termOf,
  type DuesPrices,
  type PlannedPayment,
  type RosterEntry,
} from "@/lib/dues";
import { fetchRosterIndex } from "@/lib/roster-index";

import {
  cleanup,
  createTestMember,
  getTestOfficer,
  newTracker,
  testClient,
  testIdentity,
  type Tracker,
} from "./helpers";

// Integration tests for the Stage 6.5 phase-2 import, against the LOCAL stack.
// The parser, the matcher and the decision table are covered purely in
// tests/dues.test.ts; the schema's own guarantees are in dues-schema.test.ts.
//
// As in tests/member-actions.test.ts and tests/point-actions.test.ts, the
// "use server" exports in app/actions/dues.ts are NOT called directly — they
// need a request context for cookies. What is exercised here is the exact
// statement sequence commitImport runs, so a change that breaks the contract
// fails here rather than in a browser.
//
// The headline case is the overlapping statement. Officers upload overlapping
// ranges ON PURPOSE, so de-duplication is the normal path rather than an edge
// case, a demo will never exercise it, and its failure mode is silently
// double-counting somebody's dues.

const db = testClient();
const track: Tracker = newTracker();

const PRICES: DuesPrices = { oneTermCents: 3000, twoTermCents: 5000 };

let officerId = "";
let rowan = "";
let amara = "";
let rowanEid = "";
let amaraEid = "";

/** Unique per run, so parallel-safe and easy to clean up. */
const RUN = crypto.randomUUID().slice(0, 8);
const txnIds = new Set<string>();

function txn(suffix: string): string {
  const id = `t3q-imp-${RUN}-${suffix}`;
  txnIds.add(id);
  return id;
}

/**
 * A statement in the real export's shape: two preamble lines, the header on
 * line 3 with a leading empty column, an id-less balance row, and a multi-line
 * quoted footer. Values invented — the repo is public.
 */
function statement(rows: string[]): string {
  return [
    "Account Statement - (@Fake-Org) ,,,,,,,,,",
    "Account Activity,,,,,,,,,",
    ",ID,Datetime,Type,Status,Note,From,To,Amount (total),Disclaimer",
    ",,,,,,,,,",
    ...rows,
    ',,,,,,,,,"Legal disclaimer',
    'spanning two lines."',
  ].join("\n");
}

function row(opts: {
  id: string;
  note: string;
  amount: string;
  when?: string;
  type?: string;
  status?: string;
  from?: string;
}): string {
  const {
    id,
    note,
    amount,
    when = "2026-09-03T14:05:00",
    type = "Payment",
    status = "Complete",
    from = "Fake Payer",
  } = opts;
  return `,${id},${when},${type},${status},${note},${from},MISA,${amount},`;
}

/** The write commitImport performs, reproduced exactly. */
async function commit(csv: string, roster: RosterEntry[]) {
  const parsed = parseVenmoStatement(csv);
  const planned: PlannedPayment[] = parsed.payments.map((p) =>
    planPayment(p, roster, PRICES)
  );
  const batchId = crypto.randomUUID();

  const { data: created, error } = await db
    .from("dues_payments")
    .upsert(
      planned.map((payment) => ({
        venmo_txn_id: payment.venmoTxnId,
        member_id: payment.memberId,
        paid_at: payment.paidAt.toISOString(),
        amount_cents: payment.amountCents,
        note: payment.note,
        payer_name: payment.payerName,
        payer_handle: payment.payerHandle,
        submitted_eid: payment.submittedEid,
        terms_covered: payment.termsCovered,
        // ⚠️ Set explicitly, as commitImport does. The column default asks
        // term_of(now()) — the import time — because a Postgres default cannot
        // reference another column, so it can never ask what term the PAYMENT
        // was made in. Those differ for every statement uploaded after a term
        // boundary, which is the ordinary case.
        start_term: termOf(payment.paidAt),
        import_batch_id: batchId,
        imported_by: officerId,
      })),
      { onConflict: "venmo_txn_id", ignoreDuplicates: true }
    )
    .select("id, venmo_txn_id, member_id, terms_covered, covered_terms");

  if (error) throw new Error(`commit failed: ${error.message}`);
  return { created, requested: planned.length, batchId };
}

async function countPayments(): Promise<number> {
  const { count, error } = await db
    .from("dues_payments")
    .select("id", { count: "exact", head: true })
    .in("venmo_txn_id", [...txnIds]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countMembers(): Promise<number> {
  const { count, error } = await db
    .from("members")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

beforeAll(async () => {
  officerId = await getTestOfficer(db);

  const one = testIdentity();
  const two = testIdentity();
  rowanEid = one.eid;
  amaraEid = two.eid;
  rowan = await createTestMember(db, track, one);
  amara = await createTestMember(db, track, two);
}, 60_000);

afterAll(async () => {
  // ON DELETE RESTRICT on member_id, so payments go before members — which is
  // itself the behaviour that foreign key exists to produce.
  if (txnIds.size > 0) {
    await db.from("dues_payments").delete().in("venmo_txn_id", [...txnIds]);
  }
  await cleanup(db, track);
});

describe("fetchRosterIndex", () => {
  it("returns every member with a normalized EID, uncapped and unfiltered", async () => {
    const result = await fetchRosterIndex(db);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const ids = new Set(result.roster.map((entry) => entry.memberId));
    expect(ids.has(rowan)).toBe(true);
    expect(ids.has(amara)).toBe(true);

    // ⚠️ Not fetchMemberOptions: that caps at MEMBER_SCAN_LIMIT and filters to
    // active members. Matching a payment against a truncated roster reports
    // "unmatched" for somebody who IS on the roster — silent truncation landing
    // on money.
    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true });
    expect(result.roster.length).toBe(count ?? 0);
  });

  it("folds the EID the same way the note matcher does", async () => {
    const result = await fetchRosterIndex(db);
    if (result.kind !== "ok") throw new Error("roster read failed");

    const entry = result.roster.find((e) => e.memberId === rowan);
    expect(entry?.normalizedEid).toBe(rowanEid.toLowerCase());
  });
});

describe("the import write", () => {
  it("stores a matched payment with the terms its amount bought", async () => {
    const roster: RosterEntry[] = [
      { memberId: rowan, normalizedEid: rowanEid.toLowerCase() },
    ];
    const id = txn("matched");

    const { created } = await commit(
      statement([row({ id, note: `${rowanEid} dues`, amount: "+ $50.00" })]),
      roster
    );

    expect(created).toHaveLength(1);
    expect(created[0].member_id).toBe(rowan);
    expect(created[0].terms_covered).toBe(2);
    expect(created[0].covered_terms).toHaveLength(2);
  });

  it("⚠️ stores an unresolvable note WITHOUT creating a member", async () => {
    // A test that only checked the returned status would pass while the roster
    // quietly grew. §4.2: a payment note never creates a member.
    const before = await countMembers();
    const id = txn("unmatched");

    const { created } = await commit(
      statement([row({ id, note: "thanks!", amount: "+ $30.00" })]),
      []
    );

    expect(created).toHaveLength(1);
    expect(created[0].member_id).toBeNull();
    expect(await countMembers()).toBe(before);
  });

  it("stores an odd amount linked but undecided, covering nothing", async () => {
    const roster: RosterEntry[] = [
      { memberId: amara, normalizedEid: amaraEid.toLowerCase() },
    ];
    const id = txn("odd");

    const { created } = await commit(
      statement([row({ id, note: amaraEid, amount: "+ $42.00" })]),
      roster
    );

    expect(created[0].member_id).toBe(amara);
    expect(created[0].terms_covered).toBeNull();
    // Generated from a null terms_covered, so the member reads Not Paid until
    // an officer decides. Under-reporting is visible in the queue;
    // over-reporting would be visible nowhere.
    expect(created[0].covered_terms).toBeNull();
  });

  it("ignores rows that are not completed incoming payments", async () => {
    const outgoing = txn("outgoing");
    const pending = txn("pending");
    const good = txn("good");

    const { created } = await commit(
      statement([
        row({ id: outgoing, note: "", amount: "- $80.00", type: "Standard Transfer" }),
        row({ id: pending, note: rowanEid, amount: "+ $30.00", status: "Pending" }),
        row({ id: good, note: rowanEid, amount: "+ $30.00" }),
      ]),
      [{ memberId: rowan, normalizedEid: rowanEid.toLowerCase() }]
    );

    expect(created.map((r) => r.venmo_txn_id)).toEqual([good]);
  });
});

describe("re-importing", () => {
  it("🪤 THE HEADLINE CASE: an overlapping statement adds only what is new", async () => {
    // Officers upload overlapping ranges deliberately, to keep the roster
    // fresher than monthly. This is the normal path, a demo will not exercise
    // it, and getting it wrong double-counts somebody's dues silently.
    const roster: RosterEntry[] = [
      { memberId: rowan, normalizedEid: rowanEid.toLowerCase() },
    ];
    const a = txn("ov-a");
    const b = txn("ov-b");
    const c = txn("ov-c");

    const first = await commit(
      statement([
        row({ id: a, note: rowanEid, amount: "+ $30.00" }),
        row({ id: b, note: rowanEid, amount: "+ $30.00" }),
      ]),
      roster
    );
    expect(first.created).toHaveLength(2);

    const before = await countPayments();

    // The second statement re-covers b and adds c.
    const second = await commit(
      statement([
        row({ id: b, note: rowanEid, amount: "+ $30.00" }),
        row({ id: c, note: rowanEid, amount: "+ $30.00" }),
      ]),
      roster
    );

    expect(second.created).toHaveLength(1);
    expect(second.created[0].venmo_txn_id).toBe(c);
    // requested − returned is the duplicate count, with no second query.
    expect(second.requested - second.created.length).toBe(1);
    expect(await countPayments()).toBe(before + 1);
  });

  it("is a complete no-op for an identical statement", async () => {
    const roster: RosterEntry[] = [
      { memberId: rowan, normalizedEid: rowanEid.toLowerCase() },
    ];
    const id = txn("same");
    const csv = statement([row({ id, note: rowanEid, amount: "+ $30.00" })]);

    expect((await commit(csv, roster)).created).toHaveLength(1);
    const before = await countPayments();

    const again = await commit(csv, roster);
    expect(again.created).toHaveLength(0);
    expect(await countPayments()).toBe(before);
  });

  it("⚠️ stays a no-op for a payment an officer has VOIDED", async () => {
    // The unique index spans voided rows for exactly this. A partial index
    // excluding them would resurrect a payment the officer deliberately
    // removed, on the next upload of the same month.
    const roster: RosterEntry[] = [
      { memberId: rowan, normalizedEid: rowanEid.toLowerCase() },
    ];
    const id = txn("voided");
    const csv = statement([row({ id, note: rowanEid, amount: "+ $30.00" })]);

    await commit(csv, roster);
    await db
      .from("dues_payments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officerId,
        void_reason: "test void",
      })
      .eq("venmo_txn_id", id);

    const before = await countPayments();
    const again = await commit(csv, roster);

    expect(again.created).toHaveLength(0);
    expect(await countPayments()).toBe(before);

    // And it is still voided — not silently un-voided by the re-import.
    const { data } = await db
      .from("dues_payments")
      .select("voided_at")
      .eq("venmo_txn_id", id)
      .single();
    expect(data?.voided_at).not.toBeNull();
  });
});

describe("previewing", () => {
  it("writes nothing", async () => {
    // previewImport parses and probes and must not touch the table. Driven here
    // as the probe the action runs, since the action itself needs a request
    // context.
    const id = txn("preview");
    const csv = statement([row({ id, note: rowanEid, amount: "+ $30.00" })]);
    const before = await countPayments();

    const parsed = parseVenmoStatement(csv);
    const planned = parsed.payments.map((p) =>
      planPayment(p, [{ memberId: rowan, normalizedEid: rowanEid.toLowerCase() }], PRICES)
    );
    const { error } = await db
      .from("dues_payments")
      .select("venmo_txn_id")
      .in("venmo_txn_id", planned.map((p) => p.venmoTxnId));

    expect(error).toBeNull();
    expect(await countPayments()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// The corrections (phase 3)
// ---------------------------------------------------------------------------
//
// Same convention as the block above: savePayment and voidPayment are
// "use server" exports and need a request context, so what runs here is the
// exact statement sequence they perform. A change that breaks the contract
// fails here rather than in a browser.

/** The columns savePayment reads on both sides of its audit entry. */
const SAVE_COLUMNS =
  "id, member_id, paid_at, start_term, terms_covered, covered_terms, voided_at, updated_at";

async function readPayment(id: string) {
  const { data, error } = await db
    .from("dues_payments")
    .select(SAVE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("payment not found");
  return data;
}

/** savePayment's write, reproduced. Returns the row, or null when the CAS lost. */
async function save(
  id: string,
  expectedUpdatedAt: string,
  patch: {
    member_id: string | null;
    start_term: string;
    terms_covered: number | null;
  }
) {
  const { data, error } = await db
    .from("dues_payments")
    .update(patch)
    .eq("id", id)
    // The raw PostgREST string, never a Date round trip — microsecond precision
    // is what makes this match at all.
    .eq("updated_at", expectedUpdatedAt)
    .select(SAVE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** voidPayment's write, reproduced. All three columns in one statement. */
async function voidIt(id: string, reason: string) {
  const { data, error } = await db
    .from("dues_payments")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: officerId,
      void_reason: reason,
    })
    .eq("id", id)
    .is("voided_at", null)
    .select(SAVE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function duesPaid(memberId: string): Promise<boolean | null> {
  const { data, error } = await db
    .from("member_directory")
    .select("dues_paid_term")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.dues_paid_term ?? null;
}

async function currentTerm(): Promise<string> {
  const { data, error } = await db.rpc("current_term");
  if (error) throw new Error(error.message);
  return data;
}

describe("assigning and voiding a payment", () => {
  it("âš ï¸ flips dues_paid_term on, and back off when voided", async () => {
    // The stage's exit criterion, end to end. Nothing application-side
    // maintains this boolean — member_directory derives it from covered_terms —
    // so it is the one assertion that proves the whole chain agrees.
    const term = await currentTerm();
    const id = txn("assign-flip");
    const { created } = await commit(
      statement([row({ id, note: "dues", amount: "+ $30.00" })]),
      // Empty roster, so the note resolves to nobody: the queued row an officer
      // is about to resolve by hand.
      []
    );
    const paymentId = created[0].id;
    expect(created[0].member_id).toBeNull();
    expect(await duesPaid(amara)).toBe(false);

    const before = await readPayment(paymentId);
    const after = await save(paymentId, before.updated_at, {
      member_id: amara,
      // Derived from the term under test, never typed: global-setup.ts unpins
      // app_settings.current_term, so current_term() here is whatever today
      // derives rather than the seed's pinned Spring 2026.
      start_term: term,
      terms_covered: 1,
    });

    expect(after).not.toBeNull();
    expect(after?.covered_terms).toEqual([term]);
    expect(await duesPaid(amara)).toBe(true);

    // Voiding is retroactive by construction: the status is a live derivation
    // from covered_terms, not a stored flag. It will surprise someone, which is
    // why the reason is required and an audit row is written.
    const voided = await voidIt(paymentId, "Refunded - paid twice");
    expect(voided).not.toBeNull();
    expect(await duesPaid(amara)).toBe(false);

    // Still holds its coverage; it simply stops counting.
    expect(voided?.covered_terms).toEqual([term]);
  });

  it("âš ï¸ a stale updated_at updates nothing", async () => {
    // The compare-and-set, from the losing side. Without it, two officers with
    // the page open would silently overwrite each other's attribution.
    const id = txn("cas-conflict");
    const { created } = await commit(
      statement([row({ id, note: "dues", amount: "+ $30.00" })]),
      []
    );
    const paymentId = created[0].id;

    const before = await readPayment(paymentId);
    const won = await save(paymentId, before.updated_at, {
      member_id: rowan,
      start_term: before.start_term,
      terms_covered: 1,
    });
    expect(won).not.toBeNull();

    // The second officer still holds the token they rendered with.
    const lost = await save(paymentId, before.updated_at, {
      member_id: amara,
      start_term: before.start_term,
      terms_covered: 2,
    });
    expect(lost).toBeNull();

    // And the first officer's write stands, unclobbered.
    const now = await readPayment(paymentId);
    expect(now.member_id).toBe(rowan);
    expect(now.terms_covered).toBe(1);
  });

  it("regenerates covered_terms when an officer decides an amount", async () => {
    // The $42 case: an amount matching neither price parses, links, and waits.
    // An undecided row covers NOTHING, which is what makes the failure
    // direction under-reporting membership rather than over-reporting it.
    const roster: RosterEntry[] = [
      { memberId: rowan, normalizedEid: rowanEid.toLowerCase() },
    ];
    const id = txn("undecided");
    const { created } = await commit(
      statement([row({ id, note: `dues ${rowanEid}`, amount: "+ $42.00" })]),
      roster
    );
    expect(created[0].member_id).toBe(rowan);
    expect(created[0].terms_covered).toBeNull();
    expect(created[0].covered_terms).toBeNull();

    const before = await readPayment(created[0].id);
    const after = await save(created[0].id, before.updated_at, {
      member_id: rowan,
      start_term: before.start_term,
      terms_covered: 2,
    });

    // Generated from start_term and terms_covered by terms_from(), so the
    // application never writes it and the two cannot disagree. Two terms, the
    // first being where it starts — the second is whatever next_term() says,
    // which is the point of not asserting it as a literal.
    expect(after?.covered_terms).toHaveLength(2);
    expect(after?.covered_terms?.[0]).toBe(before.start_term);
  });

  it("ðŸª¤ correcting start_term moves what the payment covers", async () => {
    // The summer case. Â§4.7 puts May-July in Spring, so a July payment meant
    // for the coming Fall buys a term with three weeks left in it. The rule is
    // not changed — that would make term_of disagree with itself between events
    // and payments — so start_term is a column an officer can correct.
    const id = txn("summer");
    const { created } = await commit(
      statement([
        row({
          id,
          note: "dues",
          amount: "+ $30.00",
          when: "2026-06-15T14:05:00",
        }),
      ]),
      []
    );
    const paymentId = created[0].id;

    const before = await readPayment(paymentId);
    expect(before.start_term).toBe("Spring 2026");

    const after = await save(paymentId, before.updated_at, {
      member_id: null,
      start_term: "Fall 2026",
      terms_covered: 1,
    });
    expect(after?.covered_terms).toEqual(["Fall 2026"]);
  });

  it("never creates a member", async () => {
    // Â§4.2's rule, extended to money and asserted from the other side: a status
    // check alone would pass while the roster quietly grew.
    const id = txn("no-member-created");
    const { created } = await commit(
      statement([row({ id, note: "no eid here", amount: "+ $30.00" })]),
      []
    );
    const paymentId = created[0].id;

    const membersBefore = await countMembers();
    const before = await readPayment(paymentId);
    await save(paymentId, before.updated_at, {
      member_id: null,
      start_term: before.start_term,
      terms_covered: 1,
    });
    expect(await countMembers()).toBe(membersBefore);
  });

  it("voiding twice is refused rather than repeated", async () => {
    // No compare-and-set here, and none is needed: voiding is one-way, so
    // `.is("voided_at", null)` is a complete guard. Zero rows back means
    // another officer got there first — the argument voidAdjustment makes.
    const id = txn("double-void");
    const { created } = await commit(
      statement([row({ id, note: "dues", amount: "+ $30.00" })]),
      []
    );
    expect(await voidIt(created[0].id, "First void")).not.toBeNull();
    expect(await voidIt(created[0].id, "Second void")).toBeNull();
  });

  it("ðŸ”“ re-importing a statement whose payment was voided stays a no-op", async () => {
    // The unique index spans voided rows for exactly this reason: a re-import
    // must not resurrect a payment an officer deliberately voided. Phase 3 is
    // the first time there is anything for that to protect.
    const id = txn("void-then-reimport");
    const csv = statement([row({ id, note: "dues", amount: "+ $30.00" })]);
    const first = await commit(csv, []);
    await voidIt(first.created[0].id, "Refunded");

    const again = await commit(csv, []);
    expect(again.created).toHaveLength(0);

    // And it is still voided, not quietly revived.
    const now = await readPayment(first.created[0].id);
    expect(now.voided_at).not.toBeNull();
  });
});
