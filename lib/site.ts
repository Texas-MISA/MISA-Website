// Site-wide copy and content constants.
//
// Every string the public pages render lives here or in lib/officers.ts. The
// design handoff is explicit that its prototypes hardcode content only because
// they are prototypes; wording is taken from this repo, which the handoff
// names as the source of truth for copy.

export const SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/texasmisa/",
  linktree: "https://linktr.ee/txmisa",
  linkedin:
    "https://www.linkedin.com/company/management-information-systems-association-ut-austin/",
  slack:
    "https://join.slack.com/t/texas-misa/shared_invite/zt-2ypvh2ucz-sFdvOANCAQE0IYChV_nNlw",
} as const;

export const CONTACT_EMAIL = "txmisa@gmail.com";
export const CORPORATE_EMAIL = "utmisa.corporate@gmail.com";
export const INSTAGRAM_HANDLE = "@texasmisa";

export const TAGLINE =
  "— Where Analytics, Innovation, and Leadership Converge —";

export const MISSION =
  "MISA exists to bring together like-minded individuals who have a passion for technology and business. We equip our members with tools by going beyond the course curriculum and covering broader issues in IT. Our aim is to foster an environment that empowers students to succeed in the world outside the Forty Acres, both as professionals and as individuals.";

// ── Image slots ──────────────────────────────────────────────────────────────

// 🔓 **THE SITE PUBLISHES REAL PHOTOGRAPHS. The no-photography decision is
// OVER** (officer, 2026-08-19). `public/photos/` is COMMITTED — 126 web-sized
// images, tracked in git — and the `src` values below point at files that ship.
//
// ⚠️ **This block used to say the opposite, and the correction is the point.**
// Until v2 phase 2 it read "the published site still has no photography" and
// "`public/photos/` is gitignored, so a clone, a CI run and a Vercel deploy all
// still render placeholders." All of that was true when written on 2026-08-14
// and none of it is true now. A comment describing a decision that has been
// reversed is worse than no comment: the next reader plans around it.
//
// 🔴 **The irreversible half, which has NOT changed.** The repository is public
// and every one of these is an identifiable student. A face in a public git
// history is not something a later commit takes back — `git rm` removes it from
// the tip and leaves it in every clone and every previous commit. **If a member
// asks to be removed, that is a history rewrite and a force-push, not a
// delete**, and it still does not reach forks or caches. The full note lives in
// `.gitignore`, next to the line that stopped ignoring them.
//
// 📌 A file under `public/` is fetchable at its own URL whether or not a page
// links it. Adding a photograph here publishes it even if no slot points at it.
//
// 📌 **A slot renders a photograph or a labelled `<Hatch>`, never a hole**, and
// `components/ui/photo-slot.tsx` is the single place that swap happens. Giving a
// slot a `src` is the whole of "put it on the site"; leaving `src` unset is a
// deliberate, visible placeholder. Two families of slot are still deliberately
// placeholder-only, for a reason photography does not answer:
//
//   - **Officer headshots** — the photo-to-name pairing was never supplied, and
//     a real face under another real student's name is worse than an empty
//     square. `Officer` has no `photo` field.
//   - **Project cells** — pairing a photograph to a named client is a factual
//     claim about the club that nobody made.
//
// ⚠️ The design handoff's README carries a duotone treatment spec
// (`grayscale(1) contrast(1.05)` plus a navy `mix-blend-mode: color`), with
// officer headshots and the About mission cluster as its full-colour
// exceptions. **Nothing on the site applies it today** — the photographs render
// untreated. That is a live option, not an oversight.
//
// 🪤 Size every framed slot with next/image's `fill`, which is what `PhotoSlot`
// does. An intrinsically sized <img> makes the frame grow to the photo's own
// height, and the About history portrait then leaves a large void beside the
// column next to it — the handoff hit this in its own prototype.

// ── Home page slots (hero + mission) ─────────────────────────────────────────

/** One image slot: what belongs there, and what is actually in it. */
export type ImageSlot = {
  /** The shot that belongs here. Shown by `<Hatch>` while `src` is unset. */
  caption: string;
  /** Web-sized derivative under `public/photos/`. Unset = placeholder. */
  src?: string;
  /**
   * ⚠️ Describes the PHOTOGRAPH, not the slot. `caption` names the shot that
   * was wanted; `alt` names the one that actually landed, and the two are
   * allowed to disagree. Alt text describing a different event than the image
   * on screen is worse than no alt text at all.
   */
  alt?: string;
};

