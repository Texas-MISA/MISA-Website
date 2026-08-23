// Officer roster.
//
// 🔓 **Replaced wholesale on 2026-08-23** from the officer's saved copy of the
// live Squarespace page (`pictures/Officers — ….html`, gitignored). It is a full
// turnover: six of the thirteen are new, seven returned in different roles, and
// six people left. Two roles are new too — **Client Project Lead** and **Data
// Project Lead** replace the old Project Vice President and Junior Director Vice
// President.
//
// 🪤 **HOW THE NAME→PHOTO PAIRING WAS ESTABLISHED, because getting it wrong is
// the one failure this file has always been written to prevent.** The saved page
// is a Squarespace fluid-engine grid: the image, the name and the role are three
// SIBLING blocks whose DOM order does not match what a reader sees, positioned
// only by `grid-area` rules in a `<style>` tag. So the pairing was read off the
// geometry — for each name, the image directly above it in the same column band
// and the role directly below — not off document order, and then checked by eye
// against a rendered contact sheet. The `alt` attribute was empty on all
// fourteen images and gave no help.
//
// 🔴 **`photo` is optional and `<Hatch>` is still the correct rendering when it
// is absent.** The old rule was that headshots stay placeholders because the
// handoff never supplied the photo-to-name pairing; the officer has now supplied
// it, so the rule is satisfied rather than waived. Where it is STILL not
// supplied — see Daniel Chen and Sanya Pillai below — the placeholder stands.
//
// ⚠️ **`linkedin` is optional, and that is a fact about the new page, not an
// omission here.** The updated page carries no per-officer LinkedIn links at all
// — only MISA's own company page. The seven returning officers keep the URLs the
// previous roster had, because those identify the same people; the six new
// officers have none, and inventing a plausible one would point a public link at
// a stranger. `OfficerCard` renders the link only when it exists.

export type Officer = {
  name: string;
  role: string;
  /** Profile URL. Absent for officers the roster has never carried one for. */
  linkedin?: string;
  /** Web-sized headshot under `public/photos/officers/`. Absent = `<Hatch>`. */
  photo?: string;
};

export const OFFICERS: Officer[] = [
  {
    name: "Labeeb Kibria",
    role: "President",
    linkedin: "https://www.linkedin.com/in/labeeb-kibria/",
    photo: "/photos/officers/labeeb-kibria.jpg",
  },
  {
    name: "Romana Qureshi",
    role: "Vice President",
    linkedin: "https://www.linkedin.com/in/romanaq/",
    photo: "/photos/officers/romana-qureshi.jpg",
  },
  {
    name: "Tochi Ireh",
    role: "Junior Director President",
    linkedin: "https://www.linkedin.com/in/tochukwu-ireh/",
    photo: "/photos/officers/tochi-ireh.jpg",
  },
  {
    name: "Karthik Kasa",
    role: "Data Project Lead",
    linkedin: "https://www.linkedin.com/in/kkasa/",
    photo: "/photos/officers/karthik-kasa.jpg",
  },
  {
    name: "Avery Wiley",
    role: "Client Project Lead",
    linkedin: "https://www.linkedin.com/in/averywiley/",
    photo: "/photos/officers/avery-wiley.jpg",
  },
  // 🔴 **NO PHOTO, DELIBERATELY — and this is the one entry to read before
  // "fixing" it.** The saved page shows the SAME image file
  // (`headshot+updated.JPG`, one asset referenced twice) on both Daniel Chen's
  // card and Sanya Pillai's. One of those two is right and the source gives no
  // way to tell which: the alt text is empty, the uuid is identical, and there
  // is no third photograph of either person. Shipping it under both names would
  // put a real student's face under another real student's name, which is the
  // exact failure this file has been written against since it was created — so
  // both render the labelled placeholder until an officer says whose it is.
  //
  // 📌 Fixing it is two lines: copy
  // `pictures/Officers — …_files/headshot+updated.JPG` to
  // `pictures/officers/<name-slug>.JPG`, run `node scripts/build-photos.mjs`,
  // and add the `photo` key to whichever of the two it belongs to.
  { name: "Daniel Chen", role: "Logistics Director" },
  {
    name: "Shreya Venkatachalam",
    role: "Special Events Director",
    photo: "/photos/officers/shreya-venkatachalam.jpg",
  },
  {
    name: "Jayla Nguyen",
    role: "Marketing Director",
    photo: "/photos/officers/jayla-nguyen.jpg",
  },
  {
    name: "Trisha Botcha",
    role: "Corporate Director",
    linkedin: "https://www.linkedin.com/in/trisha-botcha/",
    photo: "/photos/officers/trisha-botcha.jpg",
  },
  {
    name: "Sasha Brown",
    role: "Professional Development Director",
    linkedin: "https://www.linkedin.com/in/sashabrown3/",
    photo: "/photos/officers/sasha-brown.jpg",
  },
  {
    name: "Lucas San Jose",
    role: "Social Director",
    photo: "/photos/officers/lucas-san-jose.jpg",
  },
  // 🔴 See the Daniel Chen note above — same shared photograph, same reason.
  { name: "Sanya Pillai", role: "Academic Director" },
  {
    name: "Kayana Rajan",
    role: "Finance Director",
    photo: "/photos/officers/kayana-rajan.jpg",
  },
];

// `initials()` lived here until the UI overhaul, for the Stage 2 card that
// drew a circle of initials where a headshot would go. The redesigned card
// shows a framed hatched placeholder instead — a labelled empty slot, which is
// what the design handoff asks for — so nothing called it any more.
