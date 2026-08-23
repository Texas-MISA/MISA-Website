# Check-in location verification — the modal origin, per event

**Status:** ✅ **BUILT — migration 28, 2026-08-22.** Requested 2026-08-19,
replanned against four officer decisions and three researched questions, built
and reviewed the same day. 🌿 On the branch `v2-phase-2`; **migration 28 is
applied LOCALLY and not yet pushed**, and the code that reads it is not deployed
either, so the two are in step.

This document is the spec **and** the record of what the mechanism **cannot** do
— see *What this cannot catch*, which is not a caveats section but the main
thing to read before anyone trusts a flag. Everything below describes what
exists unless it says otherwise; the build log carries the defects the review
found and what they taught.

⚠️ **Three things in the plan turned out to be wrong when measured, and the
corrections are marked 🔬 in place below.** They are kept rather than quietly
overwritten, because each one is the kind of assumption the next feature will
make again: the carrier table could not be hand-written, UT announces no IPv6,
and a text-matching test for IPv4-mapped addresses covers one spelling of two.

⚠️ **This was proposed, the weakness was raised, and the officer asked for the
plan anyway.** That is recorded so the next reader does not mistake the tradeoff
for an oversight. The design below is the version that gives the officer the
signal they asked for while conceding as little privacy as the signal allows.

## What changed on 2026-08-22

Four decisions and one resolved blocker. Each is argued in place below; this is
the index.

| | Decision |
|---|---|
| **The `x-forwarded-for` blocker** | ✅ **Resolved, favourably.** Vercel overwrites the header and does not forward external IPs, expressly to prevent spoofing. The check is not defeatable by a hand-rolled request. See *The header question*. |
| **Per-event toggle** | `events.verify_origin`, **default true**. Flippable before or after the event. |
| **Retroactive** | Capture runs on **every** self check-in regardless of the toggle, so flipping it a week later lights up the flags with no backfill. 🔓 **The toggle controls derivation, not collection** — that is the whole reason retroactive is free, and it is a disclosure obligation, not a footnote. |
| **Network kind** | A **committed CIDR table, zero dependencies, zero external calls.** Not MaxMind, not a third-party API. See *The classifier*. |
| **Cellular** | **Never flagged.** It renders as its own state, because a member on cellular has not been shown to be absent. |
| **§6's rotating venue code** | ✂️ **Dropped.** This replaces it. §6's *Check-in on behalf of someone else* row and §11's future-work list both need amending to say so. |

## What it does

For each event, the **most common check-in origin is assumed to be the venue**.
A check-in from a different origin is surfaced for officer review as a possible
submission from someone not in the room — **unless it came from a mobile
carrier**, which proves nothing either way.

That is the whole idea. Everything below is about making it (a) not require
storing anyone's IP address, (b) fail to *no signal* rather than to a false
accusation, and (c) never act on its own.

## The header question — resolved

The previous revision called this *"a blocking question for the feature, not a
detail"*, because `lib/request-ip.ts:36` reads the first entry of
`x-forwarded-for`, which in a standard proxy chain is the client-controlled end.

Vercel's request-headers documentation settles it:

> If you are trying to use Vercel behind a proxy, we currently overwrite the
> `X-Forwarded-For` header and **do not forward external IPs**. This restriction
> is in place to prevent IP spoofing.

Supplying your own `X-Forwarded-For` requires the Enterprise **Trusted Proxy**
add-on, which this project does not have and must not buy. So the value that
reaches the function is Vercel's own view of the connecting client, and a
hand-rolled `curl -H 'X-Forwarded-For: …'` cannot move it.

📌 **Read `x-vercel-forwarded-for` anyway.** It carries the identical value, but
it is the one a reverse proxy placed *in front of* Vercel could not overwrite.
Prefer it, fall back to `x-forwarded-for`. Nothing about the deployment needs
this today; it costs one `??` and removes a way to be wrong later.

⚠️ **This does not make the check unevadable.** It makes the *header*
unforgeable. Joining the venue wifi still defeats it completely, and this
repository is public, so anyone who wants to know that can read it here.

## Two signals, not one

Every self check-in produces two independent facts about its origin. Keeping
them separate is what lets cellular be excused without weakening anything else.

