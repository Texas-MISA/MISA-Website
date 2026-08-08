import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MIN_SUGGESTION_SCORE, type MemberCandidate } from "@/lib/attendance";
import { AUDITED_MEMBER_COLUMNS, type FieldDefinition } from "@/lib/members";
import {
  isOfferedChoice,
  matchAxisCount,
  mergeNotes,
  mergedCustomFields,
  MIN_DUPLICATE_AXES,
  MIN_DUPLICATE_SCORE,
  planMerge,
  rankDuplicateCandidates,
  type MergeAttendance,
  type MergeMember,
  type MergePlan,
} from "@/lib/merge";

// Merging duplicate members, pure half (§7 Stage 6 phase 8). No database and no
// clock: the two members and their attendance are injected. The integration half
// — including the double-count hazard the database cannot catch — lives in
// tests/member-merge-actions.test.ts.

const SHIRT: FieldDefinition = {
  id: "00000000-0000-4000-8000-000000000001",
  key: "shirt_size",
  label: "Shirt Size",
  kind: "select",
  options: ["S", "M", "L"],
  editableInline: true,
  showInDirectory: true,
  sortOrder: 0,
  archivedAt: null,
};

const COMMITTEE: FieldDefinition = {
  ...SHIRT,
  id: "00000000-0000-4000-8000-000000000002",
  key: "committee",
  label: "Committee",
  options: ["Socials", "Outreach"],
};

function member(over: Partial<MergeMember> = {}): MergeMember {
  return {
    id: "survivor",
    fullName: "Ada Lovelace",
    email: "ada@example.edu",
    eid: "al1815",
    normalizedEid: "al1815",
    active: true,
    joinedAt: "2026-08-01T12:00:00.000Z",
    notes: null,
    customFields: {},
    ...over,
  };
}

function attended(id: string, eventId: string | null, status = "present"): MergeAttendance {
  return { id, eventId, status, eventLabel: eventId ?? "Unassigned check-in" };
}

function plan(over: {
  survivor?: Partial<MergeMember>;
  loser?: Partial<MergeMember>;
  survivorAttendance?: MergeAttendance[];
  loserAttendance?: MergeAttendance[];
  definitions?: FieldDefinition[];
} = {}): MergePlan {
  const result = planMerge({
    survivor: member(over.survivor),
    loser: member({ id: "loser", ...over.loser }),
    survivorAttendance: over.survivorAttendance ?? [],
    loserAttendance: over.loserAttendance ?? [],
    definitions: over.definitions ?? [],
  });
  if (result.kind !== "ok") throw new Error(`expected a plan, got ${result.kind}`);
  return result.plan;
}

describe("planMerge — attendance", () => {
  it("moves a row for an event the survivor was not at", () => {
    const p = plan({ loserAttendance: [attended("a", "event-1")] });
    expect(p.attendance[0].outcome).toEqual({ kind: "move" });
    expect(p.collisions).toEqual([]);
  });

  it("flags a shared event as a collision, naming the survivor's row", () => {
    // 🔓 The whole reason this module exists. attendance_one_per_event is keyed
    // on normalized_eid, not member_id, so repointing never trips it and the
    // survivor would silently be credited twice for one event.
    const p = plan({
      survivorAttendance: [attended("mine", "event-1")],
      loserAttendance: [attended("theirs", "event-1")],
    });
    expect(p.attendance[0].outcome).toEqual({
      kind: "collides",
      survivorAttendanceId: "mine",
    });
    expect(p.collisions).toHaveLength(1);
  });

  it("does not collide against a rejected row on either side", () => {
    // A rejected row is outside the partial unique index and counts for nothing
    // in either view, so it is neither in the way nor at risk of double-counting.
    expect(
      plan({
        survivorAttendance: [attended("mine", "event-1", "rejected")],
        loserAttendance: [attended("theirs", "event-1")],
      }).collisions
    ).toEqual([]);

    expect(
      plan({
        survivorAttendance: [attended("mine", "event-1")],
        loserAttendance: [attended("theirs", "event-1", "rejected")],
      }).collisions
    ).toEqual([]);
  });

  it("collides on a pending row, because pending still occupies the event", () => {
    // present_requires_resolution lets a pending row carry an event_id, and the
    // partial index covers it — `where status <> 'rejected'`, not
    // `where status = 'present'`.
    const p = plan({
      survivorAttendance: [attended("mine", "event-1", "pending")],
      loserAttendance: [attended("theirs", "event-1")],
    });
    expect(p.collisions).toHaveLength(1);
  });

  it("always moves an orphan, which has no event to collide over", () => {
    const p = plan({
      survivorAttendance: [attended("mine", null, "pending")],
      loserAttendance: [attended("theirs", null, "pending")],
    });
    expect(p.attendance[0].outcome).toEqual({ kind: "move" });
    expect(p.collisions).toEqual([]);
  });

  it("moves rejected rows too rather than leaving them behind", () => {
    // attendance.member_id is `on delete set null`, so a row left pointing at
    // the loser loses its link entirely when the loser is deleted.
    const p = plan({ loserAttendance: [attended("old", "event-9", "rejected")] });
    expect(p.attendance[0].outcome).toEqual({ kind: "move" });
  });
});

