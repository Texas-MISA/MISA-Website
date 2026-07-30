// Site-wide constants carried over from txmisa.org
// (docs/existing-site-inventory.md).

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

export const MISSION =
  "MISA exists to bring together like-minded individuals who have a passion for technology and business. We equip our members with tools by going beyond the course curriculum and covering broader issues in IT. Our aim is to foster an environment that empowers students to succeed in the world outside the Forty Acres, both as professionals and as individuals.";

// The four pillars shown on both the home and about pages.
export const PILLARS = [
  {
    title: "Social Events",
    body: "Come and have fun with members and build a sense of community with our casual social events! We host game nights, kickbacks, IM sports, and more!",
  },
  {
    title: "Technical Workshops",
    body: "Members will have the opportunity to learn skills and tools that will help them in their academic and professional careers. No prior experience is required to attend our technical workshops - everyone is welcome to join and learn something new!",
  },
  {
    title: "Professional Development",
    body: "Gain valuable knowledge and skills that will help you succeed in your future careers. Developing professional skills, such as networking, resume building, and interview skills.",
  },
  {
    title: "Leadership Opportunities",
    body: "Get involved with MISA Leadership as a Junior Director! Boost your resume while developing collaboration skills and growing professionally. Open to freshmen and sophomores of all majors! Applications will reopen Fall 2026!",
  },
] as const;

// Partner names from the existing site's carousel. Displayed as styled text
// rather than logo images — no trademarked assets in this public repo.
export const PARTNERS = ["KPMG", "pwc", "ConocoPhillips", "Credera"] as const;
