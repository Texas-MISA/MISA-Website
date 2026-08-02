import { describe, expect, it } from "vitest";

import {
  canApprove,
  describeGap,
  diffEid,
  editDistance,
  formatDuration,
  MIN_SUGGESTION_SCORE,
  nameTokens,
  parseInterval,
  planBulkAssign,
  previewResolution,
  rankMemberSuggestions,
  scoreMemberMatch,
  type MemberCandidate,
  type SubmissionIdentity,
} from "@/lib/attendance";
import { normalizeEid } from "@/lib/checkin";

// Pure suite — no database, no fixtures, no clock. Everything here is called
// with injected values, matching tests/events.test.ts. The database-dependent
// half of Stage 5 lives in tests/attendance-review.test.ts.

describe("parseInterval", () => {
  it("parses the shapes a timestamptz difference can produce", () => {
    expect(parseInterval("00:41:00")).toBe(2460);
    expect(parseInterval("00:00:00")).toBe(0);
    expect(parseInterval("02:03:04")).toBe(7384);
    expect(parseInterval("1 day 02:03:04")).toBe(93784);
    expect(parseInterval("2 days 00:00:00")).toBe(172800);
    expect(parseInterval("3 days")).toBe(259200);
  });

  it("keeps fractional seconds", () => {
    expect(parseInterval("00:00:00.5")).toBe(0.5);
    expect(parseInterval("00:00:01.25")).toBe(1.25);
  });

  it("handles Postgres' independently-signed fields", () => {
    // "-1 day -02:03:04" is how a negative interval is rendered; gap should
    // never be negative, but a parser that mangles it silently is worse than
    // one that doesn't.
    expect(parseInterval("-1 day -02:03:04")).toBe(-93784);
    expect(parseInterval("-00:41:00")).toBe(-2460);
  });

  it("returns null rather than guessing", () => {
    expect(parseInterval("")).toBeNull();
    expect(parseInterval("garbage")).toBeNull();
    expect(parseInterval("1 mon")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("never emits a zero quantity", () => {
    expect(formatDuration(0)).toBe("less than a minute");
    expect(formatDuration(30)).toBe("less than a minute");
    expect(formatDuration(59)).toBe("less than a minute");
  });

  it("pluralizes and picks units", () => {
    expect(formatDuration(60)).toBe("1 minute");
    expect(formatDuration(2460)).toBe("41 minutes");
    expect(formatDuration(3600)).toBe("1 hour");
    expect(formatDuration(5400)).toBe("1 hour 30 minutes");
    expect(formatDuration(86400)).toBe("1 day");
    expect(formatDuration(93784)).toBe("1 day 2 hours");
    expect(formatDuration(172800)).toBe("2 days");
  });
});

describe("describeGap", () => {
  // 18:00–19:00, with check-in staying open 15 minutes past the end.
  const event = {
    starts_at: "2030-03-05T18:00:00Z",
    ends_at: "2030-03-05T19:00:00Z",
    checkin_opens_at: null,
    checkin_closes_at: "2030-03-05T19:15:00Z",
  };

  it("leads with the window number, not the event number", () => {
    // The doc's example sentence measures against ends_at, but the window is
    // what refused the check-in: 41 minutes past the event is only 26 past
    // the window that actually rejected it.
    const described = describeGap({
      gap: "00:41:00",
      submittedAt: "2030-03-05T19:41:00Z",
      event,
    });

    expect(described.direction).toBe("after");
    expect(described.secondsOutsideWindow).toBe(26 * 60);
    expect(described.headline).toBe(
      "check-in closed 26 minutes before this submission"
    );
    expect(described.eventRelative).toBe("event ended 41 minutes before");
  });

  it("describes a submission that arrived before the window opened", () => {
    const described = describeGap({
      gap: "02:00:00",
      submittedAt: "2030-03-05T16:00:00Z",
      event,
    });

    expect(described.direction).toBe("before");
    expect(described.headline).toBe(
      "check-in opens 2 hours after this submission"
    );
    expect(described.eventRelative).toBe("event starts 2 hours after");
  });

  it("treats an instant inside the run as during, not as a negative gap", () => {
    // §4.3: a two-branch version reports starts_at - ts here, which sorts a
    // genuinely-concurrent event below distant ones.
    const described = describeGap({
      gap: "00:00:00",
      submittedAt: "2030-03-05T18:30:00Z",
      event,
    });

    expect(described.direction).toBe("during");
    expect(described.secondsOutsideWindow).toBe(0);
    expect(described.headline).toBe("check-in was open when this was submitted");
    expect(described.eventRelative).toBe("event was running");
  });

  it("falls back to the timestamps when gap is missing or unparseable", () => {
    const described = describeGap({
      gap: "not-an-interval",
      submittedAt: "2030-03-05T19:41:00Z",
      event,
    });
    expect(described.eventRelative).toBe("event ended 41 minutes before");

    expect(describeGap({ gap: null, submittedAt: "2030-03-05T19:41:00Z", event }))
      .toMatchObject({ eventRelative: "event ended 41 minutes before" });
  });

  it("uses the event bounds when no explicit window is set", () => {
    const described = describeGap({
      gap: "00:41:00",
      submittedAt: "2030-03-05T19:41:00Z",
      event: { ...event, checkin_closes_at: null },
    });
    // Window and event coincide, so both numbers agree.
    expect(described.secondsOutsideWindow).toBe(41 * 60);
    expect(described.headline).toBe(
      "check-in closed 41 minutes before this submission"
    );
  });
});

describe("editDistance", () => {
  it("counts a transposition as one edit", () => {
    // Damerau, not plain Levenshtein — a swapped pair is the commonest typo.
    // On EIDs this matters more than it did: initials transpose too, so
    // ds4392 and sd4392 are one edit apart, not two.
    expect(editDistance("ao1234", "ao1324")).toBe(1);
    expect(editDistance("ds4392", "sd4392")).toBe(1);
  });

  it("measures ordinary edits", () => {
    expect(editDistance("ao1234", "ao1234")).toBe(0);
    expect(editDistance("ao1234", "ao1235")).toBe(1);
    expect(editDistance("jon", "john")).toBe(1);
    expect(editDistance("ao1234", "ao1")).toBe(3);
  });

  it("short-circuits at the cap", () => {
    expect(editDistance("aaaaaaaa", "bbbbbbbb", 3)).toBe(3);
    expect(editDistance("a", "bbbbbbbbbbbb", 2)).toBe(2);
  });
});

describe("nameTokens", () => {
  it("lowercases, strips punctuation, and drops single characters", () => {
    expect(nameTokens("Amara O'Sei-Boateng")).toEqual([
      "amara",
      "sei",
      "boateng",
    ]);
    expect(nameTokens("J. Quinn Adeyemi")).toEqual(["quinn", "adeyemi"]);
    expect(nameTokens("   ")).toEqual([]);
  });
});

describe("member suggestions", () => {
  const candidate = (over: Partial<MemberCandidate>): MemberCandidate => ({
    id: crypto.randomUUID(),
    fullName: "Hana Sato",
    email: "hana.sato@example.edu",
    eid: "hs8260",
    normalizedEid: "hs8260",
    active: true,
    ...over,
  });

  const submission = (over: Partial<SubmissionIdentity>): SubmissionIdentity => {
    const eid = over.eid ?? "hs8260";
    return {
      fullName: "Hana Sato",
      email: "hana.sato@example.edu",
      eid,
      normalizedEid: normalizeEid(eid),
      ...over,
    };
  };

  it("ranks an exact email above a shared-name match", () => {
    const right = candidate({
      fullName: "H. Sato",
      email: "hana.sato@example.edu",
      normalizedEid: "qa3291",
    });
    const wrong = candidate({
      fullName: "Hana Sato",
      email: "different.person@example.edu",
      normalizedEid: "nf9326",
    });

    const ranked = rankMemberSuggestions(
      submission({ eid: "os1458" }),
      [wrong, right]
    );
    expect(ranked[0].member.id).toBe(right.id);
    expect(ranked[0].reasons).toContainEqual({ kind: "email_exact" });
  });

  it("finds the member behind a one-character ID typo", () => {
    const right = candidate({ normalizedEid: "rp8571" });
    const other = candidate({
      fullName: "Luca Moretti",
      email: "luca.moretti@example.edu",
      normalizedEid: "lm2647",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Rowan Pike",
        email: "rowan.pike@example.edu",
        eid: "rp8570",
      }),
      [other, right]
    );
    expect(ranked[0].member.id).toBe(right.id);
    expect(ranked[0].reasons).toContainEqual({
      kind: "id_near_miss",
      distance: 1,
    });
  });

  it("matches Jon against John, which an ILIKE probe cannot", () => {
    const john = candidate({
      fullName: "John Smith",
      email: "john.smith@example.edu",
      normalizedEid: "js5120",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Jon Smith",
        email: "jsmith@other.example.edu",
        eid: "wa3428",
      }),
      [john]
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].member.id).toBe(john.id);
  });

  it("treats differently-formatted raw IDs as the same person", () => {
    const member = candidate({ normalizedEid: "ao4471" });
    const { reasons } = scoreMemberMatch(
      submission({
        eid: "AO 4471",
        email: "someone.else@example.edu",
        fullName: "Someone Else",
      }),
      member
    );
    expect(reasons).toContainEqual({ kind: "id_exact" });
  });

  it("demotes an inactive member without hiding them", () => {
    const inactive = candidate({ active: false });
    const ranked = rankMemberSuggestions(submission({}), [inactive]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].reasons).toContainEqual({ kind: "inactive" });
    expect(ranked[0].score).toBeLessThan(
      scoreMemberMatch(submission({}), candidate({})).score
    );
  });

  it("returns nothing rather than a weak guess", () => {
    // The auto-resolve invariant as a unit test: below the threshold the
    // officer gets an empty list and uses the picker, not a default pick.
    const unrelated = candidate({
      fullName: "Tomas Novak",
      email: "tomas.novak@example.edu",
      normalizedEid: "tn7146",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Wren Abbott",
        email: "wren.abbott@example.edu",
        eid: "wa3428",
      }),
      [unrelated]
    );
    expect(ranked).toEqual([]);
    expect(
      scoreMemberMatch(
        submission({
          fullName: "Wren Abbott",
          email: "wren.abbott@example.edu",
          eid: "wa3428",
        }),
        unrelated
      ).score
    ).toBeLessThan(MIN_SUGGESTION_SCORE);
  });

  // Found on screen in phase 2: Rowan Pike, on no roster at all, was offered
  // three strangers. Six-digit IDs issued in sequence put three members within
  // distance 2 of any number, so distance 2 alone is a coincidence, not a
  // signal.
  it("will not suggest on a two-character ID distance alone", () => {
    const stranger = candidate({
      fullName: "Dara Nolan",
      email: "dara.nolan@example.edu",
      normalizedEid: "mp8570",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Rowan Pike",
        email: "rowan.pike@example.edu",
        eid: "rp8571",
      }),
      [stranger]
    );
    expect(ranked).toEqual([]);
  });

  it("still suggests a two-character distance with corroboration", () => {
    const sameSurname = candidate({
      fullName: "Rowan Pike",
      email: "r.pike@other.example.edu",
      normalizedEid: "mp8570",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Rowan Pike",
        email: "rowan.pike@example.edu",
        eid: "rp8571",
      }),
      [sameSurname]
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].reasons).toContainEqual({
      kind: "id_near_miss",
      distance: 2,
    });
  });

  it("keeps a one-character distance standing on its own", () => {
    const typo = candidate({
      fullName: "Someone Unrelated",
      email: "someone.unrelated@example.edu",
      normalizedEid: "rp8570",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Rowan Pike",
        email: "rowan.pike@example.edu",
        eid: "rp8571",
      }),
      [typo]
    );
    expect(ranked).toHaveLength(1);
  });

  it("breaks ties alphabetically", () => {
    const zane = candidate({
      fullName: "Zane Okonkwo",
      email: "zane@example.edu",
      normalizedEid: "zo5236",
    });
    const amara = candidate({
      fullName: "Amara Osei",
      email: "amara@example.edu",
      normalizedEid: "zo5236",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Nobody Here",
        email: "nobody@example.edu",
        eid: "zo5236",
      }),
      [zane, amara]
    );
    expect(ranked.map((entry) => entry.member.fullName)).toEqual([
      "Amara Osei",
      "Zane Okonkwo",
    ]);
  });
});

