import { describe, expect, it } from "vitest";

import {
  buildOriginRecord,
  deriveOriginFlag,
  establishVenueOrigin,
  isFlaggedOrigin,
  ORIGIN_FLAG_LABEL,
  originDigest,
  withinCheckinWindow,
  VENUE_MIN_COUNT,
  VENUE_MIN_SHARE,
  type OriginFlag,
  type OriginFlagInput,
  type OriginRecord,
  type VenueOrigin,
} from "@/lib/checkin-origin";

// The venue mode and the flag derivation (docs/checkin-location-verification.md).
//
// Pure and offline. vitest.config.ts loads .env.local, so CHECKIN_ORIGIN_PEPPER
// may or may not be present here — every assertion below is written to hold
// either way, and the digest tests skip themselves rather than pretending.

const PEPPERED = originDigest("event-1", "1.2.3.4") !== null;

// 🪤 Six cases below are gated on PEPPERED. vitest.config.ts sets the pepper,
// so they run — but if that config line is ever removed they would all skip
// SILENTLY and the suite would still report green. An unasserted fixture is an
// optional fixture; this makes the gate itself the thing that fails.
it("has a pepper configured, or six assertions below are vacuous", () => {
  expect(PEPPERED).toBe(true);
});

const record = (
  originHash: string | null,
  networkType: OriginRecord["networkType"] = "campus"
): OriginRecord => ({ originHash, networkType });

const many = (n: number, r: OriginRecord) => Array.from({ length: n }, () => r);

describe("originDigest", () => {
  it.runIf(PEPPERED)("is stable for one address at one event", () => {
    expect(originDigest("event-1", "1.2.3.4")).toBe(originDigest("event-1", "1.2.3.4"));
  });

  // 🔓 The property that makes storing these acceptable at all: the table
  // cannot be used to trace where a member was over a semester.
  it.runIf(PEPPERED)("gives UNRELATED digests for one address at two events", () => {
    expect(originDigest("event-1", "1.2.3.4")).not.toBe(originDigest("event-2", "1.2.3.4"));
  });

  it.runIf(PEPPERED)("separates two addresses at one event", () => {
    expect(originDigest("event-1", "1.2.3.4")).not.toBe(originDigest("event-1", "1.2.3.5"));
  });

  it.runIf(PEPPERED)("folds the two forms of one address together", () => {
    expect(originDigest("event-1", "::ffff:1.2.3.4")).toBe(originDigest("event-1", "1.2.3.4"));
  });

  it.runIf(PEPPERED)("folds IPv6 to its /64, so rotating low bits are one origin", () => {
    expect(originDigest("e", "2001:db8:1:2:aaaa::1")).toBe(
      originDigest("e", "2001:db8:1:2:bbbb::9")
    );
  });

  // 🪤 Never a digest of the literal string. In local dev nobody has the
  // header, so a shared literal would give every check-in one digest and form a
  // confident, entirely fictional venue mode.
  it("returns null rather than hashing a missing or unparseable address", () => {
    expect(originDigest("event-1", null)).toBeNull();
    expect(originDigest("event-1", "")).toBeNull();
    expect(originDigest("event-1", "not-an-ip")).toBeNull();
  });

  it("never returns a digest that looks like an address", () => {
    const digest = originDigest("event-1", "128.83.140.7");
    if (digest === null) return;
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });
});

describe("buildOriginRecord", () => {
  it("records a kind but NO digest for a pending orphan", () => {
    // There is no event_id to hash with — but the kind still tells an officer
    // who later assigns the row whether the submitter was on campus.
    const row = buildOriginRecord(null, "128.83.140.7");
    expect(row.originHash).toBeNull();
    expect(row.networkType).toBe("campus");
  });

  it.runIf(PEPPERED)("records both for a resolved check-in", () => {
    const row = buildOriginRecord("event-1", "128.83.140.7");
    expect(row.originHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.networkType).toBe("campus");
  });

  // 🔓 The invariant the migration's CHECK constraint mirrors. An unknown kind
  // with a digest beside it would fall through the derivation to "off-network"
  // and flag someone on the strength of a gap in a table.
  it("never pairs an unknown kind with a digest", () => {
    for (const ip of [null, "", "not-an-ip", "2001:db8::1", "128.83.140.7", "1.1.1.1"]) {
      const row = buildOriginRecord("event-1", ip);
      if (row.networkType === "unknown") expect(row.originHash).toBeNull();
    }
  });

  it("holds that invariant for a parseable address the table cannot speak to", () => {
    // The case belt-and-braces would miss: this address parses perfectly, so a
    // "digest whatever parses" rule would store one beside an unknown kind.
    const row = buildOriginRecord("event-1", "2001:db8::1");
    if (row.networkType === "unknown") expect(row.originHash).toBeNull();
  });
});

