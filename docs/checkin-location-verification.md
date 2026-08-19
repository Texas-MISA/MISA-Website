# Check-in location verification — the modal IP per event

**Status:** 📋 **NOT BUILT.** Requested 2026-08-19. Nothing described here exists;
today the only IP handling in the system is `lib/request-ip.ts`, which hashes an
address for rate limiting and links it to nobody. This document is the plan, and
it is deliberately also the record of what the mechanism **cannot** do — see
*What this cannot catch*, which is not a caveats section but the main thing to
read before anyone trusts a flag.

⚠️ **This was proposed, the weakness was raised, and the officer asked for the
plan anyway.** That is recorded so the next reader does not mistake the tradeoff
for an oversight. The design below is the version that gives the officer the
signal they asked for while conceding as little privacy as the signal allows.

## What it does

For each event, the **most common check-in origin is assumed to be the venue**.
A check-in from any other origin is flagged for officer review as a possible
submission from someone not in the room.

That is the whole idea. Everything below is about making it (a) not require
storing anyone's IP address, (b) fail to "no signal" rather than to a false
accusation, and (c) never act on its own.

## The one design decision that matters: equality is all this needs

The modal-origin algorithm never needs to know what an address *is*. It only
ever asks **"is this the same as that one?"** — so the system never has to store
an IP, and should not.

```
origin_hash = sha256( PEPPER || event_id || normalize(ip) )
```

Three properties fall out of the shape, and each is load-bearing:

- 🔓 **`PEPPER` is a server-only environment secret, never a repo literal.** The
  existing `hashClientIp` prefixes a *known* scope string, which is fine for a
  bucket key that expires in ten minutes but is not fine for a digest sitting
  next to a member's identity. IPv4 is 4.3 billion addresses; an unpeppered
  SHA-256 of one is reversible on a laptop in seconds, and **this repository is
  public**, so the salt cannot be in it.
- 🔓 **`event_id` inside the hash breaks cross-event correlation.** The same
  address at two events produces two unrelated digests, so the table cannot be
  used to trace where a member was over a semester. It answers "same room as
  everyone else, this once" and nothing wider. Do not "optimise" the event id
  out of the hash to make the digests joinable — being unjoinable is the feature.
- **`normalize(ip)` folds IPv6 to its `/64` prefix** and leaves IPv4 whole.
  Without this the mode never forms for anyone on cellular: the low bits of an
  IPv6 address rotate, so every submission from one phone looks like a different
  origin.

⚠️ **Verify which header Vercel actually guarantees before writing this.**
`lib/request-ip.ts:36` reads the first entry of `x-forwarded-for`, which in a
standard proxy chain is the client-controlled end. If that is spoofable here,
the check is defeatable by anyone who reads this file — and this file is public.
`x-vercel-forwarded-for` / `x-real-ip` are the platform-set candidates. This is
a blocking question for the feature, not a detail: an evadable check that
officers believe is worse than no check.

## Schema — one migration, one table

A **sibling table, not a column on `attendance`.** A column would ride into
`member_directory`, into `exportCatalogue`'s field list, and into
`AUDITED_MEMBER_COLUMNS` / the audit before-and-after JSON, each of which is a
separate place an origin digest could leak into a downloaded spreadsheet. A
separate table is reachable from exactly the query that needs it.

```sql
create table public.checkin_origin (
  attendance_id uuid primary key references public.attendance(id) on delete cascade,
  origin_hash   text not null,
  created_at    timestamptz not null default now()
);

create index checkin_origin_hash_idx on public.checkin_origin (origin_hash);

alter table public.checkin_origin enable row level security;
-- Deny-all, no policies, service role only — the house rule for every new table.
```

**A row is written only when resolution produced `present`.** That is not a
filter, it is the definition: `present_requires_resolution` guarantees a
`present` row has a non-null `event_id`, and the event id is *inside the hash*,
so a submission with no resolved event has nothing to hash against. Orphaned
`pending` rows therefore record no origin at all — correct, since a check-in
submitted three hours later from home is not evidence about the venue.

🪤 **The insert must fail open.** A failure to record an origin must never fail
a check-in — same doctrine as `checkRateLimit`, and for the same reason: this is
an advisory signal sitting in the one unauthenticated write path.

## The algorithm

Computed **at review time, never at check-in time.** During an event the mode is
still forming, so an early arrival would be flagged for being early. The officer
opening the queue is the moment every relevant row exists.

1. Take the `present` rows for the event whose `submitted_at` falls inside
   `[checkin_opens_at, checkin_closes_at)` — half-open, per the invariant that
   the three window comparisons must agree.
2. Group by `origin_hash`. The largest group is the **candidate venue origin**.
3. **Quorum, or there is no venue at all.** The candidate stands only if it
   accounts for at least `VENUE_MIN_COUNT` check-ins **and** at least
   `VENUE_MIN_SHARE` of them. Below either threshold the event has **no
   established origin** and nothing is flagged — not "everything is flagged".
   Failing to no-signal is the same direction as `attendance_rate` being null
   rather than zero, and as an undecided dues row covering nothing.
4. Every `present` row whose hash differs from an established venue origin is
   **off-origin**. Rows with no `checkin_origin` record are **unknown**, which is
   a third state and must render as one — never folded into off-origin.

