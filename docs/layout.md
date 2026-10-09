# Layout reference

Extracted from `CLAUDE.md` on 2026-08-25 to free context. Per §10 of
[`docs/student-org-website-architecture.md`](student-org-website-architecture.md),
which carries the full reasoning for every entry. Annotations here are one line
each.

```
app/(public)/           landing, /about, /gallery, /officers, /projects, /contact,
                        /officer-invite/[token], and portal/: the member portal
                        hub plus /portal/attend, /portal/leaderboard and
                        /portal/lookup (moved there 2026-09-18; the old paths
                        are permanent redirects in next.config.ts). No
                        portal/layout.tsx — robots stays per page, because
                        /portal/attend is indexable and the other three are not.
                        layout.tsx holds the shared header/footer, mounts
                        RevealObserver once, and 🔓 since 2026-08-19 carries the
                        PUBLIC PAGE GROUND — `bg-misa-panel` on <main>, a flat
                        grey. 🪤 It is on <main> and not on body precisely so
                        /admin stays white; --background stays #ffffff so the
                        sheet, the bento cards and the partner cells still read
                        as lifted WHITE surfaces. 🐛 Four shared primitives fill
                        with bg-misa-panel (controlClass, the sticky THead,
                        FilterChip, the neutral Banner), so /attend, /lookup,
                        /leaderboard and /contact's form take ground="white"
                        rather than those primitives being recoloured — all four
                        are shared with /admin. 📌 The gallery's filter bar was
                        the fourth such section and went with the chips in v2
                        phase 2; _components/ holds page-private
                        pieces (leading underscore = not a route) — the home
                        page's home-hero.tsx (v2 phase 1: the Asymmetric Split
                        Hero and its floating plate cluster — replaces PageHero
                        on the HOME PAGE ONLY). 🔓 PageHero itself was REBUILT in
                        v2 phase 2 (ground="field", dead size/tagline props
                        deleted) and NINE pages render it: the five content
                        pages plus /attend, /lookup and /leaderboard, which are
                        phase 3 and inherit it, and the /portal hub that has
                        linked those three since 2026-09-18 (they live under
                        /portal now too). 🔓 **CENTRED as of 2026-08-23
                        (officer), reversing phase 2's left-alignment** — one
                        component, so all eight moved together. §4.3's
                        anti-centre bias is a bias, not a prohibition, and the
                        home hero is still a split rather than a centred stack,
                        so the front door does not open on one. 🪤 Centring is
                        text-center PLUS mx-auto on BOTH blocks: they carry
                        max-w measures, and centred text inside an off-centre
                        column reads as a bug. Also
                        gallery-marquee.tsx and upcoming-events.tsx (KEPT BUT
                        UNMOUNTED; remounting it also restores the page's
                        force-dynamic), and /gallery's gallery-grid.tsx, still
                        the one client component among these pages — now Load
                        more ONLY, over a photo list passed in as a prop.
                        🪤 Its tiles carry NO data-reveal: the observer scans
                        once per pathname, so an appended tile would sit at
                        opacity 0 forever.
                        📌 /contact is ROUTED BUT UNLINKED from the desktop nav:
                        the handoff drops it, and the About FAQ band and the
                        footer address are the contact paths it puts in its
                        place. It stays in the mobile sheet, which has no
                        wordmark to clear.
                        /leaderboard reads the ANON client through
                        lib/supabase/server.ts, so that grant stays exercised in
                        production; force-dynamic + robots noindex, both load-bearing.
                        /officer-invite/[token] is deliberately OUTSIDE /admin (see
                        the proxy.ts invariant) and renders the pinned email as
                        read-only TEXT — there is nothing to tamper with
app/admin/login/        officer sign-in — deliberately OUTSIDE the (shell) group,
                        whose layout calls requireOfficer()
app/admin/(shell)/      authed chrome + dashboard, events/, attendance/, points/,
                        members/ (+ [id], fields/, presets/, import, merge, and
                        export/route.ts), dues/ (+ [id], import/, new/),
                        officers/; later audit/. Route groups don't appear in
                        URLs, so §5's route table is unchanged.
                        dues/new/ is manual dues entry (migration 32): page.tsx
                        formats Central "now" and the prices, and
                        _components/payment-form.tsx is the client form, whose
                        start terms follow the date field through
                        startTermOptionsForDate. members/_components/ holds the
                        row's inline cells — member-field-cell.tsx and
                        member-type-cell.tsx (migration 30), both on the ROW'S
                        CAS token and shared with [id], and both saving by
                        DISPATCHING the action, never requestSubmit() — a
                        submitted form's reset reverts even a controlled
                        <select> (review, 2026-10-03); the type cell announces
                        through an always-mounted sr-only live region — plus
                        eligibility-mark.tsx (the calculated verdict as a mark,
                        no "use client", shared with [id]). member-table.tsx
                        keys rows by member AND term: under "All terms" a
                        member has one row per term. members/[id]'s Project
                        requirements section states the month general meetings
                        count from, read from app_settings (migration 31), or a
                        ReadError — never a sentence that leaves it out.
                        events/_components/ holds event-form.tsx and
                        event-table.tsx; events/series/_components/ holds
                        series-form.tsx. Both forms carry a bare-label "Count as
                        general meeting" checkbox (migration 31), unticked by
                        default; the table's "general meeting" pill marks a
                        ticked event. 🪤 events/page.tsx CASTS its rows to
                        EventListRow, so nothing type-checks its select string:
                        a column the type names and the select omits reads as
                        undefined, and the pill would silently never render
                        (event-actions.test.ts pins it). _components/ holds shell-wide
                        pieces (status-pill.tsx, audit-trail.tsx, notice.tsx)
                        🔓 **ON THE v2 GROUND since phase 4 (2026-08-29)**:
                        layout.tsx's <main> is bg-misa-panel and content regions
                        are white surfaces lifted off it. 🪤 On <main>, NEVER on
                        body — body keeps --background: #ffffff, which is what
                        those surfaces are lifted off. 🔴 That one line landed
                        LAST, after every screen was wrapped: five shared
                        primitives fill with bg-misa-panel, so on a Vellum page
                        each is the colour of what is behind it. Wrap first,
                        flip last — the reverse order looks finished and is
                        measurably broken.
app/actions/
  attendance.ts         submitCheckin ONLY — the one unauthenticated WRITE path,
                        kept single-export so the §6 attack surface is one file
  lookup.ts             lookupMember ONLY — the one unauthenticated READ path.
                        Writes exactly one row anywhere: the throttle record
  officer-invite.ts     acceptInvite ONLY — the third unauthenticated endpoint and
                        the most consequential, because it CREATES AN OFFICER. The
                        role and (when pinned) the email come off the stored row
  invites.ts            officer-facing — createInvite (returns the one-time link),
                        revokeInvite, revokeOfficerAccess, restoreOfficerAccess.
                        Kept apart from officer-invite.ts. No role check (§9 #6)
  attendance-review.ts  officer resolution mutations
  points.ts             grantPoints, voidAdjustment — and nothing else
  members.ts            setMemberFieldValue, setMemberType (migration 30: CAS, no
                        write or audit row when unchanged — but a stale token
                        is a conflict even then, in both — revalidates the
                        directory AND the member page), saveMemberNotes,
                        saveFieldDefinition, setFieldArchived. No role check,
                        and it says so (§9 #6)
  dues.ts               previewImport / commitImport (re-parses server-side),
                        savePayment (one write, CAS; refuses clearing the member
                        of a hand-entered payment), voidPayment (no CAS), and
                        createPayment (manual entry, migration 32: one insert,
                        both Venmo ids null, one dues.recorded audit row)
  presets.ts            savePreset (create or update, no CAS) and deletePreset —
                        a REAL delete, since nothing is keyed to a preset
  member-import.ts      previewRosterImport / commitRosterImport — create-only,
                        ONE atomic insert, the CSV never leaves the browser
  member-merge.ts       previewMerge / commitMerge — the write ORDER is a safety
                        property; re-count, then refuse to delete unless all zero
  directory-columns.ts  rememberDirectoryColumns ONLY — sets the directory's column
                        cookie HttpOnly from the SERVER (WebKit and Brave cap a
                        document.cookie write at 7 days). Writes NO audit row: a
                        display preference in the officer's browser, not club data
  events.ts             event mutations
  auth.ts               sign in / sign out
  audit.ts              shared admin_audit writer — no "use server", see Invariants
lib/
  auth.ts               getOfficer / requireOfficer — the authorization boundary
  supabase/             server.ts (anon), client.ts (browser, zero importers),
                        admin.ts (service role, `server-only`-guarded)
  types/database.ts     generated — do not hand-edit. ⚠️ Except that migration 30's
                        and 31's additions WERE hand-ported: CLI 2.119.0's output
                        drifts from this file in unrelated ways. Generate into a
                        scratch file and port only the migration's change
                        (operations.md)
  events.ts             event domain core: Central wall-clock conversion, window
                        helpers, expandSeries, duplicateDraft, previewEventEdit —
                        no next/* imports. EventDraft's counts_as_general_meeting
                        is REQUIRED (migration 31), unlike verify_origin, so
                        expandSeries applies the series form's one box and
                        duplicateDraft copies the source's, never the default
  checkin.ts            check-in resolution core + ORPHAN_WINDOW_HOURS + rate limit.
                        Lookup and creation are separate on purpose
  lookup.ts             the member self-service core. 🔴 The gate is the EID
                        ALONE since 2026-08-25 (officer) — it was EID AND
                        matching email, which is what §6 rested the dues-status
                        exposure on. Still ONE query, still never checkin.ts's
                        ordered fallback, still one `unmatched` for every miss.
                        See findMemberByEid's header for what the change cost
  attendance.ts         resolution core: interval parsing, member-candidate scoring,
                        previewResolution, canApprove, planBulkAssign. Anything with
                        a decision in it belongs here, not in the action
  points.ts             categories, signed formatting, AUDITED_ADJUSTMENT_COLUMNS
  members.ts            classifyTermEvents, formatAttendanceRate, FIELD_KEY_PATTERN
                        (a security control), the `cf:` namespace, fieldValue/
                        setFieldValue, AUDITED_MEMBER_COLUMNS
  member-types.ts       member type and project eligibility (migration 30), pure:
                        MEMBER_TYPES (mirrors the CHECK — change both together),
                        DEFAULT_MEMBER_TYPE, PROJECT_MEMBER_TYPES, and the
                        type / eligibility / month / meeting labels as string
                        tables behind type guards. 🪤 formatMonth uses a name
                        table, never new Date on a bare date
  project-requirements.ts
                        fetchProjectRequirements — one member's months and
                        project meetings for a term, from the two officer-only
                        views, plus the month general meetings count from
                        (app_settings.general_meetings_from, migration 31: the
                        value the months view filters on). Each of the three
                        reads fails on its own (Read<T> or
                        GeneralMeetingsFrom, never []), and a missing settings
                        row is an error, since deny-all RLS answers anon with
                        zero rows. The VERDICT is not here: it is the directory
                        row's project_eligibility, read off the page's own
                        member_directory row so the page and the table cannot
                        disagree
  filters.ts            directory filter core: parse → MemberFilter → query. The
                        query builder is typed structurally so tests drive a fake.
                        READ_CHUNK + chunkRange(); the window stays the CALLER's.
                        🔓 `term` is the roster SCOPE (2026-08-25), replacing
                        `state` (active/inactive) and `notSeenSince`, both of
                        which were DELETED rather than hidden. null = the
                        current term and is the default — never a term string,
                        so a saved preset follows the clock instead of pinning
                        the semester it was created in. 🪤 applyMemberFilter
                        takes the real term as a REQUIRED argument, like
                        `fields`: it is the one place null is resolved
  ledger-filters.ts     the points-ledger and attendance-queue filter cores. ONE
                        module for two screens: each had its own copy of the
                        Central half-open date bound and the exports were a third
  presets.ts            saved-filter core — canonicalPresetQuery (WRITE only),
                        storableFields, presetSummary
  member-presets.ts     the preset read
  member-fields.ts      fetchFieldDefinitions — live custom-field definitions,
                        deliberately uncapped
  member-options.ts     fetchMemberOptions — bounded roster scan (MEMBER_SCAN_LIMIT).
                        ⚠️ Scans the WHOLE roster since 2026-08-25: the
                        active-only predicate went with members.active, and
                        `includeId` went with it (its only job was keeping a
                        DEACTIVATED member in the picker), so the cap bites
                        sooner than it did
  event-options.ts      fetchEventOptions — labels formatted server-side
  gallery-photos.ts     galleryPhotos() (paths, for the home marquee) and
                        galleryPhotoEntries() (paths PLUS each file's real
                        pixel dimensions, for /gallery's masonry). Both read
                        public/photos/gallery at BUILD time. ⚠️ Imports
                        node:fs, so it must never reach a Client Component —
                        /gallery's grid IS a client component and takes the
                        list as a PROP for exactly this reason.
                        🪤 Dimensions come from a hand-rolled JPEG/PNG header
                        parse, deliberately NOT sharp, which is not a declared
                        dependency of this project. A masonry has to know each
                        tile's height before the image loads; the alternatives
                        were inventing it (what the page used to do) or forcing
                        one ratio and cropping 62 of 117 portraits against
                        their grain.
                        📌 An empty result is still a valid answer, and the
                        <Hatch> fallback stays reachable
  merge.ts              merge core: planMerge, mergeNotes, mergedCustomFields,
                        mergedMemberType (General is "no answer"),
                        rankDuplicateCandidates. MIN_DUPLICATE_SCORE is NOT
                        MIN_SUGGESTION_SCORE — measured against constructed shapes
  member-import.ts      roster-import core: importColumns (built FROM
                        exportCatalogue), matchHeaders (by NAME), planRosterImport
  export.ts             export core — the field catalogue, the typed ExportCell
                        projection, CSV/TSV/clipboard writers, exportedFields
  export-ledgers.ts     the archival export cores — a SIBLING of export.ts, not an
                        extension. Points go out as a NUMBER, never signedPoints
  xlsx.ts               hand-rolled, dependency-free workbook writer over node:zlib.
                        Consumes the SAME projectRow output as the CSV writer
  directory-columns.ts  the directory's columns, which ARE the export's (2026-10-01):
                        defaults, the misa_directory_columns cookie (a DELTA from
                        the defaults, resolved with Sets only; its attributes for
                        the action; a change keeps keys the page cannot see), Name
                        and the sorted column always shown, no new sorting. The
                        export route never reads the cookie
  csv.ts                the one CSV tokenizer — quoted fields may contain newlines
  dues.ts               dues domain core: Venmo parsing, note → EID matching, the
                        amount → terms rule, and the ONLY place term ordering lives.
                        Since migration 32 also PAYMENT_METHODS and their labels,
                        and the Intl-free civil-date term helpers the manual-entry
                        form calls in the browser
  roster-index.ts       the uncapped {memberId, normalizedEid, emailLower} index,
                        paged in 1000s, returning a discriminated error
  officer-invites.ts    mintInviteToken, hashInviteToken (only the DIGEST is stored),
                        INVITE_TTL_HOURS, MIN_OFFICER_PASSWORD, inviteState — the
                        ONE definition of liveness. ⚠️ Imports node:crypto, so it
                        must never reach a Client Component
  officer-roster.ts     who can sign in vs. who merely has an account. 🪤 Spans two
                        stores PostgREST cannot join; every function returns a
                        discriminated result
  admin-profiles.ts     fetchOfficerNames — "who did this" is always a second query
  request-ip.ts         hashClientIp(scope) — the SCOPED throttle hash. ⚠️ Imports
                        next/headers, so it must never be imported by checkin.ts.
                        🔓 Also clientIp(), returning the RAW address, for
                        check-in origin capture — a deliberate widening of a
                        module whose surface was "you cannot get the address out
                        of me". A THIRD caller is a design review
  network-classify.ts   classifyNetwork() + normalizeOrigin(). Pure — no node:*,
                        no next/*, no deps — so it is bundle-safe anywhere, which
                        is why OriginRecord is declared here. 🔓 Returns `other`
                        (the only flagged label) only when matching nothing MEANS
                        something: UT announces no IPv6, so an unmatched IPv6
                        address is `unknown`, never `other`
  network-prefixes.generated.ts
                        GENERATED by scripts/build-network-table.mjs — do not
                        hand-edit. Committed, so there is no runtime dependency
                        and no request-time network call
  checkin-origin.ts     the origin digest, the venue mode, the flag derivation
                        (migration 28). 🔓 event_id is INSIDE the hash — being
                        unjoinable across events is the feature. ⚠️ Imports
                        node:crypto, so it must never reach a Client Component;
                        resolveCheckin takes a FACTORY for exactly that reason
  validation.ts         zod schemas
  utils.ts              `cn()` — clsx + tailwind-merge, created by `shadcn init`
                        and required by every shadcn component. ⚠️ It is NOT a
                        general-purpose helper drawer: nothing else belongs in
                        this file, and the rest of the app composes class
                        strings directly as it always has
  site.ts               ALL public copy and content constants: socials, emails,
                        mission, ACTIVITIES, HISTORY_*, FAQ, PROJECT*, PARTNERS
                        (with logo paths), and the GALLERY_* placeholder slots.
                        Its header is where the no-photography decision and the
                        restore path are written down
  officers.ts           officer roster — REPLACED WHOLESALE 2026-08-23 from the
                        officer's saved copy of the live page. 🔓 `photo` and
                        `linkedin` are BOTH optional now: all 13 have a
                        headshot (two share one file on the source page and
                        neither can be attributed), and only the 7 returning
                        officers have a LinkedIn, because the new page carries
                        no per-officer links at all. Its header records how the
                        name→photo pairing was established
scripts/create-officer.mjs  officer bootstrap / password reset / revoke
scripts/wipe-remote.sh  EMPTIES the linked project's club data — the "testing is
                        over, real data starts now" button, and the OPPOSITE of
                        seed-remote.sh rather than a mode of it. Keeps officer
                        sign-ins, officer_invites, and the admin_audit rows about
                        invites and officer access; leaves app_settings and
                        checkin_throttle alone. Its header accounts for all
                        thirteen public tables, and that accounting is the
                        invariant
scripts/backup-remote.sh  BACKS UP the linked project (read-only) to a folder
                        OUTSIDE the repo, which it refuses to write inside. The
                        Free plan keeps no backups, so this is the only copy.
                        Checks data.sql's row counts against a live count, and
                        leaves auth sessions and tokens out. Its header holds
                        the restore steps
scripts/organise-pictures.mjs  sorts the officers LOCAL picture library into one
                        folder per page; unnamed files pool into gallery/. Moves,
                        never overwrites — the directory is gitignored, so there
                        is no git checkout behind it
scripts/build-photos.mjs  pictures/{home,projects,officers,gallery} ->
                        public/photos/*,
                        web-sized. Re-run after adding a photo. 🪤 HEIC needs
                        heic-convert: libvips ships HEIF for AVIF only, and
                        .metadata() reads the header fine so a probe will NOT
                        reveal the failure. 📌 `projects` is its own set rather
                        than pooling into `gallery` because those are CLIENT
                        photographs, and gallery is the marquee's pool — a
                        client's office sign scrolling past in a band of member
                        photos is a category error
supabase/migrations/    versioned SQL
supabase/seed.sql
components/shadcn/      🏗️ shadcn/ui components, added on demand with
                        `npx shadcn@latest add <name>`. ⚠️ This path is
                        DELIBERATE, set in components.json: shadcn's default
                        alias is `components/ui`, and `shadcn init` used it to
                        overwrite this project's own button.tsx, which 45 files
                        import. Never point it back
components/             site-header.tsx (4-item nav incl. Admin — was 5 until
                        /projects was unlisted 2026-08-23 — absolutely centred
                        wordmark, then ONE navy button, MEMBER PORTAL → /portal
                        (2026-09-18; it replaced Leaderboard, My Attendance and
                        the Check In button). 🔓 Check-in lives ONLY inside the
                        portal (officer): the header, the mobile sheet and the
                        404 recovery nav never link /portal/attend. On a phone
                        the button takes px-3 and stacks below 360px so it
                        clears the centred wordmark. An item is current on the
                        pages beneath it too: aria-current "page" on the exact
                        match, "true" on the section ancestor. 🪤 MOBILE_NAV drops Admin BY
                        HREF, not by slice index: the old slice(0,4) meant "no
                        Admin" only while Admin sat at index 4, and unlisting a
                        page swept it back in), site-footer.tsx
                        (socials row + address; NO officer link — it is in the
                        nav now). ui/ holds every shared primitive, and BOTH
                        halves of the app use it — /admin used to import two
                        things from here, which is the whole story of its drift:
                          layout    section.tsx (ground + gutter + rhythm in one
                                    place, so the Two Grounds Rule is structural).
                                    🔓 v2 phase 1 added `field`, the drawn navy
                                    radial, which carries `.on-navy` because a
                                    new ground answers the focus ring in the
                                    SAME commit. 🔓 2026-08-19: the default
                                    ground is `page` (paints nothing, inherits
                                    the public layout's grey `<main>`); `white`
                                    is now a REAL bg-white with one caller, the
                                    marquee band; `paper` was RETIRED with the
                                    gray-to-white radial behind it.
                                    🪤 section.tsx is PUBLIC-ONLY and has ZERO
                                    admin call sites by design — it owns the
                                    public gutter and rhythm, which /admin does
                                    not share. On the officer side panel.tsx is
                                    the surface and the shell owns the ground.
                                    panel.tsx (🪤 does NOT forward `action`, so
                                    a <form> needing one stays a <form> with a
                                    bg-white frame), page-header.tsx
                                    (PageHeader + SectionHeading. 🔓 v2 phase 4
                                    finally ADOPTED both: they had ZERO call
                                    sites in the repo while 25 admin pages
                                    repeated one h1 class string verbatim and 45
                                    h2s repeated another. PageHeader carries
                                    title / `badge` (a status pill BESIDE the
                                    title, never pushed right with `action`) /
                                    `back` (🪤 ABOVE the title — it is an
                                    ancestor pointer, and all eleven screens had
                                    it below, arriving after the line that
                                    assumed you knew) / description / children.
                                    SectionHeading takes `id` (five landmarks
                                    point aria-labelledby at it) and
                                    `level="sub"` — 🪤 which renders an <h3>,
                                    not a smaller <h2>: three visual levels have
                                    to be three semantic ones or the outline
                                    lies)
                          type      heading.tsx (Headline/Title/Eyebrow/Lead —
                                    ground-aware via an .on-navy variant, not a
                                    prop), chevron-section.tsx (PageHero — navy
                                    field, grid overlay, chevron notch)
                          controls  button.tsx (buttonClass + named constants —
                                    class strings, not components, because every
                                    call site is already an <a>, a <Link> or a
                                    <button>), field.tsx (Field/Input/Select/
                                    Textarea/controlClass/CHECKBOX — deliberately
                                    thin; see the invariant. 🐛 v2 phase 4 moved
                                    the hint and the error OUT of the <label>:
                                    everything inside one becomes part of the
                                    control's ACCESSIBLE NAME, so a field with a
                                    hint was announced as its label followed by
                                    two sentences of guidance. The label is
                                    explicit now and the component threads the
                                    id itself, so no call site gained plumbing.
                                    🪤 It clones the FIRST ELEMENT child, not
                                    `children` — two call sites pass a <select>
                                    plus an explanatory <p>, and treating that
                                    array as one element leaves the label
                                    pointing at nothing), chip.tsx
                          feedback  banner.tsx (Banner + ReadError — ONE status
                                    language for the whole app. 🪤 `as="div"`
                                    where it carries a list or more than one
                                    paragraph: a <p> cannot contain either, and
                                    the parser closes it at the child's start
                                    tag, so the frame ends early and the rest
                                    renders bare — a DOM rewrite, not a styling
                                    preference), pill.tsx,
                                    empty-state.tsx (never a <Hatch>),
                                    recovery-nav.tsx (the row of ways out on
                                    BOTH 404s — it was written out verbatim in
                                    two files, and its hover silently stopped
                                    working the day the page ground became the
                                    colour it filled with)
                          data      table.tsx (Table/THead/Tr/Th/Td, with the row
                                    hover none of the eight admin tables had —
                                    🔓 and v2 phase 4 is where they finally got
                                    it: the component had ZERO admin call sites
                                    against 11 raw tables and 47 copies of one
                                    head-cell string. 🐛 It carries its OWN
                                    bg-white now rather than each caller
                                    remembering: three things in the file fill
                                    with bg-misa-panel — the sticky <THead>,
                                    Tr's hover, and every controlClass input in
                                    a cell — and both page grounds are that same
                                    grey. 🪤 The scrollport is a focusable,
                                    labelled region: several of these tables
                                    contain no focusable cell at all, so below
                                    their min-width a keyboard-only officer
                                    could not scroll to the right-hand columns)
                          content   partners.tsx, kpi-plate.tsx, activities.tsx,
                                    officer-card.tsx, hatch.tsx (the labelled
                                    placeholder box — every image slot is one),
                                    wordmark.tsx — 🔓 THE REAL LOGO as of
                                    2026-08-23, replacing the CSS construction
                                    that stood in for it since Stage 2. 🪤 The
                                    supplied PNG is WHITE artwork on alpha and
                                    the site needs the mark in two colours, so
                                    it is applied as a MASK over
                                    `background: currentColor` rather than as an
                                    <img> — that keeps the invariant that ONE
                                    component works on white AND navy. Sized by
                                    height (43px, matching what it replaced);
                                    the width grew 48px → 82px, so the header's
                                    wordmark clearance was re-measured
                          motion    reveal.tsx (server-safe revealDelay) +
                                    reveal-observer.tsx (the client observer)
public/                 partners/ (4 logos); misa-logo.png (the real wordmark,
                        white artwork on alpha, used as a CSS MASK so it still
                        paints in currentColor — see .wordmark in globals.css);
                        and photos/, which is COMMITTED and served: home/ (9),
                        projects/ (4, of which 2 are wired up), officers/ (11),
                        gallery/ (117). ⚠️ photos/ is GENERATED by
                        build-photos.mjs from the gitignored pictures/ — do not
                        hand-edit, and read the photography invariant before
                        adding to it
tests/                  Vitest — integration tests against the local stack.
                        member-types.test.ts is pure; project-eligibility.test.ts
                        places fixtures in a far-past and a far-future Fall (so
                        every month's state is fixed whatever today's date is)
                        and checks the views against member_directory's verdict.
                        Since migration 31 its general meetings are TICKED
                        fixtures, and the far-past block pins the start to its
                        own August, since no month after the real 2026-10-01
                        start has ended yet. member-directory.test.ts's type
                        filters sit on a far-past Fall too; both pick one with
                        helpers.ts's pickEmptyFall. helpers.ts also holds
                        GENERAL_MEETINGS_FROM and setGeneralMeetingsFrom():
                        the start is GLOBAL state every file's verdicts read,
                        so a test's move is undone in a finally and a block's
                        pin in its afterAll, and global-setup.ts heals it at
                        suite start and puts the developer's value back after
proxy.ts                admin route protection — Next 16 renamed middleware.ts;
                        the exported function is proxy(), not middleware()
next.config.ts          redirects() only: /attend, /leaderboard and /lookup →
                        /portal/*, PERMANENT (308, query string carried). 🔓
                        NEVER delete one — printed QR codes point at /attend.
                        tests/portal.test.ts asserts all three
vercel.json             function region pinned to cle1 (us-east-2) — in-repo
```

`vercel build` **cannot run locally on Windows** — it fails with `EPERM … symlink` when emitting function output. It still validates `vercel.json` and compiles routes. Use `npm run build` for ordinary local builds.
