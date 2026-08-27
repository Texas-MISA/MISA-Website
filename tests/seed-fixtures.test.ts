import { beforeAll, describe, expect, it } from "vitest";

import { rankMemberSuggestions, type MemberCandidate } from "@/lib/attendance";
import { normalizeEid } from "@/lib/checkin";

import { testClient } from "./helpers";

// The seed's near-miss fixtures, asserted against the real ranker.
//
// Unusual for this suite — everything else builds its own fixtures — and
// deliberate: seed.sql hand-picks three EIDs to sit at specific edit distances
// from specific members, and nothing else checks that they still do. The
// distances are the whole point of those rows, and they are exactly the kind
// of property that a later seed edit breaks silently.
//
// 🪤 Why the cluster exists at all. The original bug: Rowan Pike, on no roster,
// was offered three confident-looking strangers, because sequentially issued
// six-digit IDs put roughly three members within edit distance 2 of any
// number. EIDs are not sequential — but they are derived from name initials,
// which reintroduces the same clustering from the other direction. The seed
// reproduces it on purpose (mp8570, pn8571, ro8574 all sit at distance 2 from
// rp8571) so that this test proves the score floor still rejects it.

let roster: MemberCandidate[] = [];

async function submissionFor(name: string) {
  const db = testClient();
  const { data, error } = await db
    .from("attendance")
    .select("submitted_name, submitted_eid, submitted_email")
    .eq("submitted_name", name)
    // Scoped to pending: Hana Sato and Luca Moretti are real members with a
    // present row for most seeded events, and only their orphan is a fixture.
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`seed fixture missing: ${name}`);
  return {
    fullName: data.submitted_name,
    email: data.submitted_email,
    eid: data.submitted_eid,
    normalizedEid: normalizeEid(data.submitted_eid),
  };
}

beforeAll(async () => {
  const db = testClient();
  const { data, error } = await db
    .from("members")
    .select("id, full_name, email, eid, normalized_eid");
  if (error) throw new Error(error.message);
  roster = (data ?? []).map((m) => ({
    id: m.id,
    fullName: m.full_name,
    email: m.email,
    eid: m.eid,
    normalizedEid: m.normalized_eid ?? "",
  }));
});

describe("seeded near-miss fixtures", () => {
  it("has the roster the rest of this file assumes", () => {
    expect(roster.length).toBe(32);
    // Every EID normalizes distinctly, or the fixtures below mean nothing.
    expect(new Set(roster.map((m) => m.normalizedEid)).size).toBe(32);
  });

  it("offers nothing for Rowan Pike, who is on no roster", async () => {
    const submission = await submissionFor("Rowan Pike");

    // The regression assertion. Three members sit at distance 2 from rp8571;
    // if any of them is suggested, the score floor has stopped working and the
    // review screen is back to naming strangers with confidence.
    const ranked = rankMemberSuggestions(submission, roster);
    expect(ranked.map((entry) => entry.member.fullName)).toEqual([]);
  });

  it("keeps Rowan Pike genuinely close to several members", async () => {
    // Guards the guard: if the seed drifts so that rp8571 is far from
    // everyone, the test above would pass vacuously and prove nothing.
    const submission = await submissionFor("Rowan Pike");
    const { editDistance } = await import("@/lib/attendance");
    const withinTwo = roster.filter(
      (m) => editDistance(submission.normalizedEid, m.normalizedEid, 3) === 2
    );
    expect(withinTwo.length).toBeGreaterThanOrEqual(3);
    // And none at distance 1, which would legitimately deserve a suggestion.
    const withinOne = roster.filter(
      (m) => editDistance(submission.normalizedEid, m.normalizedEid, 3) === 1
    );
    expect(withinOne).toEqual([]);
  });

  it("offers nothing for Sage Delacroix either", async () => {
    // Distance 2 from ds4392 by a transposition of the initials plus one
    // digit — the shape a real mistyped EID takes, and still not enough alone.
    const submission = await submissionFor("Sage Delacroix");
    expect(rankMemberSuggestions(submission, roster)).toEqual([]);
  });

  it("offers nothing for Toby Vance, who matches nobody", async () => {
    const submission = await submissionFor("Toby Vance");
    expect(rankMemberSuggestions(submission, roster)).toEqual([]);
  });

  it("still finds the right member when the EID is exact", async () => {
    // The other side of the floor: suggestions must not have become useless.
    // Hana Sato's orphan carries her own EID, so she must rank first.
    const submission = await submissionFor("Hana Sato");
    const ranked = rankMemberSuggestions(submission, roster);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].member.fullName).toBe("Hana Sato");
    expect(ranked[0].reasons).toContainEqual({ kind: "id_exact" });
  });

  it("matches a member whose stored EID is in a different case", async () => {
    // Luca Moretti's orphan carries lm2647; the roster stores several members
    // in mixed case (AO4471, Cw9134, GR1975, XL6157). The fold is what makes
    // those one person rather than two.
    const submission = await submissionFor("Luca Moretti");
    const ranked = rankMemberSuggestions(submission, roster);
    expect(ranked[0].member.fullName).toBe("Luca Moretti");
  });
});
