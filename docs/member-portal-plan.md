# Member portal plan

> 📋 **NOT BUILT.** Written 2026-09-18. **Rollback point:** the tag `pre-portal-2026-09-18` (commit `ce5bda7`), which is production as of that date.
> **Current goal: phase 1 only.** Phases 2–4 (houses and bingo) are **on hold** until the officer has more information about how the house system works.

## Goal
Group every member-facing tool under `txmisa.org/portal`. Members don't need an account for any of it. The marketing site keeps its current routes, and **`/admin` stays exactly where it is.**

## Decisions (officer, 2026-09-18)
- The portal holds the member tools: check-in, leaderboard, lookup, and later house bingo. The only login is the existing officer one.
- **`/admin` stays separate.** It's a different audience with real auth: the `proxy.ts` matcher, `/admin/login`, `next=` redirects and `revalidatePath` calls all assume that path. The portal links to it; it doesn't contain it. `/officer-invite/[token]` doesn't move either.
- **Only officers edit house bingo.** Members watch it update live.
- **Live means polling, not Supabase Realtime.** The view re-reads on the server every 5–10 seconds (`router.refresh()` on an interval). No table gets a new anon grant, and all reads stay server-side.

---

## Phase 1 — move the existing member pages into `/portal`

### Scope
**This is a pure move plus a hub page.** No page's behaviour, copy, or database access changes. There are **no migrations** and **no new environment variables**, so a rollback is only a code revert. It must deploy to production and work there on its own.

**Out of scope (deliberately):**
- **The v2 phase 3 visual redesign and the `--misa-muted` AA fix.** They stay a separate, later change. Keeping them out means that if this move needs reverting, no design work goes with it.
- **Anything to do with houses or bingo.**

### Where the files go
The portal nests **inside the `(public)` route group**, so it inherits the site header, footer, skip link, `RevealObserver`, `error.tsx` and `not-found.tsx` with no new chrome to build or break.

```
app/(public)/portal/page.tsx                 NEW  hub
app/(public)/portal/attend/                  git mv from app/(public)/attend/      (page + _components)
app/(public)/portal/leaderboard/page.tsx     git mv from app/(public)/leaderboard/
app/(public)/portal/lookup/                  git mv from app/(public)/lookup/      (page + _components)
```
- **Use `git mv`** so history follows the files.
- The pages import `./_components/...` relatively and everything else through `@/`, so **no imports change.**
- **No `portal/layout.tsx` in phase 1.** One can be added later when the portal gets its own chrome.
- **Don't add a layout-level `robots`.** `/attend` is currently *indexable* and `/leaderboard` and `/lookup` are not. Each page keeps its own `metadata` exactly as it is.

### The hub: `app/(public)/portal/page.tsx`
- A Server Component, static (no data reads), built with existing primitives (`PageHero`, `Section`, link cards/`Button`). Nothing is hand-rolled.
- Three destinations with one line each: **Check In** → `/portal/attend`, **Leaderboard** → `/portal/leaderboard`, **My Attendance** → `/portal/lookup`.
- A small "Officers: sign in" link to `/admin/login`. This is a link only, not an embed.
- `metadata`: title "Member Portal". Robots: **noindex** (the hub has no content worth indexing, and it keeps the member area out of search). Confirm this with the officer during review.
- **No `data-reveal`** is needed. If one is used, it goes only on server-rendered markup.

### Redirects: `next.config.ts`
```ts
async redirects() {
  return [
    { source: "/attend",      destination: "/portal/attend",      permanent: true },
    { source: "/leaderboard", destination: "/portal/leaderboard", permanent: true },
    { source: "/lookup",      destination: "/portal/lookup",      permanent: true },
  ];
}
```
- **These are permanent.** Printed QR codes, group-chat links and bookmarks all point at `/attend`. Never delete these redirects.
- **Query strings are passed through by default,** so `/attend?x=1` becomes `/portal/attend?x=1`. Verify this with curl.
- Read `node_modules/next/dist/docs/` on `redirects` before writing this, because this is Next 16 (per AGENTS.md).
- 🪤 **Server Actions during the deploy:** a member with the *old* `/attend` open when the deploy lands will POST to `/attend`. A 308 keeps the method, but the action ID from the old build is already invalid after any deploy. That's the same failure mode as every deploy today, not a new one. **Don't deploy during an event.**

### References to update
These were found by grep. Re-run the grep before and after the move, because the list is only as good as the grep.

| File | Change |
|---|---|
| `components/site-header.tsx` | `MEMBER_NAV` (Leaderboard, My Attendance) and the "Check In" CTA/`MOBILE_NAV` entry. **Recommended:** replace the two `MEMBER_NAV` items with one **"Portal"** item (`/portal`), and point the **Check In** button at `/portal/attend`. Mobile gets Portal + Check In. Fix `isActive`, which uses `pathname === href`, so that "Portal" is active on any `/portal/*` page. **Re-measure nav clearance at 1280** (`DESIGN.md` §Nav clearance). Going from 2 items to 1 should only *gain* space, but record the number. |
| `components/ui/recovery-nav.tsx` | `/attend`, `/leaderboard`, `/lookup` → the `/portal/*` paths. Consider adding "Member Portal". |
| `app/admin/login/page.tsx:37-40` | The `href` and the visible text `/attend` → `/portal/attend`. |
| `app/(public)/attend/_components/checkin-form.tsx:366` | The link to `/lookup`. |
| `app/(public)/lookup/page.tsx:53` | The link to `/leaderboard`. |
| `app/(public)/leaderboard/page.tsx:242` | The link to `/lookup`. |
| `tests/lookup.test.ts:460, 476` | File paths `app/(public)/lookup/...` and `app/(public)/leaderboard/page.tsx` → the new locations. **Keep the noindex assertion.** |
| `app/(public)/officer-invite/[token]/_components/invite-form.tsx:15` | A comment naming the `lookup-form.tsx` path. Update it. |
| Code comments saying "/attend", "/lookup" and so on | Leave them. They name the feature, not a URL. Change a comment only where it names a **file path**. |