### 1. The origin digest — "is this the same network as everyone else's?"

The modal-origin algorithm never needs to know what an address *is*. It only
ever asks **"is this the same as that one?"** — so the system never has to store
an IP, and does not.

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
  used to trace where a member was over a semester. It answers "same network as
  everyone else, this once" and nothing wider. Do not "optimise" the event id
  out of the hash to make the digests joinable — being unjoinable is the
  feature, and it is the single reason this design is acceptable at all.
- **`normalize(ip)` folds IPv6 to its `/64` prefix** and leaves IPv4 whole.
  Without this the mode never forms for anyone on IPv6: the low bits rotate, so
  every submission from one device looks like a different origin.

### 2. The network kind — "what sort of connection was it?"

A four-value label, computed from the address at submission time and stored
alongside the digest:

```
campus | cellular | other | unknown
```

⚠️ **This is the one thing stored that IS joinable across events**, unlike the
digest. It says "this person was on cellular at event X and on campus at event
Y". That is about a bit and a half of information per check-in and it is the
price of the cellular exemption — which is a privacy *improvement* overall,
because the alternative is flagging real attendees. Recorded here so nobody
later discovers it and reads it as an oversight.

🪤 **The kind must be computed at submission time and cannot be recovered
later.** It needs the address, and the address is never stored. This is the one
part of the feature that is genuinely not retroactive: a check-in captured
before this ships has no kind and never will. Rows from before the migration
render *origin unknown*, permanently and correctly.

## The classifier — a committed CIDR table

`lib/network-classify.ts`, pure, no dependencies, no `node:*` imports, no
network calls.

**Two rejected alternatives, and why.** MaxMind's GeoIP2 Connection Type
database is the canonical source — `cellular` / `cable-DSL` / `corporate` /
`satellite`, and MaxMind claims **~95% accuracy on cellular**. It is **paid**:
the free GeoLite2 offering is Country, City and ASN only, and MaxMind's own
documentation states connection type is available through paid products alone.
It would also mean a committed MMDB blob, a reader dependency, and the GeoLite
EULA's requirement to refresh within 30 days of each release — against a
codebase that hand-rolled an xlsx writer and a JPEG header parser to avoid
exactly this.

🔴 **A third-party API at check-in time is worse, and not because of latency.**
IPinfo's `is_mobile` and ip-api's `mobile` are accurate and free at low volume,
and using either means **sending every member's real IP address to a data
broker**, from the one unauthenticated write path, while they are standing in a
room trying to check in. The entire premise of the digest is that the club never
holds an address. Shipping every address to a vendor to power an advisory pill
inverts the design. Do not do this, and do not do it "just for the ones we can't
classify" either.

**What gets built instead.** The question is not really *"is this cellular"* —
it is *"is this the venue's network"*, and on a campus that has a direct answer.

- **`campus`** — the address falls inside UT Austin's announced address space.
  UT owns **AS18**, allocated in July 1984, announcing seven IPv4 prefixes
  totalling ~299,008 addresses: `128.62.0.0/16`, `128.83.0.0/16`,
  `129.116.0.0/16`, `146.6.0.0/16`, `198.213.192.0/18`, `206.76.64.0/18`,
  `198.214.80.0/20`. ⚠️ **Verify these against a live BGP source before
  committing them** — they are read off a third-party ASN listing, they change
  rarely but they do change, and UT's IPv6 allocation is not enumerated here at
  all.
- **`cellular`** — the address falls inside a known US mobile carrier block,
  from **AS20057** (ATT-MOBILITY-LLC), **AS21928** (T-MOBILE), **AS6167**
  (CELLCO-PART) and **AS22394** (CELLCO). ⚠️ AS6167/AS22394 are Verizon
  Wireless: *Cellco Partnership* is its legal name, so the right ASN does not
  say "Verizon". AS20057 is the **wireless** arm, not AT&T's consumer broadband,
  which is a different ASN and must stay out of the list.
- **`other`** — parsed fine, matched nothing.
- **`unknown`** — no address available, unparseable, **or a family the table
  cannot speak to** — see the IPv6 correction below.

