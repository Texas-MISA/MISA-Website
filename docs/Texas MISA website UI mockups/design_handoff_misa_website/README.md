# Handoff: Texas MISA public website (Homepage, About, Projects, Gallery, Officers)

## Overview
Five public-facing pages for Texas MISA (Management Information Systems Association at UT Austin, McCombs School of Business): Homepage, About, Projects, Gallery, Officers. Navy/white institutional identity, marketing-site scope only — no member auth, no admin UI. The nav includes `Admin` and `Check In` entries as links, but those screens are not designed here.

Target: the Next.js app at `Texas-MISA/MISA-Website` (branch `main`), which replaces the current live site.

## About the Design Files
The `.dc.html` files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior. They are not production code to copy. Each file is a single-component HTML document with all styling inline; there is no build step, no CSS modules, no component library.

The task is to **recreate these designs in the existing Next.js + Tailwind codebase**, using its established patterns: App Router pages under `app/(public)/`, shared chrome in `components/site-header.tsx` / `components/site-footer.tsx`, content in `lib/site.ts` and `lib/officers.ts`, tokens in `app/globals.css`. Do not port the inline styles verbatim — translate them into the codebase's Tailwind classes and token variables.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and copy. Recreate pixel-accurately. Two known placeholders, both intentional:
1. Activity/project/gallery images marked `social event photo`, `workshop photo`, `project photo`, etc. are hatched placeholder boxes awaiting real photography.
2. On Officers, the headshot-to-name pairing is arbitrary — the correct mapping was never supplied. A small mono note flags this on the page; delete the note once corrected.

## Design Tokens

### Color
| Token | Value | Use |
| --- | --- | --- |
| Navy (brand) | `#16305c` | Hero fields, section bands, primary buttons, eyebrow labels, headings on light ground |
| Navy hatch A | `#2c4b7c` | Placeholder hatch stripe on navy grounds |
| Navy hatch B | `#26436f` | Placeholder hatch stripe on navy grounds |
| Ink | `#1d1f20` | Body headings |
| Body text | `#3a3d40` | Long-form paragraphs |
| Secondary text | `#4a4d50` | Card body copy |
| Muted text | `#6f7275` | Meta labels, placeholder captions |
| Light panel | `#f2f2f3` | Alternating section ground, chip fills |
| Hairline | `rgba(29,31,32,.16)` | Section rules, grid gaps |
| Border | `rgba(29,31,32,.2)` | Card and image frames |
| Border (dashed) | `rgba(29,31,32,.3)` | Empty slot outlines |
| Placeholder hatch | `#f2f2f3` / `#e7e7ea` | 45° 7px repeating-linear-gradient |
| On-navy body | `rgba(255,255,255,.8)` – `.85` | Paragraphs on navy |
| On-navy muted | `rgba(255,255,255,.6)` – `.7` | Eyebrows on navy |
| On-navy border | `rgba(255,255,255,.28)` – `.45` | Frames and outline buttons on navy |

No radii anywhere — every corner is square. No shadows except a 1px hairline border. No gradients except the placeholder hatch and the hero grid overlay.

### Typography
Two Google fonts: **Barlow Condensed** (headings) and **Barlow** (body), weights 400/500/600/700.

| Role | Spec |
| --- | --- |
| Page title (hero h1) | Barlow Condensed 600, 72px, line-height .96, letter-spacing -.02em |
| Hero subhead | Barlow 400, 20px/1.5 |
| Section heading | Barlow Condensed 600, 42px/1, letter-spacing -.02em |
| Subsection / activity title | Barlow Condensed 600, 34px/1.02, letter-spacing -.015em |
| Card title (large) | Barlow Condensed 600, 30px/1.02, letter-spacing -.015em |
| Card title (medium) | Barlow Condensed 600, 26px/1.08, letter-spacing -.01em |
| Card title (small) | Barlow Condensed 600, 22px/1.05 |
| KPI numeral | Barlow Condensed 600, 34–38px/1, navy |
| Body (large) | Barlow 400, 18px/1.65 |
| Body | Barlow 400, 16px/1.65 (or 1.7 in cards) |
| Body (small) | Barlow 400, 15px/1.6–1.65 |
| Meta / eyebrow | Barlow 500, 12px/1.2, letter-spacing .14em, uppercase |
| Meta (small) | Barlow 500, 11px/1.3, letter-spacing .12em, uppercase |
| Nav item | Barlow Condensed 500, 13px/1, letter-spacing .06em, uppercase |
| Button | Barlow Condensed 600, 13–15px/1, letter-spacing .08–.1em, uppercase |
| Placeholder caption | ui-monospace/Menlo 400, 10–11px |
| Footer link | Barlow 400, 13px/1 |

