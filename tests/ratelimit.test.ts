import { afterAll, describe, expect, it } from "vitest";

import {
  checkRateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MINUTES,
} from "@/lib/checkin";

import { testClient } from "./helpers";

// checkin_throttle behaviour with injected timestamps. Hashes here are just
// opaque strings to the limiter; each test uses a unique one so runs and
// leftovers can't interfere.

const db = testClient();
const usedHashes: string[] = [];

function testHash(): string {
  const h = `test-hash-${crypto.randomUUID()}`;
  usedHashes.push(h);
  return h;
}

afterAll(async () => {
  await db.from("checkin_throttle").delete().in("ip_hash", usedHashes);
});

const NOW = new Date("2030-06-01T12:00:00Z");
const MINUTE = 60 * 1000;

describe("rate limiting", () => {
  it("allows up to the limit, then blocks inside the window", async () => {
    const hash = testHash();

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const result = await checkRateLimit(db, hash, new Date(NOW.getTime() + i * 1000));
      expect(result).toBe("ok");
    }

    const blocked = await checkRateLimit(
      db,
      hash,
      new Date(NOW.getTime() + RATE_LIMIT_MAX * 1000)
    );
    expect(blocked).toBe("limited");
  });

  it("a full window later, the same hash is allowed again", async () => {
    const hash = testHash();

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await checkRateLimit(db, hash, NOW);
    }
    expect(await checkRateLimit(db, hash, NOW)).toBe("limited");

    const later = new Date(
      NOW.getTime() + (RATE_LIMIT_WINDOW_MINUTES + 1) * MINUTE
    );
    expect(await checkRateLimit(db, hash, later)).toBe("ok");
  });

  it("does not throttle a different hash", async () => {
    const noisy = testHash();
    const quiet = testHash();

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await checkRateLimit(db, noisy, NOW);
    }
    expect(await checkRateLimit(db, noisy, NOW)).toBe("limited");
    expect(await checkRateLimit(db, quiet, NOW)).toBe("ok");
  });

  it("prunes rows older than an hour", async () => {
    const hash = testHash();
    const old = new Date(NOW.getTime() - 2 * 60 * MINUTE);

    const seeded = await db
      .from("checkin_throttle")
      .insert({ ip_hash: hash, submitted_at: old.toISOString() });
    expect(seeded.error).toBeNull();

    // Any call prunes opportunistically.
    await checkRateLimit(db, testHash(), NOW);

    const { count } = await db
      .from("checkin_throttle")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", hash);
    expect(count).toBe(0);
  });
});