🔬 **CORRECTION — the plan said "a few dozen prefixes, hand-written". Measured,
it is ~6,300 and cannot be typed at all.** AT&T Mobility announces **1,633**
IPv4 prefixes, Verizon's Cellco **3,842**, T-Mobile **538**, against UT's
**8**. A wrong `cellular` entry is worse than a missing one — it hands a free
pass to whoever is inside it on the strength of a fabricated fact — so the table
is **generated and committed** by `scripts/build-network-table.mjs` from RIPE
NCC's `stat.ripe.net` announced-prefixes data call. 📌 Merging the overlapping
announcements collapses 6,302 prefixes to **137 v4 + 32 v6 ranges in a 7KB
file**, an order of magnitude smaller than the estimate that made hand-writing
look attractive. Every property the approach was chosen for survives: **no
runtime dependency, no request-time network call, and no member's address ever
leaves the server.**

The generated file carries a `GENERATED_AT` date, re-exported as
`NETWORK_TABLE_VERIFIED`. ⚠️ **A prefix table goes stale silently and its misses
are invisible**, and staleness fails toward *flagging real attendees*: a
carrier's new block reads `other`, and `other` is the one label that gets
flagged. Re-run the script when a whole carrier starts reading `other`. If this
ever gates anything, the classifier is the first thing that has to go.

🔬 **CORRECTION — UT ANNOUNCES NO IPv6, and that changed the classifier's
contract.** AS18 is eight IPv4 prefixes and nothing else, so `CAMPUS_V6` is
**empty**. A student on campus wifi over IPv6 matches no campus range — not
because they are off campus, but because there is nothing to match against — and
calling that `other` would flag a member sitting in the room, which is the one
failure this feature is least allowed to have. So **`classifyNetwork` returns
`other` only when matching nothing actually MEANS something**: if a family's
campus table is empty, the answer is `unknown`, which is never flagged and
carries no digest. Self-correcting — add UT's v6 space to the script and IPv6
starts classifying normally. 📌 The generalisable rule: *"matched nothing" and
"we have nothing to match with" are different answers, and a lookup table that
cannot tell them apart will state the first while meaning the second.*

**Mechanics.** IPv4 parses to a uint32 and compares under a mask; IPv6 parses to
a BigInt and does the same, both by binary search over sorted, merged, disjoint
ranges.

🔬 **CORRECTION — IPv4-mapped addresses are folded on the PARSED VALUE, never by
matching text.** The first implementation tested `/^::ffff:…/`, which covers the
canonical spelling and misses the equally valid uncompressed
`0:0:0:0:0:ffff:128.83.140.7` — that fell through to the IPv6 branch, landed in
the empty `CAMPUS_V6`, and produced a **v6 digest for a v4 client**. One client,
two digests, silently dropped out of its own venue mode. The test is now
`v6 >> 32n === 0xffffn`. 📌 *Structure covers every spelling; a regex covers the
one you thought of.*

## The per-event toggle

```sql
alter table public.events
  add column verify_origin boolean not null default true;
```

A checkbox on the event form, on by default, editable at any time — including
long after the event has ended.

**Why retroactive is nearly free.** The design already separates capture from
derivation: the digest is written at check-in, and the flag is computed at
*review* time from rows that all exist by then. So the toggle is purely a
derivation gate. Flip it a week later and the flags appear, with no backfill and
no migration.

🔓 **The consequence, stated plainly: the toggle does not control collection.**
Capture runs on every self check-in whether the event's flag is on or off — that
is precisely what makes flipping it afterwards work. An officer who turns it off
is choosing not to *look*, not choosing not to *record*. This belongs in the
`/attend` disclosure sentence, not only in this document. See *Open decisions*.

🪤 **Adding a column to `events` is not free elsewhere.** `app/actions/events.ts`
carries **five separate literal column lists** for events, and the audit
invariant is that both sides of a before/after must select the same columns —
`verify_origin` has to reach the create select, the edit read, the edit write,
the delete before-read and `duplicateEvent`'s source read, or the audit log will
invent a change that never happened. They are unbroken string literals for the
PostgREST typing reason; keep them that way.

## Schema — migration 28