### Spacing
Page gutter 56px. Section vertical padding 56–80px. Card padding 22–40px. Grid gaps: 1px (KPI/partner plates, so the shared hairline reads as a rule), 16–24px (card grids), 44–56px (two-column splits). Header height 60px, horizontal padding 32px.

## Shared Chrome

### Header (all five pages)
60px tall, white, 1px bottom hairline. Three zones:
- **Left nav**: About · Projects · Gallery · Officers · Admin. Active page is `#1d1f20` with a 1px navy bottom border (2px padding-bottom); the rest are `#6f7275`. Homepage has no active item.
- **Center wordmark** (absolutely positioned, translate(-50%,-50%)): lowercase "misa" in Barlow 600 24px, letter-spacing -.02em, navy — with a hand-built exclamation glyph overlaying the second stem: an absolutely positioned column at `left:1.72em; top:-.3em` holding a .16em circle above a .05em×.14em bar. Below it, "TEXAS" in Barlow 500 8px, letter-spacing .42em with matching text-indent so it optically centers.
  *The org's real logo file exists (`uploads/misa.zip - 1.png`) but was never swapped in — use the real asset in production.*
- **Right**: Leaderboard, My Attendance (both `#6f7275`), then a solid navy `Check In` button (8px/16px padding, white text, 600 weight).

### Hero (all five pages)
Navy field, 72px top / 108px bottom padding, centered content, max-width 900px. Two decorative layers:
1. A 60×60px grid overlay: two `linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px)` — one vertical, one horizontal — absolutely positioned across the section.
2. A chevron notch cut from the bottom edge: `clip-path: polygon(0 0, 100% 0, 100% calc(100% - 48px), 50% 100%, 0 calc(100% - 48px))`. This carries over from the current live site and should be preserved.

The homepage hero omits the eyebrow and buttons — just h1 + italic tagline.

### Footer (all five pages)
44px/56px padding, 1px top hairline, space-between: left is a 22px-gap row of About · LinkedIn · LinkTree · Instagram · Slack in navy 13px; right is `txmisa@gmail.com` in `#6f7275`.

### Partners plate (Homepage, About)
Section on `#f2f2f3` (Homepage) or white (About), 80px/88px padding. Centered "Our Amazing Partners" heading at 42px. Below it a four-column grid with `gap:1px` on a hairline background and hairline border, each cell white with 40px/28px padding, logo at `height:84px; object-fit:contain`, full color (not grayscale).

## Screens

