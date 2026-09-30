# Member portal plan

> ✅ **PHASE 1 BUILT on `portal-phase-1` (2026-09-18), verified locally, awaiting the officer's go-ahead to merge.** See [Phase 1 record](#phase-1-record-2026-09-18) at the end of the phase. Written 2026-09-18. **Rollback point:** the tag `pre-portal-2026-09-18` (commit `ce5bda7`), which is production as of that date.
> **Current goal: phase 1 only.** Phases 2–4 (houses and bingo) are **on hold** until the officer has more information about how the house system works.
> ⏭️ **NEXT TASK after phase 1 merges (officer, 2026-09-18): a UI redesign of the portal and every page in it** — the hub, `/portal/attend`, `/portal/leaderboard`, `/portal/lookup`. That is v2 phase 3 in [`frontend-redesign-v2-plan.md`](frontend-redesign-v2-plan.md), widened to the hub. It is presentation only, and it owns the `--misa-muted` AA fix. Phase 1 deliberately built the hub from shared primitives so as not to pre-empt it.

## Goal
Group every member-facing tool under `txmisa.org/portal`. Members don't need an account for any of it. The marketing site keeps its current routes, and **`/admin` stays exactly where it is.**

## Decisions (officer, 2026-09-18)
- The portal holds the member tools: check-in, leaderboard, lookup, and later house bingo. The only login is the existing officer one.
- **`/admin` stays separate.** It's a different audience with real auth: the `proxy.ts` matcher, `/admin/login`, `next=` redirects and `revalidatePath` calls all assume that path. The portal links to it; it doesn't contain it. `/officer-invite/[token]` doesn't move either.
- **Only officers edit house bingo.** Members watch it update live.
- **Live means polling, not Supabase Realtime.** The view re-reads on the server every 5–10 seconds (`router.refresh()` on an interval). No table gets a new anon grant, and all reads stay server-side.
- **The site has ONE way in: a navy button reading MEMBER PORTAL** (officer, after reviewing the build, 2026-09-18). It replaces the header's member links and its Check In button.
- 🔓 **Check-in lives only inside the portal.** Nothing outside `/portal` links `/portal/attend` — not the header, the mobile sheet, the 404 recovery nav or `/admin/login`. The printed QR codes are unaffected: `/attend` redirects to `/portal/attend`, which is inside the portal.
- **The hub's buttons are formatted the same** — one skin, one width.

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
3. `git push origin portal-phase-1` for a **Vercel preview URL**. Repeat the walkthrough there, including the redirects via curl. ⚠️ **No check-ins on the preview** (officer, 2026-09-18): a preview reads and writes the PRODUCTION database ([`local-testing-plan.md`](local-testing-plan.md)), so a real check-in there writes a real row. The preview gets page loads, the redirects via curl, and at most one lookup with an obviously fake EID — which proves the Server Action works on the moved route and writes only a throttle row. Check robots in the HTML `<meta>`, not the headers: Vercel adds `X-Robots-Tag: noindex` to every preview response.
4. With the officer's go-ahead, merge to `main` with `git merge --no-ff`, **not on an event day** — first confirm no event's check-in window is open (`npx supabase db query --linked`, one line). Then smoke-test production: `curl -sI https://www.txmisa.org/attend` should return `308` and `location: /portal/attend`, and all four pages should load with their content.
5. **Rollback, if needed:** Vercel **Instant Rollback** to the `ce5bda7` deployment (seconds, no rebuild), then on `main` revert **the portal commits only** — `git revert --no-edit f5d2d85..portal-phase-1`, which reverts every portal commit after the seed fix, newest first. ⚠️ Not `git revert -m 1 <merge>`: the branch also carries two docs commits for behaviour that is already live (`4d1698d`, `6efba64`), and reverting the merge would take those too. 🪤 After an Instant Rollback, Vercel stops assigning the production domain to new deployments automatically, so the revert's deployment has to be promoted by hand. There's no migration, so nothing on the database side needs undoing — and the 308s carry `cache-control: public, max-age=0, must-revalidate`, so browsers revalidate rather than keep a redirect the rolled-back build would answer with a 404.