/**
 * 🔓 NEW in the v2 redesign, phase 1: the hero and the mission used to carry
 * **zero** image slots between them while the marquee band carried eleven, and
 * concentrating the slots into one band is the single thing v1 was most clearly
 * scrapped for. §4.8 wants slots in every section.
 *
 * ⚠️ The CAPTIONS come from a FIXED vocabulary — chapter, member, general
 * meeting, workshop, social event, service day, networking night, banquet,
 * junior director, project. A caption names a shot, so an invented one ("case
 * competition photo") would assert an activity the club has not told us it runs
 * — the same failure as inventing a fact about the club, wearing a
 * placeholder's clothes. The vocabulary used to be anchored to `GALLERY_ITEMS`,
 * which was deleted in v2 phase 2; the list above is now the whole of it.
 *
 * 📌 Content only. Aspect ratio, position and stacking order are composition and
 * live with the component, the same way `ACTIVITIES[].caption` is content while
 * `activities.tsx` owns the layout.
 *
 * ✂️ This comment used to say the photographs were local-only and gitignored.
 * They were committed on 2026-08-19 and they ship. See the block at the top of
 * this file, and `.gitignore` for the half of that decision that cannot be
 * undone by a later commit.
 *
 * ⚠️ **The pairings below are inferred from the photographs, not supplied.**
 * Nobody said which event each frame is from; the alt text is a careful reading
 * of what is visible. This is the milder cousin of the officer-headshot problem
 * — a wrong name against a real face — and it wants an officer's eye before it
 * goes anywhere public.
 */
export const HERO_SLOTS: readonly ImageSlot[] = [
  // The wide plate above the pair. 🔓 Was two plates side by side up here
  // (officer, 2026-08-19); the second one was dropped and this one grew into
  // the space. It is the LCP candidate, so it is the one that gets `priority`.
  {
    caption: "chapter photo",
    src: "/photos/home/homepage-top-main.jpg",
    alt: "MISA members holding balloon letters spelling MISA at a chapter celebration",
  },
  // The pair below, unchanged.
  {
    caption: "workshop photo",
    src: "/photos/home/homepage-top-2.jpg",
    alt: "MISA members at a general meeting in a lecture hall",
  },
  {
    caption: "banquet photo",
    src: "/photos/home/homepage-top-3.jpg",
    alt: "MISA members in formal dress at the banquet",
  },
];

/** The two plates flanking the mission statement. */
export const MISSION_SLOTS: readonly ImageSlot[] = [
  {
    caption: "member photo",
    src: "/photos/home/mission-1.jpg",
    alt: "MISA members gathered on the steps for a chapter photo",
  },
  {
    caption: "service day photo",
    src: "/photos/home/mission-2.jpg",
    alt: "MISA members outside the UT Tower at dusk",
  },
];

// ── About page slots ─────────────────────────────────────────────────────────

/**
 * 🔓 NEW in v2 phase 2. `/about` carried six `<Hatch>` placeholders and one
 * page-local `BAND` array of captions hardcoded into the page file; both are
 * replaced by this, so every About slot now goes through `PhotoSlot` and has a
 * restore path in the one place the swap is supposed to happen.
 *
 * ⚠️ **THE PAIRINGS ARE INFERRED FROM THE PHOTOGRAPHS, NOT SUPPLIED**, exactly
 * as `HERO_SLOTS`' are. Nobody said which event any frame is from. The alt text
 * below is a careful reading of what is actually visible in each image and
 * deliberately asserts **no date, no term and no person** — where a screen or a
 * jersey in the frame states the occasion, the alt says so; where it does not,
 * the alt describes the scene and stops. This wants an officer's eye before it
 * is treated as a record. The slot-to-filename table is in the phase 2 handback.
 *
 * 📌 Content only. Every frame's SHAPE is set by the page, not by the file:
 * `PhotoSlot` renders `fill` + `object-cover` into a ratio the composition
 * chooses, so the pool's mix of 3:4 and 4:3 originals does not leak into the
 * layout. Swapping any `src` below for another file needs no layout change.
 */
export const ABOUT_MISSION_SLOTS: readonly ImageSlot[] = [
  {
    caption: "chapter photo",
    src: "/photos/gallery/misa-banquet-group-photo.jpg",
    alt: "A large group of MISA members in formal dress at a chapter celebration",
  },
  {
    caption: "general meeting photo",
    src: "/photos/gallery/11-6-25-misa-makenna-morgan-06.jpg",
    alt: "MISA members seated together in a lecture hall at a general meeting",
  },
];