### 1. Homepage (`MISA Homepage.dc.html`)
Section order, top to bottom:
1. **Hero** — h1 "Management Information / Systems Association" (explicit `<br>`), italic tagline "— Where Analytics, Innovation, and Leadership Converge —" in Barlow italic 20px.
2. **Mission + Upcoming Events** — two equal columns, 56px gap, 64px/56px padding. Left: "Our Mission" (42px, navy) + the mission paragraph + a framed 16:10 image placeholder ("group / chapter photo"). Right: "Upcoming Events" (42px, navy) + a three-row list. Each row is a `92px 1fr` grid: navy uppercase date on the left, then title (Barlow Condensed 600 21px) over venue/time (`#6f7275` 13px). 1px hairline above the first row and below each. **No RSVP buttons** — removed deliberately.
3. **Gallery band** — full-width navy section, 48px/56px padding. A right-aligned white "See all photos →" link, then two infinite marquee tracks. Track one scrolls left (`@keyframes mq`: translateX(0) → -50%, 38s linear infinite) with 260×170px tiles; track two scrolls right (`@keyframes mqr`: -50% → 0, 46s) with 200×130px tiles. **Each track contains its content group duplicated exactly twice**, and each group carries a trailing `padding-right` equal to its `gap` — this is what makes the -50% translate land seamlessly. Tiles have `rgba(255,255,255,.28)` borders; real photos are duotoned, placeholders use the navy hatch.
4. **Activities** — "Activities" heading (42px), then four alternating two-column rows separated by hairlines. Each row: copy on one side (title 34px + paragraph 16px/1.65, max-width 46ch), framed 16:10 image placeholder on the other, alternating left/right. Titles: Social Events, Technical Workshops, Professional Development, Leadership Opportunities. **No numerals** — the 01–04 labels were removed.
5. **Client & Data Projects** — navy section, 64px/56px. Heading (42px) with a right-aligned "All projects →" link, intro paragraph (max-width 74ch), then three cards in a row. Each card: `rgba(255,255,255,.3)` border, a 3:2 navy-hatch placeholder with a hairline bottom border, then 18px/20px padding holding an uppercase semester eyebrow, a 26px title, and a one-line summary. Cards: PepsiCo, Casa de Luz, CapMetro.
6. **Partners plate** (shared, on `#f2f2f3`).
7. **Footer** (shared).

### 2. About (`MISA About.dc.html`)
1. **Hero** — "About Us" / "Connecting technology with business."
2. **Mission + photo cluster** — `1.05fr .95fr` grid, 48px gap, `align-items:stretch`. Left: a hairline-bordered card, 40px/44px padding, vertically centered, holding "Our Mission" (42px navy) + the mission paragraph at 17px/1.7. Right: a flex column — one large image (`flex:1.4`, min-height 220px) above two smaller images side by side (`flex:1`, min-height 140px, 16px gap).
3. **History of MISA** — `.85fr 1.15fr` grid, 48px gap, `align-items:stretch`, 44px top padding under a hairline. Left column is a flex column: the 42px heading, then a duotone portrait frame at `flex:1; min-height:340px`. **The `<img>` inside is absolutely positioned (`position:absolute; inset:0; height:100%; object-fit:cover; object-position:center 25%`)** — without this the frame sizes to the image's intrinsic height and leaves a large void beside the right column. Right column: two hairline cards ("Who we are", "Growth") with uppercase navy eyebrows and 16px/1.7 paragraphs, then a three-cell KPI plate (1982 Founded / 2009 Re-established / 250% Membership growth), `gap:1px` on hairline.
4. **Photo band** — four full-bleed 1:1 duotone photos, no gap, edge to edge.
5. **FAQ** — section on `#f2f2f3`, 64px/72px padding. "Frequently Asked Questions" (42px), then a `<dl>` as a two-column grid with 20px gaps. Six white cards, each with a 1px border, 26px/28px padding, question in Barlow Condensed 600 26px navy with a 12px-padded hairline underline, answer in Barlow 15px/1.65 `#4a4d50`. Order — left column: What is MISA? / What is the dress code for meetings? / How do I know if MISA is right for me? Right column: Who can become a MISA member? / Why should I be a part of MISA? / What can I expect at a MISA event? A seventh cell spans both columns (`grid-column:1/-1`): navy band, space-between, "Still have a question? Email us — we answer every one." plus a white `txmisa@gmail.com` button.
6. **Partners plate** (shared, white ground) + **Footer**.

