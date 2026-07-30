import { afterAll, describe, expect, it } from "vitest";

import { normalizeStudentId } from "@/lib/checkin";

import { cleanup, newTracker, testClient } from "./helpers";

// The JS normalizeStudentId() mirrors the SQL generated-column expression
//   upper(regexp_replace(x, '\s|-', '', 'g'))
// and the two are matched against each other at check-in, so they must strip
// identically. This suite inserts pathological raw IDs and asserts the
// database's stored normalization equals the JS result, character for
// character.
//
// Inputs stay within ASCII whitespace (space, tab, CR, LF) — JS \s also
// matches exotic Unicode spaces (NBSP etc.) where Postgres [[:space:]] is
// locale-dependent, and no student ID legitimately contains them.

const db = testClient();
const track = newTracker();

afterAll(() => cleanup(db, track));

const PATHOLOGICAL = [
  "t3-987001",
  "T3 987002",
  " t3  987003 ",
  "T3--98-70-04",
  "t3\t987005",
  "T3-9870-06\r",
  "t 3 9 8 7 0 0 7",
  "--t3987008--",
];

describe("normalization lockstep (JS mirror vs SQL generated column)", () => {
  it.each(PATHOLOGICAL)("DB and JS agree on %j", async (raw) => {
    const { data, error } = await db
      .from("members")
      .insert({
        full_name: "Lockstep Test",
        student_id: raw,
        email: `lockstep.${normalizeStudentId(raw).toLowerCase()}@example.edu`,
      })
      .select("id, normalized_student_id")
      .single();
    if (error) throw new Error(error.message);
    track.memberIds.push(data.id);

    expect(data.normalized_student_id).toBe(normalizeStudentId(raw));
  });
});