📌 **28 is the next unclaimed number** per `tasks.md`. Claim it loudly; 26 and 27
collided on 2026-08-19 because two sessions claimed the same number.

```sql
alter table public.events
  add column verify_origin boolean not null default true;

create table public.checkin_origin (
  attendance_id uuid primary key references public.attendance(id) on delete cascade,
  -- NULL when the submission resolved to no event: event_id is inside the
  -- hash, so there is nothing to hash against. The kind is still recorded.
  origin_hash   text,
  network_type  text not null
                  check (network_type in ('campus','cellular','other','unknown')),
  created_at    timestamptz not null default now()
);

create index checkin_origin_hash_idx
  on public.checkin_origin (origin_hash) where origin_hash is not null;

alter table public.checkin_origin enable row level security;
-- Deny-all, no policies, service role only — the house rule for every new table.
```

**A sibling table, not columns on `attendance`.** Columns would ride into
`member_directory`, into `exportCatalogue`'s field list, and into
`AUDITED_MEMBER_COLUMNS` and the audit before/after JSON — each a separate place
an origin digest could leak into a downloaded spreadsheet. A separate table is
reachable from exactly the query that needs it.

🔓 **`origin_hash` is nullable and `network_type` is not, and the asymmetry is
the point.** The previous revision wrote a row only for `present` submissions,
which the retroactive requirement breaks: a `pending` orphan resolved to an
event by an officer would show *origin unknown* forever. Now every self check-in
gets a row. A `pending` row records its **kind** but no digest, so an officer
who later assigns it at least learns whether the submitter was on campus — which
is most of the available signal — while the unjoinability property is untouched.

## Capture

In `app/actions/attendance.ts`, after resolution, from the resolved
`attendance.id`:

- 🪤 **Never for `source = 'admin_manual'`.** Officer manual entry at
  `/admin/attendance/new` runs from the officer's laptop. Recording ten walk-ins
  would write ten rows on the officer's own origin, which then either *becomes*
  the venue mode or gets the whole batch flagged. Both failure modes are silent
  and both are wrong. Capture is scoped to the public check-in path only.
- 🪤 **The insert must fail open.** A failure to record an origin must never fail
  a check-in — same doctrine as `checkRateLimit`, and for the same reason: this
  is an advisory signal sitting in the one unauthenticated write path.
- 🪤 **A missing header must produce `unknown`, never a digest of the string
  `"unknown"`.** `hashClientIp` buckets a missing header under a shared literal,
  which is harmless for a ten-minute rate-limit window and actively wrong here:
  in local dev *nobody* has the header, so every check-in would share one digest
  and form a confident, entirely fictional venue mode. Missing address →
  `origin_hash = null`, `network_type = 'unknown'`.
- 🔓 **The raw address lives as a local in one function and is never stored,
  logged, or returned.** This needs a new export on `lib/request-ip.ts` —
  `clientIp()`, returning the address rather than a hash — which widens a module
  whose entire surface has so far been "you cannot get the address out of me".
  Justified only because both consumers are in the same call and neither
  persists it. Any third caller is a design review.

New modules:

- **`lib/network-classify.ts`** — the CIDR table and `classifyNetwork(ip)`.
  Pure, dependency-free, no `node:*`, trivially testable against constructed
  addresses.
- **`lib/checkin-origin.ts`** — `originDigest()`, `establishVenueOrigin()`,
  `deriveOriginFlag()`, `VENUE_MIN_COUNT`, `VENUE_MIN_SHARE`. ⚠️ Imports
  `node:crypto`, so like `lib/officer-invites.ts` it must **never** reach a
  Client Component.

## The algorithm

Computed **at review time, never at check-in time.** During an event the mode is
still forming, so an early arrival would be flagged for being early. The officer
opening the queue is the moment every relevant row exists.

**Establishing the venue origin**, for an event with `verify_origin = true`:

1. Take the `present` rows for the event with `source = 'self_checkin'` whose
   `submitted_at` falls inside `[checkin_opens_at, checkin_closes_at)` —
   half-open, per the invariant that the three window comparisons must agree.
2. **Drop `network_type = 'cellular'` rows from both the groups and the
   denominator.** A tethered hotspot must never become the venue, and leaving
   cellular in the denominator means a heavily-cellular event dilutes its own
   share below quorum and loses a venue it actually had.
