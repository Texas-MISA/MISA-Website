import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The member pages moved under /portal (docs/member-portal-plan.md, phase 1).
  //
  // 🔓 **PERMANENT, and never to be deleted.** Printed QR codes, group-chat
  // links and bookmarks all point at the old paths, and none of them can be
  // updated — deleting an entry strands every one of them on a 404.
  // tests/portal.test.ts asserts all three.
  //
  // `permanent: true` answers 308, which keeps the request method, and the
  // query string passes through (`/attend?x=1` → `/portal/attend?x=1`). These
  // run before proxy.ts and before the filesystem. 🪤 A member with the OLD
  // /attend already open when a deploy lands still fails the way they would on
  // any deploy — their Server Action id belongs to the previous build — so the
  // rule is unchanged: don't deploy during an event.
  async redirects() {
    return [
      { source: "/attend", destination: "/portal/attend", permanent: true },
      {
        source: "/leaderboard",
        destination: "/portal/leaderboard",
        permanent: true,
      },
      { source: "/lookup", destination: "/portal/lookup", permanent: true },
    ];
  },
};

export default nextConfig;