**Not affected (checked):**
- Rate-limit buckets are keyed by name (`hashClientIp("lookup")`, `"checkin"`), not by path.
- There is no `revalidatePath` for any of the three pages, and the leaderboard is `force-dynamic` with a comment forbidding one.
- There's no `sitemap.ts`/`robots.ts`, and no `/attend` URL is built in code (no QR generator).
- `proxy.ts` matches `/admin/:path*` only.
- The Server Actions (`app/actions/attendance.ts`, `app/actions/lookup.ts`) live outside the route folders.

### Docs that must change in the same PR
- **`docs/student-org-website-architecture.md` §5 routes table.** `tests/docs.test.ts` fails if any route directory is missing from §5, so `/portal`, `/portal/attend`, `/portal/leaderboard` and `/portal/lookup` **must** be added, and the old three marked as 308 redirects. Bump the version header (v1.81) with a short changelog entry.
- `docs/layout.md`: the new file locations.
- `CLAUDE.md` and `DESIGN.md`: any mention of `app/(public)/attend` etc. *as a path*.
- `docs/frontend-redesign-v2-plan.md`: add a note that phase 3's pages now live under `/portal`.
- `tasks.md` and `docs/build-log.md`: record the move. ⚠️ `tasks.md` and two other docs have **uncommitted edits already**. Check with the officer before committing over them.

### Rollout
1. Branch `portal-phase-1` from `main`. Do the work, and run `npm run lint`, `npm run build` and `npm test` locally (Docker plus `npx supabase start`).
2. Local walkthrough on the dev server, **pinned to local** (check the `Environments:` banner). Do a real check-in, a lookup, and view the leaderboard at both `/portal/*` and the old URLs.
3. `git push origin portal-phase-1` for a **Vercel preview URL**. Repeat the walkthrough there, including the redirects via curl.
4. With the officer's go-ahead, merge to `main`, **not on an event day**. Then smoke-test production: `curl -sI https://www.txmisa.org/attend` should return `308` and `location: /portal/attend`, and all three pages should load.
5. **Rollback, if needed:** Vercel **Instant Rollback** to the `ce5bda7` deployment (seconds, no rebuild), then `git revert` the merge on `main`. There's no migration, so nothing on the database side needs undoing.

### Verification checklist
- [ ] `/portal`, `/portal/attend`, `/portal/leaderboard` and `/portal/lookup` return 200.
- [ ] `/attend`, `/leaderboard` and `/lookup` return **308** to the new paths, **with the query string preserved**.
- [ ] A real check-in on `/portal/attend` succeeds locally and on the preview. The first-time confirmation step still works.
- [ ] A lookup by EID works, and the rate limit still applies.
- [ ] The leaderboard and lookup HTML still contain `noindex`. The attend page's robots are unchanged.
- [ ] The header's Portal item is active on `/portal/*`, Check In goes to `/portal/attend`, and the mobile sheet has no duplicate keys.
- [ ] 404 recovery links point at the live paths.
- [ ] `/admin`, `/admin/login` and `/officer-invite/<token>` are unchanged.
- [ ] `npm test` (including `docs.test.ts` §5 and `security.test.ts`), `npm run build` and `npm run lint` are all green.
- [ ] `grep -rnE '"/(attend|leaderboard|lookup)"' app components lib tests` returns nothing.

---

## Later phases (ON HOLD — waiting on the house system details)
2. **Houses data.** New migration(s): houses, member↔house assignment, bingo cards and squares, and marks. Deny-all RLS with no anon grant. Add the tables to `wipe-remote.sh`, regenerate the types, and push the migration **before** the code that reads it.
3. **Officer editing.** Screens under `app/admin/(shell)/houses`. Each action starts with `getOfficer()` and writes an `admin_audit` row.
4. **Member view.** `/portal/houses` reads server-side and polls. No EID or email reaches the page. Polled squares never carry `data-reveal`.

### Open questions for phase 2
- What goes in a square? Are cards the same for every house or different per house?
- When does a card reset: per term, per event, or by hand?
- Are house assignments per term? Is a member ever in no house, or in two?
- What does the member view show: all houses side by side, or one house at a time?

## Invariants to carry over (all phases)
- The leaderboard stays `force-dynamic` and noindex; never `revalidatePath` on it.
- `/attend` keeps its check-in, origin-capture and disclosure behaviour unchanged.
- No `data-reveal` on nodes that mount after first paint.
- No unauthenticated route returns an email or EID. `tests/security.test.ts` still allows only `leaderboard` for anon.
