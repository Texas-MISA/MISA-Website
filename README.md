# MISA Website

The website and attendance system for **Texas MISA** — the Management Information Systems Association at UT Austin. This covers the public site at [txmisa.org](https://www.txmisa.org/) and the officer tooling that replaces tracking attendance in a spreadsheet.

Deployed from `main` to **https://misa-website-beta.vercel.app**.

## What it does

| Audience | What they get | Auth |
|---|---|---|
| Public | Org info, upcoming events | none |
| Members | Check in at an event, see standings and their own history | none — identity-based (student ID + matching email), no accounts in v1 |
| Officers | Schedule, attendance review, point adjustments, roster | Supabase Auth session + a matching `admin_profiles` row |

The core idea: a member checks in from their phone in about twenty seconds, and anything the system can't resolve confidently goes to an officer to fix rather than being guessed at or dropped.

## Stack

Next.js 16 (App Router) on Vercel → Supabase Postgres. There is no separate API service: Server Components read, Server Actions and Route Handlers write, and **authorization lives in Postgres Row Level Security** rather than in the frontend.

## Getting started

You need Node, and — for the local database and the test suite — Docker Desktop.

```bash
npm install
npm run dev          # http://localhost:3000
```

Local Supabase stack (applies every migration and runs `seed.sql`):

```bash
npx supabase start
node scripts/create-officer.mjs --local --email dev@example.edu --role admin
npm test
```

> [!WARNING]
> `.env.local` points at the **remote** project, so `npm run dev` reads production unless something stops it. `.env.development.local` (gitignored) pins dev to the local stack. Check the dev server's banner reads `Environments: .env.development.local, .env.local` before trusting a local walkthrough — the remote carries the same seed data, so the wrong target looks entirely correct.

Common commands:

```bash
npm run build                 # production build
npm run lint
npm test                      # Vitest; needs the local stack running
npx supabase db reset         # wipe, replay migrations, re-seed (local; needs Docker)
npx supabase db push          # apply pending migrations to the linked project
```

## Where things are

```
app/(public)/     the public site: landing, about, gallery, officers,
                  projects, contact, and /attend
app/admin/        officer area: login, dashboard, events, attendance, points
app/actions/      Server Actions — every write in the system
lib/              domain cores (checkin, events, attendance, points), all pure
                  and free of next/* imports so they are testable
supabase/         versioned migrations + seed data
tests/            Vitest; integration tests run against the local stack
docs/             architecture, decisions, and the site inventory
```

## Documentation

- **[`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md)** — the source of truth. Schema, staged build plan, and the reasoning behind every decision that was hard to make. Start here.
- **[`CLAUDE.md`](CLAUDE.md)** — invariants and traps. Read before changing anything; several entries record a bug that cost hours and would otherwise be reintroduced.
- **[`tasks.md`](tasks.md)** — short-horizon checklist and the current handoff state.
- **[`docs/attend-confirmation-flow.md`](docs/attend-confirmation-flow.md)** — the `/attend` first-time confirmation spec.
- **[`docs/existing-site-inventory.md`](docs/existing-site-inventory.md)** — what was carried over from the old Squarespace site, and what was deliberately left as a placeholder.

## For the next officer

Everything is meant to be handed over, not inherited as a mystery:

- The database rebuilds from this repo alone — `create project → link → db push`. No schema change is ever applied only through the dashboard.
- Infrastructure belongs to the org, never to an individual. Accounts, ownership, and the handoff checklist are in §2.3–§2.5 of the architecture doc; re-check them at every turnover.
- Content carried over from the old site lives in `lib/site.ts` and `lib/officers.ts` — edit those rather than hardcoding copy into pages.
- The Supabase free tier pauses after inactivity and needs a manual resume. Check before the first event of each semester; it is the single most likely operational surprise.

> [!IMPORTANT]
> **This repository is public.** Seed and test data must stay obviously fake — never a real roster export, real student IDs, or real emails. Photos of identifiable students need their okay before being committed.
