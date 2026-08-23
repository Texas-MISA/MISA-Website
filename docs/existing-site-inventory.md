# Existing site inventory — txmisa.org

> ⚠️ **SUPERSEDED AS A DESIGN REFERENCE, 2026-08-14 (doc v1.58).** The public
> pages now follow the design handoff in
> `docs/Texas MISA website UI mockups/design_handoff_misa_website/`, which
> replaces the Squarespace look wholesale: navy `#16305c` on white instead of
> periwinkle `#7286AB`, Barlow + Barlow Condensed instead of Poppins/Roboto
> Slab, square corners, hairline borders, real photography and real partner
> logos. **This file remains the record of what the ORIGINAL site said and
> did** — the copy inventory below is still where the wording came from, and
> the handoff names this repo as the source of truth for wording — but the
> design language section describes a site that no longer exists.
>
> **EVERY image on the site is a placeholder as of v1.59**, which is a
> decision rather than a backlog. Photography was committed with the overhaul
> and removed the same day on the officer's instruction; `public/photos/` was
> **deleted**, not merely unlinked, because a file under `public/` stays
> fetchable at its URL whether or not a page references it. Every slot renders
> a hatched box captioned with the shot that belongs there.
>
> **The one exception:** the four partner logos in `public/partners/`, which
> are the only images the site serves.
>
> **Also still outstanding:**
> - Officer headshots carry a *second*, independent blocker — the handoff
>   ships them but its README flags the photo-to-name pairing as never
>   supplied, so restoring photography does not by itself unblock these.
> - The real MISA logo. The handoff's README names `misa.zip - 1.png` but it
>   is **not in the bundle**, so the header wordmark is still drawn in CSS.
> - The contact form backend. `/contact` still renders a disabled form, and
>   the page is no longer linked from the desktop nav.