### 3. Projects (`MISA Projects.dc.html`)
1. **Hero** — "Client & Data Projects" / "Turning classroom knowledge into real-world impact."
2. **Intro** — 64px/48px padding. A centered four-cell KPI plate (max-width 900px, `margin:0 auto`, `gap:1px`): 3 Data teams / 3 Client teams / 1 sem Project length / All Majors welcome, each cell white with 20px/24px padding and centered text. Below it the intro paragraph, centered, max-width 900px, 18px/1.65, 36px top margin.
3. **Case studies** — three alternating two-column articles, 44px gap, hairline above each (and below the last). Each: a semester tag (`Spring 2024`, 4px/9px padding, 1px `rgba(22,48,92,.35)` border, navy 11px uppercase), a 34px title, a paragraph (max-width 48ch), and a row of skill chips (`#f2f2f3` fill, 5px/11px padding, 12px uppercase). Opposite side: a framed 16:10 hatch placeholder. Clients: PepsiCo (Discovery / Prototyping / Handoff), Casa de Luz (Data cleaning / Segmentation / Recommendations), CapMetro (Data analysis / Reporting).
4. **Work with MISA** — navy section, `1.2fr .8fr` grid. Left: 42px heading + paragraph (max-width 60ch). Right: a solid white "Propose a project →" button over an outlined `utmisa.corporate@gmail.com` button, both space-between at 16px/22px padding.
5. **Footer** (shared).

### 4. Gallery (`MISA Gallery.dc.html`)
1. **Hero** — "Gallery" / "Socials, workshops, banquets and everything in between."
2. **Filter bar** — 40px/24px padding, space-between. Left: five chips — "All" is a solid navy fill with white text; the rest are 1px-bordered with `#4a4d50` text and a hover that turns border and text navy (Socials, Workshops, Professional, Banquet). Right: "Fall 2025 — 24 photos" meta label.
3. **Feature photo** — a single 420px-tall framed image, full content width, with an uppercase caption below ("End-of-year banquet · Spring 2025").
4. **Masonry grid** — CSS `columns:4; column-gap:16px`, each item `break-inside:avoid; margin-bottom:16px` with a 1px border. Real photos scale to 1.04 on hover over a .5s cubic-bezier(.2,.7,.3,1); placeholders are fixed-height hatch boxes (190–260px) with mono captions naming the intended subject.
5. **Load more** — a centered outlined navy button, 14px/30px padding, that fills navy with white text on hover.
6. **Instagram band** — navy, space-between: "Tagged us?" (42px) + paragraph, and a white `@texasmisa` button.
7. **Footer** (shared).

### 5. Officers (`MISA Officers.dc.html`)
1. **Hero** — "Meet the MISA Officers" / "Thirteen students running the organization this year. Reach out to any of us."
2. **Officer grid** — one section, 56px/24px padding. Header row: "2025–26 Officer Team" (42px) with a right-aligned mono note reading "photo–name pairing to be confirmed" (delete once the real mapping is applied). Then a **10-column grid** where every card spans 2 columns and the 11th card starts at column 3 (`grid-column:3/span 2`) — this centers the trailing row of three under the two full rows of five. 20px gaps. Every card is identical (there is no separate exec-board treatment): a 1:1 framed photo that scales to 1.05 on hover, a 22px name, an 11px uppercase role in `#6f7275`, and a navy "LinkedIn →" link. Cards are `display:flex; flex-direction:column` with the link at `margin-top:auto` so links align across a row regardless of role wrapping.
   Officers in order: Brianna Zhang (President), Melinda Wang (Vice President), Sourik Sannigrahi (Project Vice President), Samantha Rendon (Junior Director President), Krish Sainath (Junior Director Vice President), Avery Wiley (Academic Director), Labeeb Kibria (Special Events Director), Romana Qureshi (Marketing Director), Emily Maldonado (Professional Development Director), Sasha Brown (Social Director), Karthik Kasa (Corporate Director), Tochi Ireh (Logistics Director), Trisha Botcha (Finance Director).
3. **Join the team** — navy band, space-between: "Want to join the team?" (42px) + paragraph about Junior Director applications reopening Fall 2026, and a white "Email an officer" button.
4. **Footer** (shared).

## Interactions & Behavior

### Scroll reveal
Elements carrying `data-reveal="1"` start at `opacity:0; transform:translateY(18px)` (or `translateX(±24px)` for alternating activity/case-study rows) and transition to `opacity:1; transform:none` over `.7s`–`.8s` — opacity `ease`, transform `cubic-bezier(.2,.7,.3,1)`. Sibling groups stagger via `transition-delay` in .04s–.05s steps.

