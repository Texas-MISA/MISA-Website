// Officer roster carried over from txmisa.org/officers
// (docs/existing-site-inventory.md). LinkedIn URLs cleaned of tracking
// parameters.
//
// ⚠️ `photo` is deliberately unset on every officer. The design handoff ships
// headshots, but its own README flags the photo-to-name pairing as arbitrary —
// "the correct mapping was never supplied" — and putting a real student's face
// against another real student's name is a worse failure than showing no face
// at all. Cards render the framed placeholder tile until an officer confirms
// the mapping; fill this field in and the card switches automatically.

export type Officer = {
  name: string;
  role: string;
  linkedin: string;
  /** Path under `public/`, once the pairing is confirmed. */
  photo?: string;
};

export const OFFICERS: Officer[] = [
  {
    name: "Brianna Zhang",
    role: "President",
    linkedin: "https://www.linkedin.com/in/briannazhang85/",
  },
  {
    name: "Melinda Wang",
    role: "Vice President",
    linkedin: "https://www.linkedin.com/in/melindapwang/",
  },
  {
    name: "Sourik Sannigrahi",
    role: "Project Vice President",
    linkedin: "https://www.linkedin.com/in/souriksannigrahi/",
  },
  {
    name: "Samantha Rendon",
    role: "Junior Director President",
    linkedin: "https://www.linkedin.com/in/samantha-rendon-7a6344264/",
  },
  {
    name: "Krish Sainath",
    role: "Junior Director Vice President",
    linkedin: "https://www.linkedin.com/in/krishsainath/",
  },
  {
    name: "Avery Wiley",
    role: "Academic Director",
    linkedin: "https://www.linkedin.com/in/averywiley/",
  },
  {
    name: "Labeeb Kibria",
    role: "Special Events Director",
    linkedin: "https://www.linkedin.com/in/labeeb-kibria/",
  },
  {
    name: "Romana Qureshi",
    role: "Marketing Director",
    linkedin: "https://www.linkedin.com/in/romanaq/",
  },
  {
    name: "Emily Maldonado",
    role: "Professional Development Director",
    linkedin: "https://www.linkedin.com/in/emmaldonado/",
  },
  {
    name: "Sasha Brown",
    role: "Social Director",
    linkedin: "https://www.linkedin.com/in/sashabrown3/",
  },
  {
    name: "Karthik Kasa",
    role: "Corporate Director",
    linkedin: "https://www.linkedin.com/in/kkasa/",
  },
  {
    name: "Tochi Ireh",
    role: "Logistics Director",
    linkedin: "https://www.linkedin.com/in/tochukwu-ireh/",
  },
  {
    name: "Trisha Botcha",
    role: "Finance Director",
    linkedin: "https://www.linkedin.com/in/trisha-botcha/",
  },
];

// `initials()` lived here until the UI overhaul, for the Stage 2 card that
// drew a circle of initials where a headshot would go. The redesigned card
// shows a framed hatched placeholder instead — a labelled empty slot, which is
// what the design handoff asks for — so nothing called it any more.
