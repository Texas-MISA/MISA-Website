# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: prospective students.** A UT Austin undergraduate — any major, any year
— who has heard of MISA and is deciding whether to show up to a meeting. They
arrive from Instagram, a Linktree, a friend, or an org fair, usually on a phone.
Nothing is asked of them: membership is not required to attend, so the only job
the site has to do for this person is make MISA legible enough to walk into a
room.

When a design decision forces a trade-off between audiences, this person wins.

Two other audiences are served and are not the tiebreaker:

- **Members**, who check in at an event on their own phone during its first
  minutes and occasionally look up their own standing. They have no accounts —
  identity is an EID plus a matching email.
- **Officers** (a team of ~13, elected annually), who run events, the attendance
  queue, the points ledger, the member roster and dues from `/admin` on a laptop.

**Corporate partners and recruiters** read `/projects` and `/about` to decide
whether to sponsor MISA or scope a student consulting project. They are a real
readership for the public pages, not a hypothetical one.

## Product Purpose

MISA is the Management Information Systems Association at UT Austin's McCombs
School of Business — a professional, academic, philanthropic and social student
organization for people combining technology with business. Founded 1982,
re-established 2009.

The website is two things in one codebase: the org's public front door, and the
system that runs its attendance and points program. It replaced a Squarespace
site that could only do the first.

Success is a prospective student who understands what MISA is and comes to a
meeting, and an officer team that can run a semester of events without a
sign-in sheet or a spreadsheet.

## Positioning

**Attendance and points, automated.** The thing this site does that the previous
one could not: members check themselves in with their EID, the roster resolves
them, officers review what could not be resolved, points accrue, dues reconcile
against a Venmo export, and a public leaderboard shows standings. Sign-in sheets
and hand-maintained spreadsheets are what it replaces.

A secondary property, established in how it is built rather than claimed:
everything is org-owned and transferable. Officers turn over every year, so no
piece of infrastructure belongs to an individual, officers are onboarded by
expiring single-use invite links, and the whole system is reproducible from a
public repository.

## Operating Context

- **Check-in happens on a phone, standing up, in a room.** `/attend` is used
  during the first minutes of an event, on the member's own device, frequently
  on crowded campus wifi where an entire venue shares one NAT. Latency,
  thumb-reach and per-IP rate limits are real constraints, not edge cases.
- **Officers work at a desk, on a laptop**, between classes. Wide tables,
  multi-column filters and keyboard-driven bulk workflows are appropriate for
  `/admin`; it is not a phone surface.
- **Corporate partners read the public pages** before a sponsorship or project
  conversation. `/projects` and `/about` are read by adults evaluating whether
  students can do the work.
- Events are general meetings, technical workshops, socials, service days,
  networking nights and an end-of-year banquet. Terms are `Spring YYYY` /
  `Fall YYYY`, and the org's whole calendar is anchored to them.
- The org communicates through Instagram (`@texasmisa`), Slack, LinkedIn and a
  Linktree; the site is one destination among those, not the only one.

## Capabilities and Constraints

Confirmed and shipped:

- Public pages: home, `/about`, `/projects`, `/gallery`, `/officers`.
  `/contact` is routed but deliberately unlinked from the desktop nav.
- Member-facing, no accounts: `/attend` (EID check-in), `/leaderboard` (public,
  deliberately not indexed), `/lookup` (a member's own history behind an EID
  **and** matching email).
- Officer-facing `/admin`: events, attendance queue and review, points ledger,
  member directory with custom fields and exports, dues import and review,
  officer invites.

Durable constraints future work must preserve:

- **Members have no accounts and will not get them in v1.** Identity is EID plus
  matching email. Any design that assumes a logged-in member is wrong.
- **Officer turnover is annual.** The next maintainer has not seen this codebase
  and may not be technical. Legibility outranks cleverness, and nothing may
  depend on a specific person's account.
- **The repository is public.** No real roster data, real EIDs or real emails
  may appear in seed data, tests or fixtures.
- Runs on free-tier hosting (Vercel) and Supabase Postgres; capacity limits are
  expressed as named constants in the code, not as billing decisions.