describe("diffEid", () => {
  it("points at the first differing character", () => {
    expect(diffEid("rp8571", "rp8570").firstDifferenceAt).toBe(5);
    expect(diffEid("rp8571", "ro8571").firstDifferenceAt).toBe(1);
  });

  it("reports no difference for identical ids", () => {
    expect(diffEid("rp8571", "rp8571").firstDifferenceAt).toBeNull();
  });

  it("handles a length difference", () => {
    expect(diffEid("rp85", "rp8571").firstDifferenceAt).toBe(4);
  });

  // The roster stores EIDs in mixed case, and members type them however they
  // like, so the two sides of a suggestion routinely disagree on case and on
  // stray whitespace. Comparing raw strings made every such pair "differ" at
  // the formatting character and the UI highlighted that instead of the
  // character that actually moved — visible on /admin/attendance as
  // `roster ds4392` with the first letter marked.
  it("ignores formatting differences and marks the character that moved", () => {
    // "Sd 4390" vs "ds4392" — normalized, they diverge at index 0, because the
    // initials are transposed. The space must not be what gets reported.
    expect(diffEid("Sd 4390", "ds4392").firstDifferenceAt).toBe(0);
    // Same EID either side of a case difference, differing only in the last
    // digit: the case must not count as the difference.
    expect(diffEid("RP-8571", "rp8570").firstDifferenceAt).toBe(5);
  });

  it("maps the index onto the raw member string, not the normalized one", () => {
    // Normalized index 5, but the space in the member's raw form pushes it
    // to 6. The raw string is what is on screen, so that is what gets marked.
    const diff = diffEid("rp8571", "rp 8570");
    expect(diff.firstDifferenceAt).toBe(6);
    expect(diff.member[diff.firstDifferenceAt!]).toBe("0");
  });

  it("treats the same id in two formats as no difference at all", () => {
    expect(diffEid("vi 9701", "VI-9701").firstDifferenceAt).toBeNull();
  });

  it("returns null when the member id runs out before the difference", () => {
    expect(diffEid("rp85719", "rp85").firstDifferenceAt).toBeNull();
  });
});

