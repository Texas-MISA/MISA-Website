import { describe, expect, it } from "vitest";

import {
  CAMPUS_V4,
  CAMPUS_V6,
  CELLULAR_V4,
  CELLULAR_V6,
} from "@/lib/network-prefixes.generated";
import {
  classifyNetwork,
  NETWORK_TABLE_VERIFIED,
  normalizeOrigin,
} from "@/lib/network-classify";

// The check-in origin classifier (docs/checkin-location-verification.md).
//
// Pure and offline: the prefix table is a committed generated file, so these
// tests never touch the network and never need the local stack. The addresses
// below are chosen from the table's own contents rather than typed from
// memory, so the suite keeps passing across a regeneration — asserting a
// literal carrier address would fail the day a carrier returns a block.

const asDotted = (n: number) =>
  `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;

describe("the committed table", () => {
  it("carries a generation date", () => {
    expect(NETWORK_TABLE_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has campus and cellular IPv4 data, or the classifier means nothing", () => {
    expect(CAMPUS_V4.length).toBeGreaterThan(0);
    expect(CELLULAR_V4.length).toBeGreaterThan(0);
  });

  it("is sorted, disjoint and paired in every table", () => {
    for (const flat of [CAMPUS_V4, CELLULAR_V4]) {
      expect(flat.length % 2).toBe(0);
      for (let i = 0; i < flat.length; i += 2) {
        expect(flat[i]).toBeLessThanOrEqual(flat[i + 1]);
        if (i > 0) expect(flat[i - 1]).toBeLessThan(flat[i]);
      }
    }
    for (const flat of [CAMPUS_V6, CELLULAR_V6]) {
      expect(flat.length % 2).toBe(0);
      for (let i = 0; i < flat.length; i += 2) {
        expect(flat[i] <= flat[i + 1]).toBe(true);
        if (i > 0) expect(flat[i - 1] < flat[i]).toBe(true);
      }
    }
  });
});

describe("classifyNetwork — boundaries", () => {
  // Every range's own edges, and the address immediately outside each. This is
  // the test that catches an off-by-one in the binary search, which would
  // otherwise misclassify exactly the people at the edge of campus space.
  it("matches campus at both edges of every range and not one step outside", () => {
    for (let i = 0; i < CAMPUS_V4.length; i += 2) {
      const start = CAMPUS_V4[i];
      const end = CAMPUS_V4[i + 1];
      expect(classifyNetwork(asDotted(start))).toBe("campus");
      expect(classifyNetwork(asDotted(end))).toBe("campus");
      expect(classifyNetwork(asDotted(start - 1))).not.toBe("campus");
      expect(classifyNetwork(asDotted(end + 1))).not.toBe("campus");
    }
  });

  it("matches cellular at the first range's edges", () => {
    const start = CELLULAR_V4[0];
    const end = CELLULAR_V4[1];
    expect(classifyNetwork(asDotted(start))).toBe("cellular");
    expect(classifyNetwork(asDotted(end))).toBe("cellular");
  });

  it("reads a known-campus address as campus", () => {
    // 128.83.0.0/16 is UT's, and has been since long before this repo.
    expect(classifyNetwork("128.83.140.7")).toBe("campus");
    expect(classifyNetwork("146.6.1.1")).toBe("campus");
  });

  it("reads ordinary public space as other", () => {
    // Cloudflare and Google resolvers: emphatically neither UT nor a carrier.
    expect(classifyNetwork("1.1.1.1")).toBe("other");
    expect(classifyNetwork("8.8.8.8")).toBe("other");
  });
});

describe("classifyNetwork — the unknown state", () => {
  it("returns unknown for a missing address rather than guessing", () => {
    expect(classifyNetwork(null)).toBe("unknown");
    expect(classifyNetwork(undefined)).toBe("unknown");
    expect(classifyNetwork("")).toBe("unknown");
    expect(classifyNetwork("   ")).toBe("unknown");
  });

  it("returns unknown for anything unparseable", () => {
    for (const bad of [
      "not-an-ip",
      "999.1.1.1",
      "1.2.3",
      "1.2.3.4.5",
      "1.2.3.-1",
      "::ffff:999.1.1.1",
      "1::2::3",
      "gggg::1",
      "12345::1",
    ]) {
      expect(classifyNetwork(bad)).toBe("unknown");
    }
  });

  it("rejects leading zeros, which have no single meaning", () => {
    expect(classifyNetwork("128.083.0.1")).toBe("unknown");
    expect(classifyNetwork("010.1.1.1")).toBe("unknown");
  });

  // 🔓 The rule that keeps the flag honest. CAMPUS_V6 is empty today, so an
  // IPv6 address matching nothing does NOT mean "off campus" — it means the
  // table cannot speak to it. Calling that `other` would flag a member sitting
  // in the room.
  it("never reports a non-cellular IPv6 address as other while CAMPUS_V6 is empty", () => {
    if (CAMPUS_V6.length > 0) return; // self-corrects once UT's v6 is added
    expect(classifyNetwork("2606:4700:4700::1111")).toBe("unknown");
    expect(classifyNetwork("2001:db8::1")).toBe("unknown");
  });

  it("still exempts cellular over IPv6, which is checked before that rule", () => {
    const start = CELLULAR_V6[0];
    const groups: string[] = [];
    for (let shift = 112n; shift >= 0n; shift -= 16n) {
      groups.push(((start >> shift) & 0xffffn).toString(16));
    }
    expect(classifyNetwork(groups.join(":"))).toBe("cellular");
  });
});

describe("classifyNetwork — address forms", () => {
  it("folds an IPv4-mapped IPv6 address to its IPv4 meaning", () => {
    // 🪤 The trap this exists for: a dual-stack listener can present the same
    // phone either way, and an unmapped comparison silently reads every
    // v4-over-v6 client as `other` — i.e. flags them.
    expect(classifyNetwork("::ffff:128.83.140.7")).toBe("campus");
    expect(classifyNetwork("::FFFF:128.83.140.7")).toBe("campus");
    expect(classifyNetwork("::ffff:1.1.1.1")).toBe("other");
  });

  // 🪤 The spelling a text-matching implementation misses. `::ffff:a.b.c.d` and
  // `0:0:0:0:0:ffff:a.b.c.d` are the SAME address; folding only the compressed
  // one gives one client two digests and drops it out of its own venue mode.
  it("folds the uncompressed IPv4-mapped form too", () => {
    expect(classifyNetwork("0:0:0:0:0:ffff:128.83.140.7")).toBe("campus");
    expect(normalizeOrigin("0:0:0:0:0:ffff:128.83.140.7")).toBe(
      normalizeOrigin("128.83.140.7")
    );
    // ...and the mapped range is not confused with an ordinary v6 address that
    // merely ends in the same bits.
    expect(normalizeOrigin("::0.0.255.255")?.startsWith("v6:")).toBe(true);
  });

  it("strips brackets a proxy may add around IPv6", () => {
    expect(classifyNetwork("[::ffff:128.83.140.7]")).toBe("campus");
  });

  it("tolerates surrounding whitespace", () => {
    expect(classifyNetwork("  128.83.140.7  ")).toBe("campus");
  });
});

describe("normalizeOrigin", () => {
  it("gives one digest input for the two forms of one address", () => {
    // The property that matters: the same client must not read as two origins
    // and quietly fall out of the mode it belongs to.
    expect(normalizeOrigin("::ffff:128.83.140.7")).toBe(normalizeOrigin("128.83.140.7"));
  });

  it("re-renders rather than passing the input through", () => {
    expect(normalizeOrigin(" 128.83.140.7 ")).toBe("v4:128.83.140.7");
  });

  it("folds IPv6 to its /64, so rotating low bits are one origin", () => {
    const a = normalizeOrigin("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = normalizeOrigin("2001:db8:1:2:1111:2222:3333:4444");
    expect(a).toBe(b);
    expect(a).toBe("v6:2001:db8:1:2");
  });

  it("keeps distinct /64s distinct", () => {
    expect(normalizeOrigin("2001:db8:1:2::1")).not.toBe(
      normalizeOrigin("2001:db8:1:3::1")
    );
  });

  it("cannot collide a v4 and a v6 address", () => {
    expect(normalizeOrigin("1.2.3.4")?.startsWith("v4:")).toBe(true);
    expect(normalizeOrigin("2001:db8::1")?.startsWith("v6:")).toBe(true);
  });

  it("returns null when there is nothing hashable", () => {
    // 🪤 Load-bearing: capture must write NO digest rather than hashing the
    // literal string "unknown". In local dev nobody has the header, so a shared
    // literal would give every check-in one digest and form a confident,
    // entirely fictional venue mode.
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("not-an-ip")).toBeNull();
  });

  it("agrees with classifyNetwork about what is parseable", () => {
    // The migration's checkin_origin_unknown_has_no_digest constraint depends
    // on this: an `unknown` kind must never arrive with a digest beside it.
    for (const raw of ["1.2.3.4", "128.83.140.7", "2001:db8::1", "not-an-ip", "", null]) {
      const kind = classifyNetwork(raw);
      const digest = normalizeOrigin(raw);
      if (digest === null) expect(kind).toBe("unknown");
    }
  });
});

describe("the embedded-IPv4 general form", () => {
  it("parses a dotted quad inside a non-mapped IPv6 literal", () => {
    // 2001:db8::192.0.2.1 is a legal address, not only ::ffff: is.
    expect(normalizeOrigin("2001:db8::192.0.2.1")).toBe("v6:2001:db8:0:0");
  });
});
