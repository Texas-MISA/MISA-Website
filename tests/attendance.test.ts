import { describe, expect, it } from "vitest";

import {
  canApprove,
  describeGap,
  diffStudentId,
  editDistance,
  formatDuration,
  MIN_SUGGESTION_SCORE,
  nameTokens,
  parseInterval,
  previewResolution,
  rankMemberSuggestions,
  scoreMemberMatch,
  type MemberCandidate,
  type SubmissionIdentity,
} from "@/lib/attendance";
import { normalizeStudentId } from "@/lib/checkin";

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
    // Damerau, not plain Levenshtein — a swapped pair is the commonest ID typo.
    expect(editDistance("UT12345", "UT13245")).toBe(1);
  });

  it("measures ordinary edits", () => {
    expect(editDistance("UT12345", "UT12345")).toBe(0);
    expect(editDistance("UT12345", "UT12346")).toBe(1);
    expect(editDistance("JON", "JOHN")).toBe(1);
    expect(editDistance("UT12345", "UT12")).toBe(3);
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
    studentId: "UT-100200",
    normalizedStudentId: "UT100200",
    active: true,
    ...over,
  });

  const submission = (over: Partial<SubmissionIdentity>): SubmissionIdentity => {
    const studentId = over.studentId ?? "UT-100200";
    return {
      fullName: "Hana Sato",
      email: "hana.sato@example.edu",
      studentId,
      normalizedStudentId: normalizeStudentId(studentId),
      ...over,
    };
  };

  it("ranks an exact email above a shared-name match", () => {
    const right = candidate({
      fullName: "H. Sato",
      email: "hana.sato@example.edu",
      normalizedStudentId: "UT999999",
    });
    const wrong = candidate({
      fullName: "Hana Sato",
      email: "different.person@example.edu",
      normalizedStudentId: "UT888888",
    });

    const ranked = rankMemberSuggestions(
      submission({ studentId: "UT-000000" }),
      [wrong, right]
    );
    expect(ranked[0].member.id).toBe(right.id);
    expect(ranked[0].reasons).toContainEqual({ kind: "email_exact" });
  });

  it("finds the member behind a one-character ID typo", () => {
    const right = candidate({ normalizedStudentId: "UT100999" });
    const other = candidate({
      fullName: "Luca Moretti",
      email: "luca.moretti@example.edu",
      normalizedStudentId: "UT200000",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Rowan Pike",
        email: "rowan.pike@example.edu",
        studentId: "UT-100998",
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
      normalizedStudentId: "UT500500",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Jon Smith",
        email: "jsmith@other.example.edu",
        studentId: "UT-999999",
      }),
      [john]
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].member.id).toBe(john.id);
  });

  it("treats differently-formatted raw IDs as the same person", () => {
    const member = candidate({ normalizedStudentId: "UT12345" });
    const { reasons } = scoreMemberMatch(
      submission({
        studentId: "ut 12345",
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
      normalizedStudentId: "UT777777",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Wren Abbott",
        email: "wren.abbott@example.edu",
        studentId: "UT-111111",
      }),
      [unrelated]
    );
    expect(ranked).toEqual([]);
    expect(
      scoreMemberMatch(
        submission({
          fullName: "Wren Abbott",
          email: "wren.abbott@example.edu",
          studentId: "UT-111111",
        }),
        unrelated
      ).score
    ).toBeLessThan(MIN_SUGGESTION_SCORE);
  });

  it("breaks ties alphabetically", () => {
    const zane = candidate({
      fullName: "Zane Okonkwo",
      email: "zane@example.edu",
      normalizedStudentId: "UT300300",
    });
    const amara = candidate({
      fullName: "Amara Osei",
      email: "amara@example.edu",
      normalizedStudentId: "UT300300",
    });

    const ranked = rankMemberSuggestions(
      submission({
        fullName: "Nobody Here",
        email: "nobody@example.edu",
        studentId: "UT-300300",
      }),
      [zane, amara]
    );
    expect(ranked.map((entry) => entry.member.fullName)).toEqual([
      "Amara Osei",
      "Zane Okonkwo",
    ]);
  });
});

describe("diffStudentId", () => {
  it("points at the first differing character", () => {
    expect(diffStudentId("UT100999", "UT100998").firstDifferenceAt).toBe(7);
    expect(diffStudentId("UT100999", "UT200999").firstDifferenceAt).toBe(2);
  });

  it("reports no difference for identical ids", () => {
    expect(diffStudentId("UT100999", "UT100999").firstDifferenceAt).toBeNull();
  });

  it("handles a length difference", () => {
    expect(diffStudentId("UT100", "UT100999").firstDifferenceAt).toBe(5);
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