describe("previewResolution", () => {
  const event = {
    starts_at: "2030-03-05T18:00:00Z",
    ends_at: "2030-03-05T19:00:00Z",
    checkin_opens_at: null,
    checkin_closes_at: null,
    status: "published",
  };

  it("says nothing when the submission lands cleanly", () => {
    expect(
      previewResolution({
        event,
        memberActive: true,
        submittedAt: "2030-03-05T18:30:00Z",
      })
    ).toEqual([]);
  });

  it("warns that a draft event still moves public standings", () => {
    // The leaderboard view excludes only `cancelled`, so attendance on an
    // unpublished event counts publicly. Surprising enough to surface.
    expect(
      previewResolution({
        event: { ...event, status: "draft" },
        memberActive: true,
        submittedAt: "2030-03-05T18:30:00Z",
      })
    ).toContainEqual({ kind: "event_draft" });
  });

  it("warns that a cancelled event counts for nothing", () => {
    expect(
      previewResolution({
        event: { ...event, status: "cancelled" },
        memberActive: true,
        submittedAt: "2030-03-05T18:30:00Z",
      })
    ).toContainEqual({ kind: "event_cancelled" });
  });

  it("warns that an inactive member produces no public change", () => {
    expect(
      previewResolution({
        event,
        memberActive: false,
        submittedAt: "2030-03-05T18:30:00Z",
      })
    ).toContainEqual({ kind: "member_inactive" });
  });

  it("reports how far outside the window the submission fell", () => {
    expect(
      previewResolution({
        event,
        memberActive: true,
        submittedAt: "2030-03-05T19:40:00Z",
      })
    ).toContainEqual({
      kind: "outside_window",
      secondsOutside: 40 * 60,
      side: "after",
    });

    expect(
      previewResolution({
        event,
        memberActive: true,
        submittedAt: "2030-03-05T17:00:00Z",
      })
    ).toContainEqual({
      kind: "outside_window",
      secondsOutside: 60 * 60,
      side: "before",
    });
  });

  it("treats the closing instant as outside, matching the half-open window", () => {
    const warnings = previewResolution({
      event,
      memberActive: true,
      submittedAt: "2030-03-05T19:00:00Z",
    });
    expect(warnings).toContainEqual({
      kind: "outside_window",
      secondsOutside: 0,
      side: "after",
    });
  });

  it("has no opinion when no event is linked yet", () => {
    expect(
      previewResolution({
        event: null,
        memberActive: true,
        submittedAt: "2030-03-05T19:40:00Z",
      })
    ).toEqual([]);
  });
});