describe("establishVenueOrigin", () => {
  it("finds a clear majority", () => {
    const venue = establishVenueOrigin([
      ...many(8, record("venue")),
      record("elsewhere"),
      record("elsewhere-2"),
    ]);
    expect(venue.status).toBe("established");
    if (venue.status === "established") {
      expect(venue.originHash).toBe("venue");
      expect(venue.count).toBe(8);
      expect(venue.considered).toBe(10);
    }
  });

  it("declines below VENUE_MIN_COUNT even at a 100% share", () => {
    const venue = establishVenueOrigin(many(VENUE_MIN_COUNT - 1, record("venue")));
    expect(venue.status).toBe("no_quorum");
  });

  it("accepts exactly VENUE_MIN_COUNT at a full share", () => {
    expect(establishVenueOrigin(many(VENUE_MIN_COUNT, record("venue"))).status).toBe(
      "established"
    );
  });

  it("declines below VENUE_MIN_SHARE even with plenty of rows", () => {
    // 6 at the venue out of 20 clears the count and fails the share.
    const venue = establishVenueOrigin([
      ...many(6, record("venue")),
      ...Array.from({ length: 14 }, (_, i) => record(`other-${i}`)),
    ]);
    expect(venue.status).toBe("no_quorum");
    expect(VENUE_MIN_SHARE).toBeGreaterThan(6 / 20);
  });

  // 🪤 Two origins at the same top count both clear a 0.5 share, and picking
  // either would make the answer depend on iteration order rather than the room.
  it("refuses a tie rather than picking one", () => {
    const venue = establishVenueOrigin([...many(5, record("a")), ...many(5, record("b"))]);
    expect(venue.status).toBe("ambiguous");
  });

  it("has no venue at all when there are no rows", () => {
    expect(establishVenueOrigin([]).status).toBe("no_quorum");
  });

  // 🪤 Cellular leaves BOTH the groups and the denominator.
  it("never lets a tethered hotspot become the venue", () => {
    const venue = establishVenueOrigin(many(9, record("hotspot", "cellular")));
    expect(venue.status).toBe("no_quorum");
    if (venue.status === "no_quorum") expect(venue.considered).toBe(0);
  });

  it("does not let cellular rows dilute a real venue below quorum", () => {
    // 6 in the room, 14 on phones. Counting phones would give 6/20 = 0.3 and
    // lose a venue the event actually had.
    const venue = establishVenueOrigin([
      ...many(6, record("venue")),
      ...many(14, record("phone", "cellular")),
    ]);
    expect(venue.status).toBe("established");
    if (venue.status === "established") expect(venue.considered).toBe(6);
  });

  it("ignores rows carrying no digest", () => {
    const venue = establishVenueOrigin([
      ...many(5, record("venue")),
      ...many(9, record(null, "unknown")),
    ]);
    expect(venue.status).toBe("established");
    if (venue.status === "established") expect(venue.considered).toBe(5);
  });
});

describe("deriveOriginFlag", () => {
  const venue: VenueOrigin = {
    status: "established",
    originHash: "venue",
    count: 9,
    considered: 10,
  };
  const noVenue: VenueOrigin = { status: "no_quorum", considered: 2, topCount: 2 };

  /** A self check-in, which is the case every assertion below is about. */
  const flag = (
    record: OriginRecord | null | undefined,
    v: VenueOrigin = venue,
    over: Partial<OriginFlagInput> = {}
  ) =>
    deriveOriginFlag({
      record,
      venue: v,
      verifyOrigin: true,
      isSelfCheckin: true,
      ...over,
    });

  it("renders nothing when the event's toggle is off", () => {
    expect(flag(record("anything", "other"), venue, { verifyOrigin: false })).toBe("off");
  });

  // 🪤 The bug this case exists for: capture never runs for admin_manual, so an
  // officer-entered row has no origin BY DESIGN — and without its own state it
  // fell through to `unknown` and badged every walk-in an officer typed in with
  // "Origin unknown", which claims the system tried and failed.
  it("says not_applicable for an officer-entered row, never unknown", () => {
    expect(flag(undefined, venue, { isSelfCheckin: false })).toBe("not_applicable");
    // Even if a row somehow carried an origin, the source still decides.
    expect(flag(record("elsewhere", "other"), venue, { isSelfCheckin: false })).toBe(
      "not_applicable"
    );
  });

  it("lets the toggle outrank the source", () => {
    expect(
      flag(undefined, venue, { isSelfCheckin: false, verifyOrigin: false })
    ).toBe("off");
  });

  it("says unknown, not off-network, when there is no record", () => {
    expect(flag(null)).toBe("unknown");
    expect(flag(undefined)).toBe("unknown");
  });

  // ⚠️ The officer's decision of 2026-08-22, and the largest single source of
  // false positives removed. It outranks both flagged states unconditionally.
  it("never flags cellular, whatever else is true of the row", () => {
    expect(flag(record("elsewhere", "cellular"))).toBe("cellular");
    expect(flag(record(null, "cellular"))).toBe("cellular");
    expect(flag(record("elsewhere", "cellular"), noVenue)).toBe("cellular");
  });

  it("says unknown for a row with a kind but no digest", () => {
    expect(flag(record(null, "campus"))).toBe("unknown");
  });

  it("flags nobody when the event established no origin", () => {
    expect(flag(record("elsewhere", "other"), noVenue)).toBe("no_venue");
    expect(
      flag(record("elsewhere", "other"), {
        status: "ambiguous",
        considered: 10,
        topCount: 5,
      })
    ).toBe("no_venue");
  });

  it("matches the venue", () => {
    expect(flag(record("venue", "campus"))).toBe("at_venue");
    // A venue can legitimately be off-campus — a restaurant's wifi is `other`.
    expect(flag(record("venue", "other"))).toBe("at_venue");
  });

  it("separates elsewhere-on-campus from off-network", () => {
    expect(flag(record("elsewhere", "campus"))).toBe("on_campus");
    expect(flag(record("elsewhere", "other"))).toBe("off_network");
  });

  it("produces every state and only the two flagged ones are flagged", () => {
    const flags: OriginFlag[] = [
      "off",
      "not_applicable",
      "no_venue",
      "unknown",
      "cellular",
      "at_venue",
      "on_campus",
      "off_network",
    ];
    expect(flags.filter(isFlaggedOrigin)).toEqual(["on_campus", "off_network"]);
  });
});