3. Group the rest by `origin_hash`. The largest group is the **candidate venue
   origin**.
4. **Quorum, or there is no venue at all.** The candidate stands only if it
   accounts for at least `VENUE_MIN_COUNT` check-ins **and** at least
   `VENUE_MIN_SHARE` of the non-cellular ones. Below either threshold the event
   has **no established origin** and *nothing is flagged* — not "everything is
   flagged". Failing to no-signal is the same direction as `attendance_rate`
   being null rather than zero, and as an undecided dues row covering nothing.

Both constants are named, documented at their definitions, and are **judgement
calls about a room, not security tuning** — the same category as
`RATE_LIMIT_MAX`. Starting suggestion: `VENUE_MIN_COUNT = 5`,
`VENUE_MIN_SHARE = 0.5`. Expect to move them after one real event.

**Classifying one row**, in this precedence order. It is ordered rather than a
matrix because cellular short-circuits everything below it:

| # | Condition | State | Flagged | Pill |
|---|---|---|---|---|
| 1 | event has `verify_origin = false` | `off` | — | *silent* |
| 2 | `source <> 'self_checkin'` | `not_applicable` | — | *silent* |
| 3 | no `checkin_origin` row | **origin unknown** | no | shown |
| 4 | `network_type = 'cellular'` | **cellular — unverifiable** | **no** | shown |
| 5 | `origin_hash is null` | **origin unknown** | no | shown |
| 6 | no established venue origin | `no_venue` | — | *silent* |
| 7 | `origin_hash` = venue origin | **at venue** | no | shown |
| 8 | `network_type = 'campus'` | **elsewhere on campus** | yes, soft | shown |
| 9 | otherwise | **off-network** | yes | shown |

🔬 **ROW 2 WAS NOT IN THE PLAN, and its absence was a shipped defect.** Capture
never runs for `admin_manual` — correctly, since those rows carry the officer's
own origin — so every walk-in an officer typed in fell through to `unknown` and
was badged **"Origin unknown"**. That badge claims the system tried to determine
an origin and failed; the truth is the concept does not apply to the row. It
sits **above** the missing-record check, which is what makes it reachable at
all.

📌 **Rows 1, 2 and 6 render NO pill.** A badge on every row of an event where
nothing was checked is noise an officer learns to ignore, and an officer who
learns to ignore one badge ignores the row it sits in. The section header
carries those states instead. Row 2 is silent for a second reason: an
officer-entered row is already badged as officer entry elsewhere in `/admin`.

📌 **Row 8 is the case the mode exists for.** If UT NATs the whole university to
one egress, row 8 is unreachable and the feature reduces to row 9 — a
restatement of "not on UT's network". If UT NATs per building or per region, row
8 is the member checking in from their dorm, which is the fraud this was
requested to catch. **Which of those is true is unknown and worth measuring**:
open `whatismyipaddress.com` on UT wifi in two different buildings and compare.
Two minutes, and it tells you whether row 8 ever fires. It cannot be measured
after the fact — `event_id` is inside the hash precisely so digests cannot be
compared across events.

⚠️ **Row 4 outranks rows 8 and 9 unconditionally**, which is the officer's
decision of 2026-08-22 and the largest single source of false positives removed.
It also means a member who tethers from their dorm is never flagged. That is a
real hole and it is accepted knowingly: the alternative flags every real
attendee whose phone had not joined the wifi yet.

## Where it surfaces

A pill on the **event's attendance list** (`/admin/events/[id]`), plus the
checkbox on the event form. **No new route.** The labels must not assert fraud:
*at venue* / *elsewhere on campus* / *cellular — unverifiable* / *off-network* /
*origin unknown*, and `components/ui/pill.tsx`'s **`critical` tone is never
used** — the strongest available is `caution`, which means "worth a glance".

📌 **NOT on the `/admin/attendance` queue, which the plan called for.** Its rows
are overwhelmingly `pending`, and a pending row carries no digest by
construction, so the column would be a wall of "Origin unknown". Adding it would
also mean computing a separate venue mode for every event on a filtered list
that spans events. Deferred deliberately, not forgotten.