describe("planMerge — fields, notes and dates", () => {
  it("refuses a member merged into themselves", () => {
    const same = member();
    expect(
      planMerge({
        survivor: same,
        loser: same,
        survivorAttendance: [],
        loserAttendance: [],
        definitions: [],
      })
    ).toEqual({ kind: "same_member" });
  });

  it("transfers a field only the loser answers, with no decision", () => {
    const p = plan({
      loser: { customFields: { shirt_size: "M" } },
      definitions: [SHIRT],
    });
    expect(p.fields).toEqual([
      {
        key: "shirt_size",
        label: "Shirt Size",
        survivorValue: null,
        loserValue: "M",
        conflict: false,
      },
    ]);
    expect(p.conflicts).toEqual([]);
    expect(mergedCustomFields(p, {})).toEqual({ shirt_size: "M" });
  });

  it("is not a conflict when both hold the same value", () => {
    const p = plan({
      survivor: { customFields: { shirt_size: "M" } },
      loser: { customFields: { shirt_size: "M" } },
      definitions: [SHIRT],
    });
    expect(p.conflicts).toEqual([]);
  });

  it("is a conflict when both hold different values, and defaults to the survivor", () => {
    const p = plan({
      survivor: { customFields: { shirt_size: "M" } },
      loser: { customFields: { shirt_size: "L" } },
      definitions: [SHIRT],
    });
    expect(p.conflicts.map((f) => f.key)).toEqual(["shirt_size"]);
    // No choice posted → the survivor's value, which changes nothing. The safe
    // direction.
    expect(mergedCustomFields(p, {})).toEqual({ shirt_size: "M" });
    expect(mergedCustomFields(p, { shirt_size: "L" })).toEqual({ shirt_size: "L" });
  });

  it("ignores a field neither answers", () => {
    expect(plan({ definitions: [SHIRT, COMMITTEE] }).fields).toEqual([]);
  });

  it("never writes an empty string for a value", () => {
    // The setFieldValue rule: "" would make "cleared" and "never answered" two
    // states that render identically and sort differently.
    const p = plan({
      survivor: { customFields: { shirt_size: "M" } },
      loser: { customFields: { shirt_size: "L" } },
      definitions: [SHIRT],
    });
    expect(Object.values(mergedCustomFields(p, { shirt_size: "" }))).not.toContain("");
  });

  it("only offers the two values in play", () => {
    // The commit re-checks every posted choice against the freshly derived plan,
    // the same discipline savePayment applies to start_term — otherwise the form
    // writes arbitrary strings into custom_fields, past the option list.
    const field = plan({
      survivor: { customFields: { shirt_size: "M" } },
      loser: { customFields: { shirt_size: "L" } },
      definitions: [SHIRT],
    }).conflicts[0];

    expect(isOfferedChoice(field, "M")).toBe(true);
    expect(isOfferedChoice(field, "L")).toBe(true);
    expect(isOfferedChoice(field, "XL")).toBe(false);
    expect(isOfferedChoice(field, "'; drop table members --")).toBe(false);
  });

  it("takes the earlier joined_at, whichever side it is on", () => {
    const early = "2026-08-01T12:00:00.000Z";
    const late = "2026-09-01T12:00:00.000Z";
    expect(plan({ survivor: { joinedAt: late }, loser: { joinedAt: early } }).joinedAt).toBe(early);
    expect(plan({ survivor: { joinedAt: early }, loser: { joinedAt: late } }).joinedAt).toBe(early);
  });
});

describe("mergeNotes", () => {
  it("keeps both, never overwrites", () => {
    expect(mergeNotes("Officer note A", "Officer note B")).toBe(
      "Officer note A\n\nOfficer note B"
    );
  });

  it("collapses the empty and identical cases", () => {
    expect(mergeNotes(null, null)).toBeNull();
    expect(mergeNotes("  ", "")).toBeNull();
    expect(mergeNotes(null, "only theirs")).toBe("only theirs");
    expect(mergeNotes("only mine", null)).toBe("only mine");
    expect(mergeNotes("same", "same")).toBe("same");
  });
});

// ---------------------------------------------------------------------------
// The ranker
// ---------------------------------------------------------------------------

function candidate(
  fullName: string,
  email: string,
  eid: string,
  active = true
): MemberCandidate {
  return {
    id: eid,
    fullName,
    email,
    eid,
    normalizedEid: eid.toLowerCase().replace(/[\s-]/g, ""),
    active,
  };
}