describe("canApprove", () => {
  it("mirrors present_requires_resolution", () => {
    expect(canApprove({ event_id: "e", member_id: "m" })).toBe(true);
    expect(canApprove({ event_id: "e", member_id: null })).toBe(false);
    expect(canApprove({ event_id: null, member_id: "m" })).toBe(false);
    expect(canApprove({ event_id: null, member_id: null })).toBe(false);
  });
});

describe("planBulkAssign", () => {
  const row = (over: Partial<Parameters<typeof planBulkAssign>[0]["selected"][number]>) => ({
    id: crypto.randomUUID(),
    submittedName: "Hana Sato",
    submittedAt: "2026-04-07T20:15:00Z",
    status: "pending",
    normalizedEid: "hs8260",
    memberId: null,
    ...over,
  });

  it("assigns and approves only the rows that have a member", () => {
    const withMember = row({ memberId: "m1", normalizedEid: "hs8260" });
    const without = row({ memberId: null, normalizedEid: "lm2647" });

    const plan = planBulkAssign({
      selected: [withMember, without],
      existingOnEvent: [],
      approve: true,
    });

    // present_requires_resolution would reject the second one, so it takes the
    // event link and stays pending. That is why the caller writes two
    // statements rather than one.
    expect(plan.assignAndApprove).toEqual([withMember.id]);
    expect(plan.assignOnly).toEqual([without.id]);
    expect(plan.skipped).toEqual([]);
  });

  it("keeps everything pending when approve is off", () => {
    const withMember = row({ memberId: "m1" });
    const plan = planBulkAssign({
      selected: [withMember],
      existingOnEvent: [],
      approve: false,
    });
    expect(plan.assignAndApprove).toEqual([]);
    expect(plan.assignOnly).toEqual([withMember.id]);
  });

  // The bug this function exists for: two checked rows are the same person,
  // which is exactly why they are both sitting in the queue. Unhandled, the
  // partial unique index takes the first and 23505s the second, failing a batch
  // the officer thought was fine.
  it("dedupes two selected rows that are the same EID", () => {
    const first = row({ submittedAt: "2026-04-07T18:00:00Z" });
    const second = row({ submittedAt: "2026-04-07T20:15:00Z" });

    const plan = planBulkAssign({
      selected: [second, first],
      existingOnEvent: [],
      approve: false,
    });

    // Oldest wins, whatever order the selection arrived in.
    expect(plan.assignOnly).toEqual([first.id]);
    expect(plan.skipped).toEqual([
      {
        id: second.id,
        submittedName: second.submittedName,
        reason: "duplicate_in_selection",
        keptId: first.id,
      },
    ]);
  });

  it("dedupes the same member reached through two raw EIDs", () => {
    // `HS 8260` and `hs-8260` normalize alike, but two *different* raw EIDs
    // can also resolve to one member — the app-level half of the §4.2 duplicate
    // rule, which the unique index alone does not cover.
    const a = row({ normalizedEid: "hs8260", memberId: "same" });
    const b = row({ normalizedEid: "zo5236", memberId: "same" });

    const plan = planBulkAssign({
      selected: [a, b],
      existingOnEvent: [],
      approve: true,
    });

    expect(plan.assignAndApprove).toEqual([a.id]);
    expect(plan.skipped[0]).toMatchObject({
      id: b.id,
      reason: "duplicate_in_selection",
    });
  });

  it("skips someone already on the target event", () => {
    const already = row({ normalizedEid: "hs8260" });
    const plan = planBulkAssign({
      selected: [already],
      existingOnEvent: [
        { normalizedEid: "hs8260", memberId: null },
      ],
      approve: false,
    });

    expect(plan.assignOnly).toEqual([]);
    expect(plan.skipped[0]).toMatchObject({ reason: "already_on_event" });
  });

  it("skips a row someone else already resolved", () => {
    const resolved = row({ status: "present" });
    const plan = planBulkAssign({
      selected: [resolved],
      existingOnEvent: [],
      approve: false,
    });
    expect(plan.skipped[0]).toMatchObject({ reason: "not_pending" });
  });

  it("accounts for every id it was given", () => {
    const rows = [
      row({ normalizedEid: "hs8260", memberId: "m1" }),
      row({ normalizedEid: "hs8260", memberId: "m2" }),
      row({ normalizedEid: "lm2647", status: "rejected" }),
      row({ normalizedEid: "zo5236" }),
    ];

    const plan = planBulkAssign({
      selected: rows,
      existingOnEvent: [],
      approve: true,
    });

    // Nothing is dropped on the floor here either — every selected id comes
    // back in exactly one bucket, which is what lets the action report partial
    // success instead of a count the officer has to trust.
    const seen = [
      ...plan.assignOnly,
      ...plan.assignAndApprove,
      ...plan.skipped.map((s) => s.id),
    ];
    expect(seen.sort()).toEqual(rows.map((r) => r.id).sort());
  });
});