### Verification checklist
Ticked items were verified **locally** on 2026-09-18 (dev server pinned to the local stack); the preview and production rows are still open.
- [x] `/portal`, `/portal/attend`, `/portal/leaderboard` and `/portal/lookup` return 200 **with their content** (each page's own `<h1>`, no error boundary).
- [x] `/attend`, `/leaderboard` and `/lookup` return **308** to the new paths, **with the query string preserved** (`/lookup?eid=zz&y=2` → `/portal/lookup?eid=zz&y=2`). `/attend/` takes two hops; a POST to `/attend` gets a method-keeping 308.
- [x] A real check-in on `/portal/attend` succeeds locally — a seed member typed in lower case, linked to the stored upper-case EID — and the first-time confirmation step creates the member and the row. ⚠️ **Not on the preview**, by decision: see Rollout step 3.
- [x] A lookup by EID works, shows the new check-in, and writes its throttle row (the rate limit's own bucket).
- [x] The hub, leaderboard and lookup HTML contain `noindex, nofollow`. The attend page has no robots meta, as before.
- [x] The header's one navy button reads MEMBER PORTAL on every public page, including the homepage. It goes to `/portal` and is current there (`page`) and on every `/portal/*` page (`true`). The header, the mobile sheet (six unique items) and the 404 recovery nav link nothing under `/portal/attend`. `/officers` does not claim `/officer-invite`.
- [x] The hub's three buttons share one class: navy, white text, 160px wide, left edges aligned, and no label overflows. They read CHECK IN, LEADERBOARD and LOOKUP under *Event Check-In*, *Points Leaderboard* and *My Attendance*.
- [x] 404 recovery links point at the live paths (both 404s, including one under `/portal`), with no Check In among them.
- [x] `/admin` (307 to login), `/admin/login` (now pointing members at `/portal`) and `/officer-invite/<token>` are otherwise unchanged.
- [x] `npm test` (1,097 across 38 files, including `docs.test.ts` §5 and `security.test.ts`), `npm run build`, `npx tsc --noEmit` and `npm run lint` are all green.
- [x] `grep -rnE '"/(attend|leaderboard|lookup)"' app components lib tests | grep -vE '^tests/portal\.test\.ts:|:[0-9]+:\s*//'` returns nothing, and neither does `grep -rnE '^\s*/(attend|leaderboard|lookup)\s*$'` over the same folders. 📌 The unfiltered grep **can never come back empty**: two comments name the feature (`portal/leaderboard/page.tsx:35`, `app/actions/member-merge.ts:504`) and `tests/portal.test.ts` holds the old paths as the redirect sources it asserts. The second grep exists because the visible text `/attend` on `/admin/login` was on a line of its own, where the first cannot see it.
- [ ] Preview: the four pages, the three 308s (with `cache-control`), robots meta, header, and one fake-EID lookup.
- [ ] Production, after the merge: the same, plus `https://txmisa.org/attend` (no `www`), since a QR code may carry the apex domain.

### Phase 1 record (2026-09-18)

Built on `portal-phase-1`, cut from `ce5bda7`. Every commit is lint-, build- and test-clean on its own.

| Commit | What |
|---|---|
| `4d1698d` | The v1.80 docs for the first-timer checkbox wording (live since `ce5bda7`), committed on their own first, as the officer chose |
| `6efba64` | This plan and its `CLAUDE.md` row |
| `f5d2d85` | **The local seed fix — not portal work**, see below |
| `c8a9238` | The move, the three redirects, every internal link, §5, `tests/portal.test.ts` |
| `f395f69` | The hub, its noindex assertion, "Member Portal" in the 404 recovery nav |
| `d493183` | One "Portal" nav item, section-aware `aria-current`, the re-measured clearance |
| `bba4266` | "Look up your attendance" — found by the `web-design-guidelines` pre-ship review |
| `0e622c8` | Doc v1.81, this record, and the rest of the docs |
| `a9fdd8c` | **Officer review:** one navy MEMBER PORTAL button in place of everything right of the wordmark; check-in reachable only inside the portal |
| `f97d9c0` | **Officer review:** the hub's three buttons formatted the same |
| `94cd6ab` | This record and the docs, brought in line with the two above |
| the copy commit | **Officer review:** the hub's titles and button labels, and the shared button width re-sized to them |

**Where the build departed from the plan above:**
- **The hub is three stacked rows, not a three-up card grid.** Three equal cards side by side is the feature-row tell `design-taste-frontend` bans, and a third of the column cannot fit "My Attendance" at the Title size. Rows also match the narrow single column the member pages use. It first shipped with Check In as the lone primary button; **the officer asked for all three formatted the same**, so they now share one navy skin and one fixed width (full width on a phone) — 160px, sized to the longest label, "Leaderboard" (139.5px natural).
- **The header is one navy button, MEMBER PORTAL, and check-in lives only inside the portal** (officer, after reviewing the first build). The plan above recommended a "Portal" text item beside a Check In button pointed at `/portal/attend`; that was built and then replaced. 🪤 **The longer label is the tight spot on a phone**, not on desktop: beside the centred wordmark, at the shared padding, it cleared the mark by 2.4px at a 360px viewport and ran 25px under it at 320. It takes `px-3` below `sm` (10.4px clear at 360) and stacks MEMBER over PORTAL below 360px (33px clear at 320).
- **No hero subhead**, like `/attend`'s, which the officer removed in `9efceb6`. The one-line bodies are each destination page's own `metadata.description`. **The card titles and button labels are the officer's copy** (2026-09-18): *Event Check-In* / Check in, *Points Leaderboard* / Leaderboard, *My Attendance* / Lookup. They were first built from each page's own heading, and "Points Leaderboard" deliberately differs from the leaderboard page's own "Leaderboard".
- **The header change is its own commit**, carrying the clearance numbers with it, so reverting it alone leaves the docs true.
- **`tests/portal.test.ts` is new.** It asserts the three permanent redirects (nothing else would notice one going missing) and the hub's noindex.
- **Nav clearance at 1280: 342px left, 450px right** (was 342 / 295). The right side fell from 272px to one 117px button, so the left is the tighter side again.

🔴 **The local stack was broken before this began, and fixing it came first.** `seed.sql` had two "still to come" events dated 1 and 8 September. By 2026-09-18 the published one was past, the bulk insert gave it attendance, and the seed's own assert (202 present rows) read 218 and rolled back the WHOLE seed. So `db reset` left a local database with migrations and no data, and **23 tests failed against it** — every one data-dependent, none related to this work. `f5d2d85` moves both events to December, still Fall 2026. **They expire again on 1 December 2026**; move them forward rather than raising the count.

**Found and flagged, not fixed** — this phase is a pure move:
- `/portal/lookup` still says "Both have to match the same member", which has been false since the gate became the EID alone on 2026-08-25.
- The disclosure drift described under *Invariants to carry over* below.
- The sticky header has no matching `scroll-padding-top`, so a focused element can sit under it when tabbing backwards (the pre-ship review; site-wide and pre-existing).

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
- `/attend` keeps its check-in and origin-capture behaviour unchanged. ⚠️ **Its location disclosure no longer exists**: hotfix `c3890a1` (2026-09-14) removed the sentence at the officer's instruction, and only a comment marks where it was (`checkin-form.tsx`). Capture itself is unchanged. `CLAUDE.md`'s invariant "`/attend` carries a disclosure sentence…" and `docs/checkin-location-verification.md` still describe it; that drift predates this plan and is flagged for a separate fix. Nothing here may "restore" the sentence.
- No `data-reveal` on nodes that mount after first paint.
- No unauthenticated route returns an email or EID. `tests/security.test.ts` still allows only `leaderboard` for anon.
