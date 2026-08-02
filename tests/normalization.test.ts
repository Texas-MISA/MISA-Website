import { afterAll, describe, expect, it } from "vitest";

import { normalizeEid } from "@/lib/checkin";

import { cleanup, newTracker, testClient } from "./helpers";

// The JS normalizeEid() mirrors the SQL generated-column expression
//   upper(regexp_replace(x, '\s|-', '', 'g'))
// and the two are matched against each other at check-in, so they must strip
// identically. This suite inserts pathological raw IDs and asserts the
// database's stored normalization equals the JS result, character for
// character.
//
// Inputs stay within ASCII whitespace (space, tab, CR, LF) — JS \s also
// matches exotic Unicode spaces (NBSP etc.) where Postgres [[:space:]] is
// locale-dependent, and no EID legitimately contains them.

const db = testClient();
const track = newTracker();

afterAll(() => cleanup(db, track));

const PATHOLOGICAL = [
  "t3q7001",
  "T3Q7002",
  " t3  q7003 ",
  "T3--q7-00-4",
  "t3\tq7005",
  "T3-q700-6\r",
  "t 3 q 7 0 0 7",
  "--t3q7008--",
];

describe("normalization lockstep (JS mirror vs SQL generated column)", () => {
  it.each(PATHOLOGICAL)("DB and JS agree on %j", async (raw) => {
    const { data, error } = await db
      .from("members")
      .insert({
        full_name: "Lockstep Test",
        eid: raw,
        email: `lockstep.${normalizeEid(raw).toLowerCase()}@example.edu`,
      })
      .select("id, normalized_eid")
      .single();
    if (error) throw new Error(error.message);
    track.memberIds.push(data.id);

    expect(data.normalized_eid).toBe(normalizeEid(raw));
  });
});