/** The portrait beside the history timeline. Portrait-shaped in the original. */
export const ABOUT_HISTORY_SLOT: ImageSlot = {
  caption: "member photo",
  src: "/photos/gallery/9-21-25-misaphotos-makennamorgan-075.jpg",
  alt: "Four MISA members in professional dress on the steps of a campus building",
};

/**
 * The full-bleed band. Four frames, one row, edge to edge.
 *
 * 📌 The four are chosen to be four DIFFERENT kinds of evening — outdoors, a
 * game night, a panel, intramural sport — because the band's whole job is to
 * show the range the copy above it describes. Four photographs of the same room
 * would be a wall, not a band.
 */
export const ABOUT_BAND_SLOTS: readonly ImageSlot[] = [
  {
    caption: "social event photo",
    src: "/photos/gallery/100-1253.jpg",
    alt: "MISA members sitting on a blanket on the lawn at an outdoor social",
  },
  {
    caption: "social event photo",
    src: "/photos/gallery/img-9880.jpg",
    alt: "MISA members posing in front of a screen reading MISA Family Feud at a game night",
  },
  {
    caption: "general meeting photo",
    src: "/photos/gallery/20241015-180617.jpg",
    alt: "MISA members seated in a classroom in front of a slide introducing a panel",
  },
  {
    caption: "social event photo",
    src: "/photos/gallery/img-2848.jpg",
    alt: "A MISA intramural basketball team lined up on an indoor court",
  },
];

// ── Contact page slot ────────────────────────────────────────────────────────

/**
 * 🔓 NEW in v2 phase 2, and it is the one slot on this page.
 *
 * `/contact` had **zero** image slots and zero motion — the only public page
 * with neither, and §4.8 is blunt that a text-only page "is not minimalism, it
 * is incomplete work". One photograph is the whole fix; a page whose job is
 * "come talk to us" should show the people saying it.
 */
export const CONTACT_SLOT: ImageSlot = {
  caption: "social event photo",
  src: "/photos/gallery/20260411-103131-295ec3.jpg",
  alt: "A group of MISA members outdoors on a covered deck at a chapter outing",
};

// ── Activities (home page) ───────────────────────────────────────────────────

/**
 * The four bento cells on the home page, IN RENDER ORDER.
 *
 * 🔓 **The order is the layout** (officer, 2026-08-19): Leadership top-left
 * (small), Professional Development top-right (large), Social Events
 * bottom-left (large), Technical Workshops bottom-right (small). This array
 * and `CELLS` in `components/ui/activities.tsx` are read in lockstep by index,
 * so re-ordering here without re-ordering there silently swaps which activity
 * gets which cell size.
 *
 * ⚠️ Two of the images are a poor fit for the cell they were assigned, and it
 * is worth knowing before someone calls the crop a bug. `tech-workshops` is a
 * 2.14 panorama in a 1.33 cell, so `object-cover` discards roughly half its
 * width; `social-events` is 1.33 in a 2.33 cell. The two would suit each
 * other's cell almost exactly. Assigned as instructed; swapping them is one
 * edit to `CELLS`.
 *
 * `caption` is what the `<Hatch>` says while a slot is empty; `alt` describes
 * the photograph that actually landed. They are allowed to disagree.
 */
export const ACTIVITIES = [
  {
    title: "Leadership Opportunities",
    body: "Get involved with MISA Leadership as a Junior Director! Boost your resume while developing collaboration skills and growing professionally. Open to freshmen and sophomores of all majors! Applications will reopen Fall 2026!",
    caption: "junior director photo",
    src: "/photos/home/leadership-opp.jpg",
    alt: "A MISA member leading a session in a full lecture hall",
  },
  {
    title: "Professional Development",
    body: "Gain valuable knowledge and skills that will help you succeed in your future careers. Developing professional skills, such as networking, resume building, and interview skills.",
    caption: "networking night photo",
    src: "/photos/home/professional-dev.jpg",
    alt: "MISA members at the Fall Frenzy case competition",
  },
  {
    title: "Social Events",
    body: "Come and have fun with members and build a sense of community with our casual social events! We host game nights, kickbacks, IM sports, and more!",
    caption: "social event photo",
    src: "/photos/home/social-events.jpg",
    alt: "MISA members at an evening social",
  },
  {
    title: "Technical Workshops",
    body: "Members will have the opportunity to learn skills and tools that will help them in their academic and professional careers. No prior experience is required to attend our technical workshops - everyone is welcome to join and learn something new!",
    caption: "workshop photo",
    src: "/photos/home/tech-workshops.jpg",
    alt: "MISA members working on laptops during a technical workshop",
  },
] as const;