🪤 **The section header is load-bearing**, because rows 1, 2 and 6 are silent:
without it an officer reads an unmarked list as a clean one rather than as one
nobody checked. It distinguishes *off* / *no quorum* / *ambiguous* / *the read
failed* / **the pepper is not configured** — that last one because
`ORIGIN_CAPTURE_ENABLED` was otherwise dead and a missing
`CHECKIN_ORIGIN_PEPPER` in production would have been completely silent, with
every event reading "not enough check-ins came from one network" forever.

🪤 **Origins are read by EVENT through the embedded attendance row, never an
`.in()` list of attendance ids.** One uuid is ~37 characters and §2.2's worst
case is 150 attendees — a 5.5KB query string on a GET, the same shape as the
1,257-character URL that made the member picker abandon id enumeration at 28
members.

📌 **Advisory only. It changes nothing on its own.** It does not reject a
check-in, does not move a `present` row to `pending`, does not withhold points,
and writes no `admin_audit` row by itself — flagging is not an officer action.
An officer acting on a flag uses the mutation paths that already exist and audit
themselves. This follows the standing rule that near-misses are never
auto-resolved: keep the human in the loop and make their job fast instead.

📌 Flipping `verify_origin` **is** an officer action and audits itself as an
ordinary event edit, which is the correct record of "somebody decided to look".

## What this cannot catch

Read this before trusting a flag. The mechanism detects **"submitted from a
different network than most attendees, and not from a phone"**, which is a proxy
for "not in the room" only when the venue's network is distinctive. It is not
one on a campus.

- 🔓 **The most likely form of the fraud passes cleanly.** One person in the room
  checking in an absent friend from their own phone is on the venue origin by
  construction. The design cannot see it, and nothing in this revision changes
  that.
- 🔓 **Cellular is now a documented, public bypass.** Turn off wifi, check in
  from anywhere on earth, land on row 4, never get flagged. This is the direct
  cost of the false-positive decision and it is the correct trade only because
  the flag is advisory. **If this ever gates anything, reopen row 4 first.**
- 🔓 **A member in the next building over may be indistinguishable from one in
  the room** — see the note under row 8. If the campus is one NAT, so is a dorm.
- ⚠️ **The residual false positives are still concentrated on real attendees.**
  Guests and first-timers who cannot get on eduroam land on `other` and are
  flagged at full strength. A venue whose APs egress on more than one address
  splits its own mode and may fall below quorum.
- **Anyone who reads this public repository learns exactly how to defeat it.**

Net: treat a flag as *worth a glance at a list*, never as evidence about a
person. If it is ever going to be quoted at a member, it should not ship.

## Open decisions

1. ~~Does `/attend` disclose it?~~ — ✅ **DECIDED AND BUILT: yes.** One plain
   sentence under the check-in button, written in the **unconditional present
   tense** because that is the truth — capture runs on every check-in regardless
   of the event's toggle, so hedging it with "we may", or describing the toggle,
   would document the wrong thing. It also says **what** is stored rather than
   merely that something is: "we note the network you used" invites the reading
   that an address is kept, and none ever is. Recorded as §9 #15.
2. **Retention — STILL OPEN, and nothing has been built.** The digests are meaningful only within one event, so they
   should not outlive it by much. Recommend a purge of `checkin_origin` rows
   older than one term, opportunistic in the style of `checkin_throttle`'s
   prune, so no scheduled job is added. ⚠️ `network_type` is the joinable half
   and has the weaker case for being kept; purging drops both together, which is
   the simplest thing that is also correct.
3. **The two thresholds — STILL OPEN and UNMEASURED.** `VENUE_MIN_COUNT = 5`
   and `VENUE_MIN_SHARE = 0.5` shipped as placeholders. A room question,
   answerable only after a real event. Raising the share makes the feature
   quieter and more certain; lowering it flags more people on thinner evidence,
   which is the direction that produces an accusation nobody can defend.
4. ~~This or the venue code~~ — ✅ **settled 2026-08-22: this, and the venue code
   is dropped.** §6's threat row and §11's future-work list were both amended.
