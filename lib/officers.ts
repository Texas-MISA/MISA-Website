// Officer roster carried over from txmisa.org/officers
// (docs/existing-site-inventory.md). LinkedIn URLs cleaned of tracking
// parameters. Photos deliberately not copied — cards render initials until
// real headshots are added to public/.

export type Officer = {
  name: string;
  role: string;
  linkedin: string;
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

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
