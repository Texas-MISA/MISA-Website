import type { Metadata } from "next";

import { ChevronHero } from "@/components/ui/chevron-section";
import { Partners } from "@/components/ui/partners";
import { Pillars } from "@/components/ui/pillars";
import { MISSION } from "@/lib/site";

// Recreation of txmisa.org/about-us-1 (docs/existing-site-inventory.md).

export const metadata: Metadata = {
  title: "About Us",
  description: "Connecting technology with business.",
};

const HISTORY = [
  "The Management Information Systems Association is a professional, academic, philanthropic and social organization. MISA unites a diverse community of individuals who have a passion for combining technology with business and often pursue careers in Information Technology. Each semester MISA holds various activities that are designed to expose students to professional opportunities, expand their technological skills, and meet other like-minded individuals.",
  "Originally founded in 1982, MISA was re-established in 2009 and has experienced rapid growth. In the past two years alone, MISA membership grew by 250% and attracted various majors from MIS, Computer Science, Engineering, and Natural Sciences.",
];

const FAQ = [
  {
    q: "WHAT IS MISA?",
    a: "MISA is the premier IT organization within McCombs, which functions to build a community that is interested in technology and business. In addition to connecting students - mainly MIS majors - the organization also works to connect companies with students regarding post-graduate opportunities.",
  },
  {
    q: "WHY SHOULD I BE A PART OF MISA?",
    a: "Joining MISA is a great way to meet people that have similar interests as you and participate in a variety of activities. As a well-rounded organization, MISA hosts socials, academic workshops, service days, and professional networking events. Regardless of whether you want to learn about different career opportunities, go out and give back to the community, or hang out with a group of fun-loving individuals - we guarantee that MISA has something to offer.",
  },
  {
    q: "WHAT IS THE DRESS CODE FOR MEETINGS?",
    a: "There is none! Like every major technology organization out there, we care more about what you do than what you wear. As such, unless it's an off-campus dinner where business casual is recommended, you are welcome to wear what you would like.",
  },
  {
    q: "WHAT CAN I EXPECT AT A MISA EVENT?",
    a: "That depends on the event. At General Meetings, you can expect a company presentation along with a fun activity with food. At socials, you can expect a variety of games (video games, board games, or card games) to be played. Service events usually entail cleaning up a creek around Austin, so be ready to get your hands dirty. Workshops are similar to class lectures in that you are taught a hard skill over the course of the event and are given hands-on experience with technology.",
  },
  {
    q: "HOW DO I KNOW IF MISA IS RIGHT FOR ME?",
    a: "You are free to contact any of our officers via email, Instagram, slack, or in person if you have any questions about MISA. But, of course, the best way for you to see if we are right for you is to attend a meeting! Membership is not required for you to attend any of our meetings, so you are welcome to come and see if MISA would be worthwhile for you.",
  },
  {
    q: "WHAT KINDS OF PROJECTS HAS MISA WORKED ON IN THE PAST?",
    a: "In Spring 2024, MISA introduced student driven projects. In these, student teams collaborated on real-world consulting projects with major organizations including PepsiCo, CapMetro, and several local Austin businesses. These projects allowed members to apply their technical, analytical, and business skills to address real client challenges. Through these experiences, students gained hands-on exposure to consulting, project management, and cross-functional teamwork, preparing them for careers at the intersection of technology and business strategy.",
  },
  {
    q: "WHO CAN BECOME A MISA MEMBER?",
    a: "Anyone! We accept all majors & years! In order to be a member, the only requirement is being a UT student and paying dues. We welcome anyone to be a member, but having an interest in technology is recommended.",
  },
];

export default function AboutPage() {
  return (
    <>
      <ChevronHero>
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold sm:text-6xl">
            About Us
          </h1>
          <p className="mt-4 text-lg text-foreground/80">
            Connecting technology with business.
          </p>
        </div>
      </ChevronHero>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Pillars />
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold text-misa-blue sm:text-4xl">
            Mission
          </h2>
          <p className="mt-6 font-medium leading-7">{MISSION}</p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">
            History of MISA
          </h2>
          <div className="mt-6 flex flex-col gap-4">
            {HISTORY.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="leading-7 text-foreground/85">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      <Partners heading="Our Amazing Partners!" />

      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            Frequently Asked Questions
          </h2>
          {/* Plain Q&A list, not an accordion — matches the original. */}
          <dl className="mt-10 flex flex-col gap-8">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-sm font-semibold tracking-wide">{item.q}</dt>
                <dd className="mt-2 leading-7 text-foreground/80">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
