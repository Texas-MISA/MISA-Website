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
// it, so the rule is satisfied rather than waived. All thirteen carry one as of
// 2026-08-23; `photo` stays optional because the NEXT officer will not, and the
// placeholder is what they must get rather than somebody else's face.
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

/**
 * 🔓 **TEMPORARY (officer, 2026-08-23): every per-officer LinkedIn link is
 * HIDDEN.** Flip this to `true` to bring them all back — that is the whole of
 * it, and it is the only switch.
 *
 * 📌 **The URLs are deliberately still in the data below.** Hiding is a render
 * decision; deleting seven real profile URLs would mean re-sourcing them from
 * a page that, as the note above records, no longer carries per-officer links
 * at all. Nothing is lost while this is off.
 *
 * 🪤 **Layout is already safe either way.** `OfficerCard` has always rendered
 * the link conditionally — six of thirteen officers never had one — and it
 * carries a `mt-auto` spacer precisely so a card without a link keeps the same
 * shape. Turning every link off exercises a path that was already live on
 * nearly half the grid.
 *
 * 📌 MISA's OWN LinkedIn (the company page in `lib/site.ts`, linked from the
 * footer) is untouched. This is about individual people's profiles.
 */
export const SHOW_OFFICER_LINKEDIN = false;

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
  // ✅ **RESOLVED 2026-08-23 BY THE OFFICER, and the way it was resolved is the
  // point.** The saved page showed the SAME image file (`headshot+updated.JPG`,
  // one asset referenced twice) on both this card and Sanya Pillai's, with an
  // empty alt and an identical uuid — so the source could not say which of the
  // two it was, and both rendered the placeholder rather than risk putting a
  // real student's face under another real student's name.
  //
  // The officer settled it out of band, by renaming the file to `daniel chen`
  // in the saved export. That is the attribution the rule was waiting for: it
  // did not come from the page, it came from someone who knows.
  //
  // 🔴 **Which means Sanya Pillai keeps her placeholder, and NOT because the
  // question is still open.** It is now answered, and the answer is that this
  // photograph is not hers. Do not copy it onto her entry.
  {
    name: "Daniel Chen",
    role: "Logistics Director",
    photo: "/photos/officers/daniel-chen.jpg",
  },
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
  // ✅ **SUPPLIED 2026-08-23, and by the route this comment asked for.** The
  // note that stood here said the placeholder would stand until someone added
  // a real file to `pictures/officers/sanya-pillai.<ext>` — *not* by reusing
  // the shared photograph attributed to Daniel Chen. The officer supplied a
  // genuine, different photograph, so the card draws it.
  //
  // 📌 **`photo` stays OPTIONAL even though all thirteen now have one.** The
  // optionality IS the rule, not a leftover of it: the next officer added to
  // this roster arrives without a photograph, and must render `<Hatch>` rather
  // than borrow somebody else's.
  {
    name: "Sanya Pillai",
    role: "Academic Director",
    photo: "/photos/officers/sanya-pillai.jpg",
  },
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
