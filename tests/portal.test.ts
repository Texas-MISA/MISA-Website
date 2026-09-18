import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

// The member portal (docs/member-portal-plan.md, phase 1). Pure: no database.
//
// /attend, /leaderboard and /lookup moved under /portal, and the old paths are
// permanent redirects rather than routes. Nothing else in the suite would notice
// one going missing — docs.test.ts walks page.tsx and route.ts, and a redirect
// is neither — so the first sign would be a member at an event scanning a
// printed QR code and landing on a 404.

describe("member portal redirects", () => {
  it("keeps every pre-portal URL as a permanent redirect", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/attend", destination: "/portal/attend", permanent: true },
        {
          source: "/leaderboard",
          destination: "/portal/leaderboard",
          permanent: true,
        },
        { source: "/lookup", destination: "/portal/lookup", permanent: true },
      ])
    );
  });
});