Both constants are named, documented at their definitions, and are **judgement
calls about a room, not security tuning** — the same category as
`RATE_LIMIT_MAX`. Starting suggestion: `VENUE_MIN_COUNT = 5`,
`VENUE_MIN_SHARE = 0.5`. Expect to move them after one real event.

The core belongs in `lib/attendance.ts` (or a sibling), pure and testable, with
the query in the page — "anything with a decision in it belongs here, not in the
action" is the existing rule.

## Where it surfaces

A pill on the existing `/admin/attendance` queue rows and on the event's
attendance list. **No new route.** Three states, three labels, and the language
must not assert fraud: *off-site origin* / *at venue* / *origin unknown*.

📌 **Advisory only. It changes nothing on its own.** It does not reject a
check-in, does not move a `present` row to `pending`, does not withhold points,
and writes no `admin_audit` row by itself — flagging is not an officer action.
An officer acting on a flag uses the mutation paths that already exist and audit
themselves. This follows the standing rule that near-misses are never
auto-resolved: keep the human in the loop and make their job fast instead.

## What this cannot catch

Read this before trusting a flag. The mechanism detects **"submitted from a
different network than most attendees"**, which is a proxy for "not in the room"
only when the venue's network is distinctive. It is not one on a campus.

- 🔓 **The most likely form of the fraud passes cleanly.** One person in the
  room checking in an absent friend from their own phone is on the venue origin
  by construction. The design cannot see it, and adding it does not reduce it.
- 🔓 **A member sitting in the next building over is indistinguishable from one
  in the room.** Campus wifi NATs a whole institution; the signal is "on the
  university network", not "at this meeting".
- ⚠️ **The false positives are concentrated on real attendees who are present.**
  Anyone on cellular because the wifi is bad, anyone whose phone had not
  associated yet at the door, guests and first-timers who cannot get on eduroam,
  a venue whose APs egress on more than one address. These people *are there*,
  and the flag says otherwise.
- **Anyone who reads this public repository learns exactly how to defeat it** —
  join the venue wifi, or spoof the header if the header turns out to be
  spoofable.

Net: treat a flag as *worth a glance at a list*, never as evidence about a
person. If it is ever going to be quoted at a member, it should not ship.

## Relationship to §6's rotating venue code

§6 already names a mitigation for this exact risk — *"Check-in on behalf of
someone else | Accepted risk for v1 … mitigate later with a rotating per-event
code displayed at the venue."* The two are not the same shape and the difference
should be settled before building either:

| | Modal IP | Rotating venue code |
|---|---|---|
| Catches the absent member checking themselves in | statistically, with false positives | **yes, directly** |
| Catches a friend in the room checking someone in | no | no — the code can be texted |
| Cost to a real attendee | flagged for being on cellular | must be able to see a screen |
| Data added about members | an origin digest per check-in | **none** |
| Defeated by | joining the venue wifi | a screenshot in the group chat |

The code is the stronger control on the primary case and adds no data about
anybody; the modal IP needs no venue display and no officer to run it. **They
overlap enough that building both is probably redundant** — a decision, not a
sequencing question.

## Open decisions the officer owns

1. **Does `/attend` disclose it?** Recommend **yes**, in one plain sentence on
   the form. The site is public, the repo is public, and a check-in form that
   quietly profiles the network you submitted from is a worse surprise than the
   sentence is a deterrent.
2. **Retention.** The digests are only meaningful within one event, so they
   should not outlive it by much. Recommend a purge of `checkin_origin` rows
   older than one term, opportunistic in the style of `checkin_throttle`'s
   prune, so no scheduled job is added.
3. **The two thresholds**, above — a room question, answerable only after a real
   event.
4. **This or the venue code**, per the table above.

## Docs that must change in the same commit as the code

- **`docs/student-org-website-architecture.md`** — a new §6 row (the check-in
  action now writes a second table and derives a per-member network signal), an
  amendment to the *Check-in on behalf of someone else* row recording which
  mitigation was chosen, a new §9 entry for decisions 1 and 4, and a version
  header bump.
- **`CLAUDE.md`** — the invariants for the pepper, the event-id-in-the-hash
  rule, the fail-open insert, and advisory-only. The layout block gains
  `checkin_origin` and the new lib module.
- **`tasks.md`** — the open item this plan closes.

## Verification

1. **Unit** — mode with a clear majority; mode below each threshold returning
   *no established origin*; a tie; an event with zero recorded origins.
2. **The assertion that matters most: no raw address is ever persisted.** Probe
   `checkin_origin` for anything matching an IP shape and assert zero rows, the
   same way the roster tests assert `/lookup` returns no identifier.
3. **A missing `PEPPER` must fail loudly at startup**, not silently hash with
   `undefined` and produce digests that survive a rotation.
4. **A `checkin_origin` insert failure still yields a successful check-in** —
   the fail-open property, tested by forcing the insert to error.
5. `tests/security.test.ts` sweeps the new table with the anon and authenticated
   keys, like every other table.
6. Browser walkthrough on the local stack: an event with a majority origin and
   two outliers, an event under quorum, and a `pending` row confirming it
   records no origin.