5. 📌 **Whether to close the `verify_origin` public read — open, and recommended
   NOT to.** `events_public_read` grants anon `select` on published events, so
   anyone can query the public API for which events are unchecked. It reveals
   nothing an attacker needs (cellular bypasses every event regardless, and this
   file is public), and closing it means revoking the table-level `select` and
   re-granting column by column — machinery the next migration adding a column
   would silently get wrong.

## Docs changed with the code — ✅ all done

- **`docs/student-org-website-architecture.md`** — a new §6 row (the check-in
  action now writes a second table and derives a per-member network signal); an
  amendment to the *Check-in on behalf of someone else* row recording that the
  rotating venue code was **dropped** in favour of this; removal of the rotating
  code from §11's future-work list; a new §9 entry for decisions 1 and 2; §4.6
  gaining `verify_origin`; and a version header bump.
- **`CLAUDE.md`** — invariants for the pepper, the event-id-in-the-hash rule, the
  fail-open insert, the never-for-`admin_manual` rule, the missing-header rule,
  advisory-only, and the `lib/request-ip.ts` surface widening. The layout block
  gains `checkin_origin`, `lib/network-classify.ts` and `lib/checkin-origin.ts`.
- **`scripts/wipe-remote.sh`** — 🪤 **its header accounts for all twelve tables in
  `public` and that accounting IS the definition of "this database is empty".**
  Thirteen now. `checkin_origin` belongs in the **deleted** group and cascades
  from `delete from attendance`, but it has to be *named*, and the verify step
  should count it — a table missing from the accounting is drift nobody can see.
- **`supabase/seed.sql`** — same rule, same reason: the wipe list is the
  definition of "matches the seed". The seed inserts no origin rows.
- **`tasks.md`** — the open item this plan closes, and the migration-count row.
- **`docs/build-log.md`** — the build entry and the review addendum.

📌 `tests/docs.test.ts` enforces the presence half of this automatically: every
`lib/` module must be named in both §10 and `CLAUDE.md`'s Layout, and the
migration count in `tasks.md` must match the files on disk. ⚠️ It asserts a name
is **present** and cannot assert the prose is **true** — green means nothing is
undocumented, not that the docs are right.

## Verification — ✅ what actually ran

**1,111 tests across 37 files, lint, `npx tsc --noEmit` and `npm run build` all
clean.** Three new files — `tests/network-classify.test.ts` (24),
`tests/checkin-origin.test.ts` (38), `tests/checkin-origin-capture.test.ts`
(12) — plus targeted `checkin_origin` probes added to `tests/security.test.ts`.

1. ✅ **Unit, `lib/network-classify.ts`** — both edges of **every** campus range
   and one address outside each, read from the table's own contents rather than
   typed, so the suite survives a regeneration; a carrier address; both
   spellings of an IPv4-mapped address; bracketed IPv6; leading zeros; an
   unparseable string; the empty case.
2. ✅ **Unit, the mode** — a clear majority; below each threshold separately; a
   tie (must be *ambiguous*, never a winner); zero recorded origins; every row
   cellular (must yield no venue, not a cellular venue); cellular not diluting a
   real venue below quorum; and every one of the eight ordered states.
3. **The assertion that matters most: no raw address is ever persisted.** Probe
   `checkin_origin` for anything matching an IP shape and assert zero rows, the
   same way the roster tests assert `/lookup` returns no identifier.
4. ✅ **A missing `PEPPER` degrades to `origin_hash = null`**, never a digest
   hashed with `undefined` that would survive a rotation, and is loud at module
   load. ⚠️ The two halves pull against each other — fail-open says the check-in
   must still succeed — which is why it degrades rather than throws. 🪤 A test
   asserts the pepper **is** configured in the suite's own environment, because
   six cases are gated on it and would otherwise all skip **silently** while the
   suite still reported green.
5. ✅ **A `checkin_origin` insert failure still yields a successful check-in**,
   tested two ways: the insert returning an error, **and the insert throwing**.
   The second is the one that matters — PostgREST failures normally arrive as
   `{ error }`, so the rejection path is the one that ships unnoticed, and it
   escaped into `submitCheckin`'s house try/catch and told a member their
   already-written check-in had failed. ⚠️ That test was checked against the
   unfixed code and **does** fail without the fix.