// ── About ────────────────────────────────────────────────────────────────────

export const HISTORY_CARDS = [
  {
    eyebrow: "Who we are",
    body: "The Management Information Systems Association is a professional, academic, philanthropic and social organization. MISA unites a diverse community of individuals who have a passion for combining technology with business and often pursue careers in Information Technology. Each semester MISA holds various activities that are designed to expose students to professional opportunities, expand their technological skills, and meet other like-minded individuals.",
  },
  {
    eyebrow: "Growth",
    body: "Originally founded in 1982, MISA was re-established in 2009 and has experienced rapid growth. In the past two years alone, MISA membership grew by 250% and attracted various majors from MIS, Computer Science, Engineering, and Natural Sciences.",
  },
] as const;

export type Stat = { value: string; label: string };

export const HISTORY_STATS: readonly Stat[] = [
  { value: "1982", label: "Founded" },
  { value: "2009", label: "Re-established" },
  { value: "250%", label: "Membership growth" },
];

/**
 * Six questions, in the handoff's two-column reading order: the `<dl>` fills
 * left-to-right, so the pairs here are the rows on screen.
 *
 * The seventh question the old page carried — "What kinds of projects has MISA
 * worked on in the past?" — is not lost: its answer is PROJECTS_INTRO below,
 * which is where the handoff moved it.
 */
export const FAQ = [
  {
    q: "What is MISA?",
    a: "MISA is the premier IT organization within McCombs, which functions to build a community that is interested in technology and business. In addition to connecting students - mainly MIS majors - the organization also works to connect companies with students regarding post-graduate opportunities.",
  },
  {
    q: "Who can become a MISA member?",
    a: "Anyone! We accept all majors & years! In order to be a member, the only requirement is being a UT student and paying dues. We welcome anyone to be a member, but having an interest in technology is recommended.",
  },
  {
    q: "What is the dress code for meetings?",
    a: "There is none! Like every major technology organization out there, we care more about what you do than what you wear. As such, unless it's an off-campus dinner where business casual is recommended, you are welcome to wear what you would like.",
  },
  {
    q: "Why should I be a part of MISA?",
    a: "Joining MISA is a great way to meet people that have similar interests as you and participate in a variety of activities. As a well-rounded organization, MISA hosts socials, academic workshops, service days, and professional networking events. Regardless of whether you want to learn about different career opportunities, go out and give back to the community, or hang out with a group of fun-loving individuals - we guarantee that MISA has something to offer.",
  },
  {
    q: "How do I know if MISA is right for me?",
    a: "You are free to contact any of our officers via email, Instagram, slack, or in person if you have any questions about MISA. But, of course, the best way for you to see if we are right for you is to attend a meeting! Membership is not required for you to attend any of our meetings, so you are welcome to come and see if MISA would be worthwhile for you.",
  },
  {
    q: "What can I expect at a MISA event?",
    a: "That depends on the event. At General Meetings, you can expect a company presentation along with a fun activity with food. At socials, you can expect a variety of games (video games, board games, or card games) to be played. Service events usually entail cleaning up a creek around Austin, so be ready to get your hands dirty. Workshops are similar to class lectures in that you are taught a hard skill over the course of the event and are given hands-on experience with technology.",
  },
] as const;

// ── Projects ─────────────────────────────────────────────────────────────────

export const PROJECT_STATS: readonly Stat[] = [
  { value: "3", label: "Data teams" },
  { value: "3", label: "Client teams" },
  { value: "1 sem", label: "Project length" },
  { value: "All", label: "Majors welcome" },
];

/** The /projects intro — verbatim the answer the About FAQ used to carry. */
export const PROJECTS_INTRO =
  "In Spring 2024, MISA introduced student driven projects. In these, student teams collaborated on real-world consulting projects with major organizations including PepsiCo, CapMetro, and several local Austin businesses. These projects allowed members to apply their technical, analytical, and business skills to address real client challenges. Through these experiences, students gained hands-on exposure to consulting, project management, and cross-functional teamwork, preparing them for careers at the intersection of technology and business strategy.";

/** The shorter version, on the home page's navy projects band. */
export const PROJECTS_SUMMARY =
  "Student teams collaborate on real-world consulting projects with major organizations including PepsiCo, CapMetro, and several local Austin businesses — hands-on exposure to consulting, project management, and cross-functional teamwork.";