describe("withinCheckinWindow", () => {
  // 🪤 The shapes PostgREST actually returns, and the reason this is a function
  // rather than a `>=` in a page: `submitted_at` carries microseconds and a
  // whole-second `starts_at` carries none, so a string compare is comparing two
  // different formats and only works because "." sorts after "+" in ASCII.
  const OPENS = "2026-08-04T23:00:00+00:00";
  const CLOSES = "2026-08-05T00:00:00+00:00";

  it("includes the opening instant and excludes the closing one", () => {
    expect(withinCheckinWindow(OPENS, OPENS, CLOSES)).toBe(true);
    expect(withinCheckinWindow(CLOSES, OPENS, CLOSES)).toBe(false);
  });

  it("handles a microsecond-bearing submission against whole-second bounds", () => {
    expect(withinCheckinWindow("2026-08-04T23:12:32.506781+00:00", OPENS, CLOSES)).toBe(
      true
    );
    expect(withinCheckinWindow("2026-08-04T22:59:59.999999+00:00", OPENS, CLOSES)).toBe(
      false
    );
    expect(withinCheckinWindow("2026-08-05T00:00:00.000001+00:00", OPENS, CLOSES)).toBe(
      false
    );
  });

  // The case the filter actually exists for: an orphan an officer approved onto
  // the event hours outside its window must not help decide where the venue was.
  it("excludes a submission hours outside the window", () => {
    expect(withinCheckinWindow("2026-08-05T03:30:00+00:00", OPENS, CLOSES)).toBe(false);
    expect(withinCheckinWindow("2026-08-04T19:00:00+00:00", OPENS, CLOSES)).toBe(false);
  });

  it("agrees across offset notations for the same instant", () => {
    // Same instant written as UTC and as Central. If a value ever came back
    // with a non-UTC offset, a string compare would place it wrongly.
    expect(withinCheckinWindow("2026-08-04T18:30:00-05:00", OPENS, CLOSES)).toBe(true);
    expect(withinCheckinWindow("2026-08-04T17:30:00-05:00", OPENS, CLOSES)).toBe(false);
  });

  it("excludes an unparseable timestamp rather than including it", () => {
    expect(withinCheckinWindow("not-a-timestamp", OPENS, CLOSES)).toBe(false);
  });
});

describe("the labels", () => {
  it("covers every flag", () => {
    const flags: OriginFlag[] = [
      "off",
      "no_venue",
      "unknown",
      "cellular",
      "at_venue",
      "on_campus",
      "off_network",
    ];
    for (const flag of flags) {
      expect(ORIGIN_FLAG_LABEL[flag]).toBeTruthy();
    }
  });

  // 🔓 The wording is a design constraint, not copy. A flag is worth a glance
  // at a list, never evidence about a person.
  it("asserts nothing about fraud", () => {
    const forbidden = /fraud|chea|fake|lied|lying|false|suspicious|guilty/i;
    for (const label of Object.values(ORIGIN_FLAG_LABEL)) {
      expect(label).not.toMatch(forbidden);
    }
  });
});