6. ✅ **An `admin_manual` row writes no origin at all** — and holds
   structurally, since `resolveCheckin` has exactly one caller.
7. ✅ **THE HEADLINE REQUIREMENT, end to end.** An event is created with the
   toggle **off**; eight check-ins run through the real capture path; all eight
   origins are recorded **anyway**; every row derives `off`. The event finishes,
   the flag is flipped, and the same eight stored rows now establish a venue
   (6 of 8 considered) and produce `at_venue: 6, on_campus: 1, off_network: 1`
   — with the row count still **8**, so nothing was written or backfilled to
   make it happen. A second case flips it back off and confirms the evidence
   survives, so it is a view toggle and not a delete; a third confirms the
   default is on and that turning one event off leaves another alone.
8. `tests/security.test.ts` sweeps the new table with the anon and authenticated
   keys, like every other table.
9. Browser walkthrough on the local stack: an event with a majority origin and
   two outliers, an event under quorum, a `pending` row confirming it records a
   kind but no digest, and the toggle flipped after the fact.

## What shipped, and where it lives

```
supabase/migrations/20260730000028_checkin_origin.sql
                              the table, the events column, and the
                              unknown-has-no-digest CHECK
lib/network-classify.ts       classifyNetwork() + normalizeOrigin(). Pure — no
                              node:*, no next/*, no deps — so it is bundle-safe
                              anywhere, which is why OriginRecord is declared
                              here rather than beside the code that builds it
lib/network-prefixes.generated.ts
                              GENERATED — do not hand-edit
lib/checkin-origin.ts         originDigest, buildOriginRecord,
                              withinCheckinWindow, establishVenueOrigin,
                              deriveOriginFlag, the two constants, the labels.
                              ⚠️ node:crypto, so never a Client Component
scripts/build-network-table.mjs
                              refetches the table from RIPEstat
lib/request-ip.ts             gains clientIp(), returning the RAW address.
                              🔓 A THIRD caller is a design review
lib/checkin.ts                resolveCheckin takes an optional origin FACTORY —
                              a factory precisely so this file never imports
                              node:crypto, since a Client Component imports
                              ORPHAN_WINDOW_HOURS from it
app/actions/attendance.ts     reads the address, builds the closure, discards it
app/actions/events.ts         verify_origin through all FIVE literal column
                              lists — both sides of the audit before/after
app/admin/(shell)/_components/origin-pill.tsx
app/admin/(shell)/events/[id]/page.tsx
                              the read, the derivation, the summary header
app/admin/(shell)/events/_components/event-form.tsx
                              the checkbox. 🪤 A bare <label>, NOT wrapped in
                              this file's local Field, which renders a <label>
                              of its own — nested labels are invalid HTML
app/(public)/attend/_components/checkin-form.tsx
                              the disclosure sentence
```

## Build order — ✅ all seven steps done

1. **Migration 28** + regenerate `lib/types/database.ts` + the four doc updates
   that describe the schema (`wipe-remote.sh`, `seed.sql`, `CLAUDE.md`,
   `tasks.md`).
2. **`lib/network-classify.ts`** and its tests — pure, no other file depends on
   it, and it is the piece most likely to need revision after a real event.
3. **`lib/checkin-origin.ts`** and its tests — the digest and the derivation.
4. **Capture** in `app/actions/attendance.ts` + `clientIp()` on
   `lib/request-ip.ts`. At this point origins accumulate and nothing displays
   them, which is a safe place to stop and let one real event produce data.
5. **The toggle** on the event form, plus `verify_origin` through all five event
   column lists in `app/actions/events.ts`.
6. **The pills** — on the event attendance list. 📌 The queue was **deliberately
   skipped**; see *Where it surfaces* for why.
7. **The `/attend` disclosure sentence**, per open decision 1.

🔍 **Then the whole thing was reviewed, and the review found six defects in code
that had already passed 1,098 tests, lint, `tsc` and a clean build.** They are
listed in `docs/build-log.md`. 📌 The lesson worth carrying: **a green suite
proved the feature ran, not that it was right** — every one of the six was found
by re-reading the code against what it was supposed to do, or by measuring
something the plan had assumed.