const SUBJECT = member({ id: "al1815" });

function rank(...roster: MemberCandidate[]) {
  return rankDuplicateCandidates(SUBJECT, roster).map((s) => s.member.id);
}

describe("rankDuplicateCandidates", () => {
  it("does not reuse the submission floor", () => {
    // 🪤 The recalibration, asserted rather than described. Between two MEMBERS
    // email_exact and id_exact are impossible — members_email_lower and
    // members_normalized_eid are unique indexes — so the two +100 signals the
    // submission weights were built around can never fire, and 25 stops meaning
    // "corroboration required".
    expect(MIN_DUPLICATE_SCORE).toBeGreaterThan(MIN_SUGGESTION_SCORE);
    expect(MIN_DUPLICATE_AXES).toBe(2);
  });

  it("never suggests the member themselves", () => {
    expect(rank(candidate("Ada Lovelace", "ada@example.edu", "al1815"))).toEqual([]);
  });

  // The measured table on MIN_DUPLICATE_SCORE, as assertions. Duplicates score
  // 65+ on two axes; every different-person shape tops out at 50.
  it.each([
    ["same name, EID one character out", candidate("Ada Lovelace", "other@example.edu", "al1816")],
    ["same name, same email local part", candidate("Ada Lovelace", "ada@utexas.edu", "zz9999")],
    ["name typo AND EID typo", candidate("Ada Lovelice", "a.love@example.edu", "al1816")],
    ["same name, EID two characters out", candidate("Ada Lovelace", "other@example.edu", "al1837")],
  ])("suggests a duplicate: %s", (_label, dup) => {
    expect(rank(dup)).toEqual([dup.id]);
  });

  it.each([
    ["siblings — shared surname", candidate("Grace Lovelace", "grace@example.edu", "gl4021")],
    ["same initials, adjacent EID", candidate("Alan Lin", "alan@example.edu", "al1816x")],
    ["shared first name only", candidate("Ada Byron", "byron@example.edu", "ab7742")],
    ["shared surname + EID two out", candidate("Grace Lovelace", "grace@example.edu", "al1837")],
    ["same name, nothing else in common", candidate("Ada Lovelace", "totally@other.edu", "zq4417")],
    ["unrelated", candidate("Zane Okonkwo", "zane@example.edu", "zo5236")],
  ])("does not suggest a different person: %s", (_label, other) => {
    expect(rank(other)).toEqual([]);
  });

  it("offers an inactive duplicate, which is the common case", () => {
    // A ghost is usually the half somebody switched off, because that was the
    // only thing they could do before this phase existed. The `inactive` penalty
    // is -20, so a real duplicate still clears the floor.
    const ghost = candidate("Ada Lovelace", "ada.l@example.edu", "al1816", false);
    expect(rank(ghost)).toEqual([ghost.id]);
  });

  it("ranks the strongest first", () => {
    const weaker = candidate("Ada Lovelace", "other@example.edu", "al1837");
    const stronger = candidate("Ada Lovelace", "ada@utexas.edu", "zz9999");
    expect(rank(weaker, stronger)).toEqual([stronger.id, weaker.id]);
  });
});

describe("the walkthrough's two UI findings", () => {
  it("audits joined_at, which a merge changes", () => {
    // 🐛 A merge takes the EARLIER of the two joined dates, so it writes the
    // column — and before this the trail showed only notes and custom_fields
    // moving. §4.2 asks a mutation to record what it changed.
    expect(AUDITED_MEMBER_COLUMNS).toContain("joined_at");
  });

  it("keeps the member picker outside the form React resets", () => {
    // 🐛 React 19 resets a `<form action={…}>` when the action resolves, and
    // form.reset() snaps a <select> to its first option without re-rendering —
    // so the picker read "Choose a member…" above a preview for a specific
    // member. A SOURCE assertion because vitest runs `environment: "node"` and
    // cannot render a component, the same guard member-filters.tsx carries.
    const source = readFileSync(
      "app/admin/(shell)/members/[id]/_components/merge-panel.tsx",
      "utf8"
    );
    // The id reaches the action as a hidden input, never as a named <select>.
    expect(source).toContain('<input type="hidden" name="loserId"');
    expect(source).not.toMatch(/<select\s+name="loserId"/);
  });
});

describe("matchAxisCount", () => {
  it("counts distinct identities, not reasons", () => {
    expect(
      matchAxisCount([
        { kind: "name_tokens", shared: ["lovelace"] },
        { kind: "name_near", distance: 1 },
      ])
    ).toBe(1);
    expect(
      matchAxisCount([
        { kind: "name_exact" },
        { kind: "id_near_miss", distance: 1 },
      ])
    ).toBe(2);
  });

  it("does not count the inactive penalty as agreement", () => {
    expect(matchAxisCount([{ kind: "name_exact" }, { kind: "inactive" }])).toBe(1);
  });
});