Surveyed 2026-07-30 from https://www.txmisa.org/ (Squarespace). This records
what the current site contains and how it looks, as the reference for the
recreated pages in this repo. The recreation is deliberately faithful-but-
approximate: same structure, same copy, similar design language, with
placeholders wherever the original uses photography or partner logo images
(no image assets were copied — photos of real people and trademarked logos
don't belong in a public repo without permission).

## Site map

| Page | Original path | Recreated at |
|---|---|---|
| Home | `/` | `/` |
| About Us | `/about-us-1` | `/about` |
| Gallery | `/gallery` | `/gallery` |
| Officers | `/officers` | `/officers` |
| Projects | `/general-2` | `/projects` |
| Contact Us | `/contact-us` | `/contact` |

(Original slugs are Squarespace artifacts; the recreation uses clean paths.)

## Design language

- **Header:** sticky slate-blue bar (`≈ #7286AB`), thin black rule beneath.
  Left: nav links (small geometric sans; active page underlined). Center:
  white lowercase "misa" wordmark with a robot-antenna dot over the *i* and
  letterspaced "TEXAS" beneath. Right: four icon links — Instagram, Linktree
  (generic chain icon), LinkedIn, Slack (generic chain icon).
- **Type:** headings are a heavy slab/Clarendon-style serif; body and nav are
  a geometric sans (Poppins-like). Recreated with Roboto Slab + Poppins.
- **Colors:** slate blue `#7286AB`, near-black text on white, light-gray
  section panels (`≈ #F4F4F2`), pure-black hero on home.
- **Shapes:** hero sections end in a shallow downward chevron (V-notch) edge.
  Buttons are solid slate-blue **ovals** (fully rounded, uppercase label).
- **Motifs:** an infinitely scrolling "TEXAS MISA" text marquee on home; a
  partner-logo carousel with prev/next arrows (8 slides, some empty "New List
  Item" placeholders — carousel replaced with a static strip in the
  recreation).
- **Footer:** white, centered: About · LinkedIn · LinkTree links, then
  `txmisa@gmail.com`. Thick black rule above.

## Social / external links

- Instagram: https://www.instagram.com/texasmisa/
- Linktree: https://linktr.ee/txmisa
- LinkedIn: https://www.linkedin.com/company/management-information-systems-association-ut-austin/
- Slack invite: https://join.slack.com/t/texas-misa/shared_invite/zt-2ypvh2ucz-sFdvOANCAQE0IYChV_nNlw
- Emails: `txmisa@gmail.com` (general), `utmisa.corporate@gmail.com` (corporate relations)

## Page-by-page

### Home `/`
1. Black hero: "Management Information Systems Association" + italic tagline
   "— Where Analytics, Innovation, and Leadership Converge —".
2. Four pillars (2×2 / 4-up): Social Events, Technical Workshops,
   Professional Development, Leadership Opportunities — serif heading + short
   sans paragraph each. (Leadership copy: JD applications reopen Fall 2026.)
3. "TEXAS MISA" scrolling marquee band.
4. "Our Mission:" heading + mission paragraph.
5. "Our Amazing Partners" logo carousel — PWC, KPMG, Credera (+ empty slides).
6. "Meet the MISA Officers!" — full 13-officer grid: circular photo, serif
   name, role. (No LinkedIn buttons on home.)
7. Footer.

**Recreation note:** the rebuilt home page keeps this repo's live
**Upcoming events** section (published events from Supabase) — it is the
Stage 2 exit criterion and the reason this site exists. The original has no
events listing.

### About Us `/about`
1. Light-gray chevron hero: "About Us" + "Connecting technology with business."
2. Same four pillars as home.
3. "Mission" (slate-blue serif heading) + mission paragraph.
4. "History of MISA" — two paragraphs (professional/academic/philanthropic/
   social; founded 1982, re-established 2009, 250% growth, majors from MIS,
   CS, Engineering, Natural Sciences).
5. Partners carousel (KPMG, PWC, ConocoPhillips, Credera).
6. FAQ — seven Q&As, bold uppercase questions, plain text answers (not an
   accordion): What is MISA / Why join / Dress code / What to expect at an
   event / Is MISA right for me / Past projects / Who can be a member.

### Gallery `/gallery`
Masonry-style photo grid (event photos, mixed aspect ratios), no text at all.
Recreated as a placeholder-tile grid to be filled with real photos later.

### Officers `/officers`
"Meet the MISA Officers!" + 3-column grid of light-gray cards: circular
photo, serif name, role, oval slate-blue LINKEDIN button.

⚠️ **THE ROSTER BELOW IS THE ONE THIS SITE WAS BUILT FROM, AND IT IS NO LONGER
CURRENT.** The live page turned over and `lib/officers.ts` was replaced wholesale
on 2026-08-23 — six new people, seven returning in different roles, six gone, and
two new roles (Client Project Lead, Data Project Lead) replacing Project Vice
President and Junior Director Vice President. This file is an **inventory of what
was reproduced**, so the table is kept as the record of that; **read
`lib/officers.ts` for who the officers are.**

📌 Two things worth carrying forward from the comparison. The old page gave every
officer a LinkedIn URL and **the new one gives none** — only MISA's company page
— which is why `Officer.linkedin` is optional and why the seven returning
officers' URLs were carried over from this table rather than re-scraped. And the
new page supplies the **photo-to-name pairing** this one never did, which is what
unblocked the headshots.

| Name | Role | LinkedIn |
|---|---|---|
| Brianna Zhang | President | linkedin.com/in/briannazhang85 |
| Melinda Wang | Vice President | linkedin.com/in/melindapwang |
| Sourik Sannigrahi | Project Vice President | linkedin.com/in/souriksannigrahi |
| Samantha Rendon | Junior Director President | linkedin.com/in/samantha-rendon-7a6344264 |
| Krish Sainath | Junior Director Vice President | linkedin.com/in/krishsainath |
| Avery Wiley | Academic Director | linkedin.com/in/averywiley |
| Labeeb Kibria | Special Events Director | linkedin.com/in/labeeb-kibria |
| Romana Qureshi | Marketing Director | linkedin.com/in/romanaq |
| Emily Maldonado | Professional Development Director | linkedin.com/in/emmaldonado |
| Sasha Brown | Social Director | linkedin.com/in/sashabrown3 |
| Karthik Kasa | Corporate Director | linkedin.com/in/kkasa |
| Tochi Ireh | Logistics Director | linkedin.com/in/tochukwu-ireh |
| Trisha Botcha | Finance Director | linkedin.com/in/trisha-botcha |

(URLs cleaned of LinkedIn tracking parameters; Romana's original href was an
edit-mode URL, corrected to the public profile.)

### Projects `/projects`
1. Chevron hero: "Projects" + "Turning Classroom Knowledge into Real-World
   Impact."
2. "Past & Current Projects" — two cards (photo, serif title, paragraph):
   **PepsiCo** (facility/corporate communication tool) and **Casa de Luz**
   (customer engagement & marketing analysis for the Austin restaurant).

### Contact Us `/contact`
1. "Contact Us!" + intro sentence.
2. Left column: Email / Instagram DM / Corporate Relations contact blocks.
3. Right column: Squarespace form — First Name, Last Name, Email, Message
   (all required), oval SEND button. **Recreation renders the form but leaves
   it un-wired** (no backend yet); a note points to email instead. Wire it up
   later via a Server Action if wanted.

## Deliberately not recreated

- Real photography (officers, gallery, projects) and partner logo images —
  placeholders instead; drop real assets into `public/` later.
- The partner **carousel** mechanics and empty "New List Item" slides — static
  strip instead.
- Squarespace form backend, cookie banner, and Squarespace-injected scripts.