- Terminology that is load-bearing and should not be paraphrased in UI copy:
  *EID*, *term*, *dues*, *official member*, *points*, *adjustment*, *pending*.
- Dues status is **calculated** from payment records, never a flag anyone ticks,
  and it gates nothing.

## Brand Commitments

- Name: **MISA** — Management Information Systems Association, UT Austin. Also
  written "Texas MISA".
- Tagline: *— Where Analytics, Innovation, and Leadership Converge —*
- Voice: plain, warm and unpretentious, addressed to a student. "Anyone! We
  accept all majors & years!" is the register. Not corporate, not ironic.
- All public copy lives in `lib/site.ts` and `lib/officers.ts` and is the source
  of truth for wording. It is never hardcoded into a page.
- **`DESIGN.md` is the binding visual authority for the whole site** (since
  2026-08-17). The design handoff at `docs/Texas MISA website UI mockups/` is
  historical reference: it is desktop-only, covers five public pages and none of
  `/admin`, `/attend`, `/leaderboard` or `/lookup`, and authors no breakpoints
  or interaction states. The identity it established — navy on white, the Barlow
  pair, square corners, hairlines, the chevron hero, the hatch — is unchanged and
  is recorded in `DESIGN.md`. See its *Relationship to the design handoff*.
- The real MISA logo file has never been supplied; the header wordmark is drawn
  in CSS.

## Evidence on Hand

Real:

- Four partner logos — KPMG, PwC, ConocoPhillips, Credera — in
  `public/partners/`. These are the only images the site serves.
- Three real Spring 2024 student consulting projects: **PepsiCo** (facility and
  corporate communication tool), **Casa de Luz** (customer engagement and
  marketing analysis), **CapMetro** (transit data analysis).
- Real officer roster with names, roles and LinkedIn profiles (`lib/officers.ts`).
- Real org history: founded 1982, re-established 2009, membership grew 250% over
  two years, members from MIS, Computer Science, Engineering and Natural Sciences.
- Real social and contact channels: `txmisa@gmail.com`,
  `utmisa.corporate@gmail.com`, Instagram, Slack, LinkedIn, Linktree.

Deliberately absent — must not be fabricated or worked around:

- **There is no photography.** Every image slot on every page — marquee tiles,
  the About cluster, the gallery, officer headshots, project cards — renders a
  labelled hatched placeholder. This is a decision, not a backlog item; the
  photo directory was deleted rather than left unlinked. Any proposal that
  introduces hero imagery, stock photography or generated imagery is refused.
- Officer headshots carry a second, independent blocker: the photo-to-name
  pairing was never supplied, so restoring photography would not unblock them.
- No testimonials, member counts, placement statistics, awards or press exist.
  Do not invent them.
- Production data is entirely fabricated seed data and must stay obviously fake.
- `/contact` has no backend; its form is rendered but not wired.

## Product Principles

1. **The prospective student is the tiebreaker.** The public pages exist to get
   someone into a room. Every other surface is a tool.
2. **Show the org, don't decorate it.** With no photography available, the
   design carries the weight honestly — labelled placeholders, never borrowed
   or generated imagery standing in for a life the org hasn't photographed yet.
3. **Nothing that arrived is dropped on the floor.** A check-in that can't be
   resolved is queued for a human; a payment that can't be read is stored and
   reviewed. The system never guesses on a member's behalf and never silently
   discards their action.
4. **Officers are humans with a semester, not operators with a manual.** Admin
   work should be fast to do correctly and hard to do destructively, because the
   person doing it learned the job in September.
5. **Build for the handoff.** Every decision is inherited by someone who wasn't
   in the room. Prefer the legible option, and write down why.

## Accessibility & Inclusion

No formal standard has been mandated by UT, McCombs or the org — build to good
practice rather than recording a compliance claim that cannot be backed.

Two product facts do set a real floor: `/attend` is used one-handed on a phone
in a crowded room, and the org explicitly accepts all majors and years with no
prerequisite knowledge, so nothing public should assume technical fluency.
