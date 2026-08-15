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

export const TAGLINE = "— Where Analytics, Innovation, and Leadership Converge —";

export const MISSION =
  "MISA exists to bring together like-minded individuals who have a passion for technology and business. We equip our members with tools by going beyond the course curriculum and covering broader issues in IT. Our aim is to foster an environment that empowers students to succeed in the world outside the Forty Acres, both as professionals and as individuals.";

// ── Photography ──────────────────────────────────────────────────────────────

export type Photo = {
  src: string;
  /** Intrinsic pixel size — next/image needs it, and the masonry sizes on it. */
  width: number;
  height: number;
  alt: string;
  category: GalleryCategory;
};

export type GalleryCategory = "socials" | "workshops" | "professional" | "banquet";

/**
 * The photo manifest. One entry per file in `public/photos/`, shared by the
 * gallery, the About page clusters and the homepage marquees, so a photo is
 * described once no matter how many screens show it.
 *
 * ⚠️ The `category` values are PROVISIONAL. The shoot dates are known
 * (2025-09-21 for the `fall-*` series, the banquet for `banquet`) but the
 * events themselves were never labelled, so the gallery filter is sorting on
 * an educated guess. Re-tag these when an officer confirms what each photo is;
 * nothing else depends on the values.
 */
export const PHOTOS = {
  banquet: {
    src: "/photos/banquet-2025.jpg",
    width: 2209,
    height: 1256,
    alt: "MISA members at the end-of-year banquet",
    category: "banquet",
  },
  "fall-01": {
    src: "/photos/2025-09-21-026.jpg",
    width: 555,
    height: 766,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-02": {
    src: "/photos/2025-09-21-081.jpg",
    width: 1024,
    height: 1318,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-03": {
    src: "/photos/2025-09-21-085.jpg",
    width: 858,
    height: 1118,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-04": {
    src: "/photos/2025-09-21-090.jpg",
    width: 979,
    height: 1312,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-05": {
    src: "/photos/2025-09-21-095.jpg",
    width: 1024,
    height: 1315,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-06": {
    src: "/photos/2025-09-21-099.jpg",
    width: 1024,
    height: 1310,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-07": {
    src: "/photos/2025-09-21-115.jpg",
    width: 2253,
    height: 2718,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-08": {
    src: "/photos/2025-09-21-120.jpg",
    width: 966,
    height: 1214,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-09": {
    src: "/photos/2025-09-21-130.jpg",
    width: 908,
    height: 1165,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "fall-10": {
    src: "/photos/2025-09-21-150.jpg",
    width: 833,
    height: 1041,
    alt: "MISA members at a fall event",
    category: "socials",
  },
  "event-01": {
    src: "/photos/event-01.jpg",
    width: 975,
    height: 1192,
    alt: "MISA members at an event",
    category: "professional",
  },
  "event-02": {
    src: "/photos/event-02.jpg",
    width: 221,
    height: 376,
    alt: "MISA members at an event",
    category: "professional",
  },
} as const satisfies Record<string, Photo>;

export type PhotoId = keyof typeof PHOTOS;

/**
 * Look a photo up by id.
 *
 * Throws rather than returning undefined: a missing id is a typo in a page,
 * and a silently absent image is exactly the kind of affirmative-looking
 * absence this codebase refuses elsewhere.
 */
export function photo(id: PhotoId): Photo {
  const found = PHOTOS[id];
  if (!found) throw new Error(`unknown photo id: ${id}`);
  return found;
}

// ── Activities (home page) ───────────────────────────────────────────────────

/**
 * The four alternating rows on the home page. `caption` is what the hatched
 * placeholder box says while real photography is pending — the handoff calls
 * these out as intentional placeholders, not missing assets.
 */
export const ACTIVITIES = [
  {
    title: "Social Events",
    body: "Come and have fun with members and build a sense of community with our casual social events! We host game nights, kickbacks, IM sports, and more!",
    caption: "social event photo",
  },
  {
    title: "Technical Workshops",
    body: "Members will have the opportunity to learn skills and tools that will help them in their academic and professional careers. No prior experience is required to attend our technical workshops - everyone is welcome to join and learn something new!",
    caption: "workshop photo",
  },
  {
    title: "Professional Development",
    body: "Gain valuable knowledge and skills that will help you succeed in your future careers. Developing professional skills, such as networking, resume building, and interview skills.",
    caption: "networking night photo",
  },
  {
    title: "Leadership Opportunities",
    body: "Get involved with MISA Leadership as a Junior Director! Boost your resume while developing collaboration skills and growing professionally. Open to freshmen and sophomores of all majors! Applications will reopen Fall 2026!",
    caption: "junior director photo",
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

export const WORK_WITH_MISA =
  "Organizations bring a real problem; a student team spends a semester on it. If your team has a scoped project and someone who can meet with students regularly, we would like to hear from you.";

// ── Gallery ──────────────────────────────────────────────────────────────────

export const GALLERY_TERM = "Fall 2025";

export const GALLERY_FEATURE = {
  id: "banquet",
  caption: "End-of-year banquet · Spring 2025",
} as const;

export const GALLERY_FILTERS = [
  { value: "all", label: "All" },
  { value: "socials", label: "Socials" },
  { value: "workshops", label: "Workshops" },
  { value: "professional", label: "Professional" },
  { value: "banquet", label: "Banquet" },
] as const;

/**
 * The masonry, in display order. A slot is either a real photo or a hatched
 * placeholder naming the shot that belongs there — the handoff keeps both,
 * because an empty column reads as a bug where a labelled placeholder reads as
 * a commission.
 */
export type GalleryItem =
  | { kind: "photo"; id: PhotoId }
  | { kind: "placeholder"; caption: string; height: number; category: GalleryCategory };

export const GALLERY_ITEMS: readonly GalleryItem[] = [
  { kind: "photo", id: "fall-01" },
  { kind: "placeholder", caption: "social event photo", height: 210, category: "socials" },
  { kind: "photo", id: "fall-02" },
  { kind: "placeholder", caption: "workshop photo", height: 260, category: "workshops" },
  { kind: "photo", id: "fall-03" },
  { kind: "photo", id: "fall-04" },
  { kind: "photo", id: "fall-05" },
  { kind: "placeholder", caption: "service day photo", height: 190, category: "socials" },
  { kind: "photo", id: "fall-06" },
  { kind: "photo", id: "fall-07" },
  {
    kind: "placeholder",
    caption: "general meeting photo",
    height: 230,
    category: "professional",
  },
  { kind: "photo", id: "fall-09" },
  { kind: "photo", id: "fall-10" },
  { kind: "placeholder", caption: "IM sports photo", height: 200, category: "socials" },
  { kind: "photo", id: "event-01" },
  { kind: "placeholder", caption: "workshop photo", height: 240, category: "workshops" },
  { kind: "photo", id: "event-02" },
  { kind: "photo", id: "fall-08" },
] as const;

/** How many masonry items a page shows before "Load more". */
export const GALLERY_PAGE_SIZE = 12;

export const INSTAGRAM_PROMPT =
  "We repost member photos on Instagram. Tag @texasmisa and your shot may end up here.";

// ── Partners ─────────────────────────────────────────────────────────────────

export const PARTNERS = [
  { name: "KPMG", logo: "/partners/kpmg.png" },
  { name: "pwc", logo: "/partners/pwc.png" },
  { name: "ConocoPhillips", logo: "/partners/conocophillips.png" },
  { name: "Credera", logo: "/partners/credera.png" },
] as const;