export const PROJECTS = [
  {
    client: "PepsiCo",
    term: "Spring 2024",
    /** One line, for the home page card. */
    summary: "Facility and corporate communication tool.",
    body: "A facility and corporate communication tool, scoped and prototyped with the client team over a single semester. Students ran discovery with facility staff, mapped the existing communication flow, and delivered a working prototype and handoff documentation.",
    skills: ["Discovery", "Prototyping", "Handoff"],
    caption: "project photo / product shot",
  },
  {
    client: "Casa de Luz",
    term: "Spring 2024",
    summary: "Customer engagement and marketing analysis.",
    body: "Customer engagement and marketing analysis for the Austin restaurant. The team gathered and cleaned customer data, segmented the audience, and returned a set of concrete marketing recommendations the owners could act on.",
    skills: ["Data cleaning", "Segmentation", "Recommendations"],
    caption: "project photo / dashboard shot",
  },
  {
    client: "CapMetro",
    term: "Spring 2024",
    summary: "Transit data analysis for an Austin agency.",
    body: "Transit data analysis with Austin's public transportation agency — turning operational data into reporting that non-technical stakeholders could read and use.",
    skills: ["Data analysis", "Reporting"],
    caption: "project photo / report shot",
  },
] as const;

/**
 * 🔴 **A PLACEHOLDER, not a project. Replace it with a real one.**
 *
 * The home page's projects band is laid out as a symmetric 2×2 (officer's
 * call, 2026-08-17) and `PROJECTS` holds three. This fills the fourth cell
 * until a fourth project exists.
 *
 * ⚠️ It deliberately names no client, no term and no scope. A plausible-looking
 * fourth client would be **inventing a fact about the club**, which is the one
 * thing no page here may do — and unlike a wrong colour, nobody would ever spot
 * it. So it reads as an empty commission in the same voice `<Hatch>` uses for a
 * photograph that has not been taken: labelled, obviously pending, and useless
 * to anyone trying to mistake it for a real engagement.
 *
 * 📌 Swapping it out is deleting this constant and adding a fourth entry to
 * `PROJECTS`; the band renders whatever the array holds and needs no change.
 */
export const PROJECT_PLACEHOLDER = {
  term: "Term to be confirmed",
  client: "Fourth project",
  summary: "Client and scope to be added.",
  caption: "project photo / fourth project",
} as const;

export const WORK_WITH_MISA =
  "Organizations bring a real problem; a student team spends a semester on it. If your team has a scoped project and someone who can meet with students regularly, we would like to hear from you.";

// ── Gallery ──────────────────────────────────────────────────────────────────

// ✂️ **The gallery's placeholder data was DELETED in v2 phase 2**, and what it
// was is worth recording so nobody rebuilds it. `GALLERY_ITEMS` was eighteen
// `{caption, height, category}` objects; `GALLERY_FILTERS` was five filter
// chips; `GALLERY_FEATURE` was a single large slot; `GALLERY_TERM` was the
// string `"Fall 2025"`. Two types, `Slot` and `GalleryCategory`, existed only to
// hold them up.
//
// 🔴 **All of it described photographs that did not exist.** The eighteen
// heights were a composition, not measurements. The categories were flagged in
// this file as "a statement of intent rather than a record", and the filter
// sorted on them. `GALLERY_FEATURE`'s caption asserted an end-of-year banquet in
// Spring 2025 and `GALLERY_TERM` asserted Fall 2025 — two dates about the club
// that nobody supplied.
//
// 🔓 `/gallery` now renders the **real pool**: whatever `scripts/build-photos.mjs`
// has written into `public/photos/gallery/`, read at build time by
// `lib/gallery-photos.ts`. There is nothing to keep here, because a real
// photograph brings its own caption and its own size. **Do not reintroduce a
// category filter without a real mapping from file to category** — inventing one
// is the same failure wearing a filter bar.

/** How many photographs the gallery shows before "Load more". */
// 📌 Raised from 12 in v2 phase 2. Twelve was sized against eighteen
// placeholders; against 117 real photographs it is ten clicks to the end.
export const GALLERY_PAGE_SIZE = 24;

export const INSTAGRAM_PROMPT =
  "We repost member photos on Instagram. Tag @texasmisa and your shot may end up here.";

// ── Partners ─────────────────────────────────────────────────────────────────

export const PARTNERS = [
  { name: "KPMG", logo: "/partners/kpmg.png" },
  { name: "pwc", logo: "/partners/pwc.png" },
  { name: "ConocoPhillips", logo: "/partners/conocophillips.png" },
  { name: "Credera", logo: "/partners/credera.png" },
] as const;