The prototypes implement this with a throttled scroll/resize handler (80ms) that shows anything whose `getBoundingClientRect().top` is under `innerHeight * 0.94`, plus an immediate check at mount and a rAF-availability probe that reveals everything instantly if no animation frame arrives within 250ms. **Do not port this handler.** In the real app use `IntersectionObserver` (or a small hook / `framer-motion`'s `whileInView`), and make sure content is visible with JS disabled and when `prefers-reduced-motion: reduce` is set — the current prototypes do not honor that query and should.

### Gallery marquees (Homepage)
Two CSS keyframe animations, no JS. Duplicate the tile group exactly twice inside a `width:max-content` flex track; animate the track `translateX(0 → -50%)` (or the reverse) linear infinite. Each duplicated group needs a trailing padding equal to the flex gap or the loop visibly jumps. Consider pausing on hover and under `prefers-reduced-motion`.

### Hover states
- Gallery/officer photos: `transform:scale(1.04–1.05)`, .5s cubic-bezier(.2,.7,.3,1).
- Gallery filter chips: border and text go navy.
- Load more: fills navy, text goes white.
- Nav items, buttons and links have no hover defined in the prototypes — **add them**, using the navy ramp for tint and pressed states, and give every interactive element a visible `:focus-visible` ring. Define `a` / `a:hover` colors globally (navy `#16305c` → `#0d1d38`).

### Duotone treatment
Photos that read as brand imagery use `filter: grayscale(1) contrast(1.05)` on the `<img>` plus an `::after` overlay of `background:#16305c; mix-blend-mode:color` filling the frame. Officer headshots and the About mission cluster are **not** duotoned — they stay full color. Keep that distinction.

### Responsive
The prototypes are desktop-only fixed layouts; no breakpoints were authored. Mobile is undesigned — either ask for mobile mocks before shipping, or collapse every multi-column grid to a single column, reduce the page gutter from 56px to ~20–24px, step the hero h1 down from 72px to ~44–48px and section headings from 42px to ~30–32px, and let the masonry drop from 4 columns to 2 then 1. The header's absolutely centered wordmark will need a different arrangement (likely wordmark left, nav in a sheet).

## State Management
None. All five pages are static content; no client state, no data fetching in the designs. In the real app, events, projects, gallery photos and officers should come from the existing content layer (`lib/site.ts`, `lib/officers.ts`) rather than being hardcoded in the page — the prototypes hardcode them only because they are prototypes. The gallery's filter chips and Load more are presentational in the mocks and need real behavior.

## Assets
Everything lives in `uploads/` in the source project and is bundled here under `assets/`:
- **Partner logos** (full color, PNG): KPMG, pwc, ConocoPhillips, Credera.
- **Icon PNGs** (`5424107-200.png`, `5645624-200.png`, `closure.png`) — used only in the earlier exploration file, not in the five final pages.
- **Event/member photography**: the `9-21-25_MISAPhotos_MakennaMorgan-*` series (photographer Makenna Morgan, Sept 21 2025) and `IMG_4166_Original.jpg` (banquet group shot).
- **Real MISA logo**: `misa.zip - 1.png` — supplied but **not yet wired into the designs**; the header currently draws the wordmark in CSS. Use the real file.
- Hatched boxes labeled in mono type are placeholders, not assets — replace with real photography.

## Files
| File | Screen |
| --- | --- |
| `MISA Homepage.dc.html` | Homepage |
| `MISA About.dc.html` | About |
| `MISA Projects.dc.html` | Projects |
| `MISA Gallery.dc.html` | Gallery |
| `MISA Officers.dc.html` | Officers |
| `MISA Website.dc.html` | Earlier exploration — three homepage directions (1a/1b/1c) plus a second round. Reference only; direction 1b became the homepage. |
| `assets/` | All images and logos referenced above |

Each `.dc.html` opens directly in a browser. Image `src` attributes point at `uploads/…`; in this bundle the same files are in `assets/`, so either rename the folder to `uploads` or rewrite the paths when opening them locally.

## Source repo
`Texas-MISA/MISA-Website`, branch `main`. Copy, officer names and roles, mission text, FAQ answers, and the partner list were all taken verbatim from that repo's content files and the existing site inventory — treat the repo as the source of truth for wording, not these HTML files.
