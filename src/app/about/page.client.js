"use client";

import { PlaneTakeoffIcon, Sparkle, Telescope, Heart } from "lucide-react";
import Image from "next/image";
import { motion } from "motion/react";
import AnimatedSection from "../../components/layout/AnimatedSection";
import ValuesCard from "../../components/ui/ValuesCard";
import TeamMember from "../../components/ui/TeamMember";
import kushmesh from "@/static/team/kushmesh.png";
import divyanshu from "@/static/team/divyanshu.png";
import olyvia from "@/static/team/olyvia.png";
import arpan from "@/static/team/arpan.png";
import rosy from "@/static/team/rosy.png";

const teamMembers = [
  {
    name: "Kushmesh Chowdhury",
    // position: "Director",
    bio: 'Kushmesh is the unstoppable energy behind Citius Holidays—an adventurer, travel enthusiast, and bold innovator. With a "never-say-die" attitude and a passion for pushing boundaries, he constantly crafts unique, next-level travel experiences. From summiting the Himalayan base camp to leading corporate offsites across continents, his adventurous spirit fuels the Citius vision. Before co-founding Citius, Kushmesh spent 14 years in leadership roles across top consumer brands like ASHIMA Ltd., Welspun, Portico India, and Raymond Ltd., driving sales, retail, and startup operations across diverse geographies. An MTech in Geophysics from BHU, he seamlessly combines analytical thinking with creative strategy. Under his leadership, Citius Holidays continues to grow by leaps and bounds—one extraordinary journey at a time.',
    image: kushmesh,
  },
  {
    name: "Divyanshu Sharma",
    // position: "Director",
    bio: "Divyanshu Sharma's journey is a story of reinvention—from building iconic FMCG and OTC brands to pioneering seamless travel experiences. With over a decade of experience in sales and marketing, he led the successful launch and growth of products across top companies like Ciba Vision–Novartis, Dabur, Abbott, Strides Arcolab, and Merck. In 2013, he transitioned into entrepreneurship, bringing with him a decade of expertise in sales, marketing, and consumer strategy. Today, as Director at Citius, he drives the company's systems, processes, HR, and training—ensuring every journey is built on operational excellence and delivered with heart. An alumnus of IIM-Bangalore and BHU, Divyanshu brings sharp strategic vision, a customer-first mindset, and a deep passion for building teams and structures that scale with integrity.",
    image: divyanshu,
  },
  {
    name: "Olyvia Basuray",
    // position: "Director",
    bio: "With over 28 years of experience in the hospitality industry, Olyvia Basuray stands out as the only Director at Citius Holidays with a core background in hospitality. Her expertise in service excellence and operational leadership brings a unique perspective to the company's growth and client experience. At Citius, she has led the expansion of the South India market—driving strategic initiatives, recruiting top talent, and building a culture rooted in quality and care. Her passion for creating seamless, high-touch experiences continues to shape the company's premium travel offerings, making her a key force in delivering excellence across both corporate and leisure travel.",
    quote: "Becoming number one is easier than remaining number one.",
    quoteAuthor: "Bill Bradley",
    image: olyvia,
  },
  {
    name: "Rosy Mitra",
    // position: "Director",
    bio: "Based in Kolkata, Rosy Mitra has been a driving force behind Citius Holidays’ growth in the mass travel and cement industry segments since joining the leadership team in 2023. With over two decades of experience across service delivery, marketing and talent acquisition, Rosy brings a unique blend of operational expertise and people-centric leadership. Her career spans impactful roles with organizations like Altius (now Avanade), where she served as Head Recruiter for nearly two decades, SQLI as Program Coordinator, and Genius Consultants. At Citius, she continues to infuse her deep industry insights and strategic thinking, helping the company expand its footprint while ensuring seamless client experiences.",
    image: rosy,
  },
];

const timelineVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
    },
  },
};

const timelineItemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export const generateMetadata = () => ({
  title: "About Citius | 15 Years of Travel Excellence",
  description:
    "Learn about Citius, our history of consumer delight and our commitment to responsible tourism.",
});

export default function AboutPage() {
  return (
    <>
      <section className="relative h-[60vh] flex items-center justify-center bg-[#0B1026] text-center overflow-hidden">
        <motion.div
          className="absolute inset-0 mt-3"
          initial={{ scale: 1.1, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <Image
            src="/gallery/aboutus.png"
            alt="About Citius"
            fill
            priority
            className="object-cover object-center pt-16 brightness-75"
          />
        </motion.div>
      </section>

      <section className="px-4 pt-16 text-center bg-brand-light">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="mb-4 text-3xl font-semibold text-citius-blue">
            Our Team
          </h2>
          <p className="mx-auto mb-12 max-w-3xl text-brand-muted">
            Our greatest strength lies in our people. A passionate team
            committed to guest engagement, armed with deep industry knowledge
            and global exposure.
          </p>
        </div>
      </section>

      <div>
        <section className="px-4 bg-brand-light">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="bg-white rounded-2xl bg-[url('/gallery/bgaboutus.png')] shadow-lg border border-brand-border p-8 md:p-12"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  <div className="w-48 h-48 md:w-52 md:h-52 rounded-full overflow-hidden border-4 border-white shadow-xl flex items-center justify-center bg-white">
                    <Image
                      src={arpan}
                      alt="Shri Arpan Mitra"
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: "center 30%" }}
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-citius-blue rounded-full flex items-center justify-center shadow-lg border-2 border-brand-light">
                    <Heart className="w-5 h-5 text-brand-light" />
                  </div>
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-2">
                In Loving Memory of Shri Arpan Mitra
              </h2>

              <p className="text-lg text-brand-muted mb-2 font-semibold">
                Founder, Citius Holidays
              </p>

              <p className="text-brand-muted mb-8 font-medium">(2008 - 2023)</p>

              <div className="prose max-w-none text-left space-y-4">
                <p className="text-brand-dark leading-relaxed">
                  Arpan Mitra was not just the founder of Citius Holidays — he
                  was its heart and soul. Leaving behind a successful career at
                  Mahindra & Mahindra, he courageously followed his passion to
                  build a travel company driven by purpose, values, and
                  meaningful experiences.
                </p>

                <p className="text-brand-dark leading-relaxed">
                  What started as a solo dream soon became a shared mission, as
                  Arpan&apos;s childhood friends joined him to shape a workplace
                  where ideas thrived and people mattered.
                </p>

                <p className="text-brand-dark leading-relaxed">
                  On 16th June 2023, we lost Arpan far too soon. His vision,
                  leadership, and love for travel continue to guide us every
                  day.
                </p>

                <p className="text-brand-dark leading-relaxed">
                  He may be gone, but his legacy lives on — in the journeys we
                  craft, the culture he built, and the passion he inspired in
                  all of us.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-brand-border">
                <p className="text-brand-dark font-semibold text-lg mb-2">
                  Forever in our hearts.
                </p>
                <p className="text-brand-muted italic">
                  - Team Citius Holidays
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      <AnimatedSection>
        <section className="px-4 pt-16 pb-8 text-center bg-brand-light">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="mb-4 text-2xl font-semibold text-citius-blue">
              Our Directors
            </h3>
            <p className="mx-auto mb-12 max-w-3xl text-brand-muted">
              Our Directors are the driving force behind Citius Holidays. They
              are the ones who make the decisions that shape the company&apos;s
              future.
            </p>
          </div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="px-4 pb-16 text-center bg-brand-light">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {teamMembers.map((member, i) => (
              <TeamMember
                key={member.name}
                member={member}
                image={member.image}
                index={i}
              />
            ))}
          </div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="px-4 pt-16 text-center bg-brand-light">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="mb-4 text-3xl font-semibold text-citius-blue">
              Our Beliefs
            </h2>
          </div>
        </section>
        <section className="overflow-hidden relative px-4 pb-14 bg-brand-light via-brand-light/40">
          <div className="absolute top-0 -left-40 w-96 h-96 rounded-full blur-3xl pointer-events-none bg-citius-blue/10" />
          <div className="absolute bottom-0 -right-40 w-96 h-96 rounded-full blur-3xl pointer-events-none bg-citius-orange/10" />
          <div className="relative mx-auto max-w-5xl">
            <motion.ol
              className="relative pl-12 ml-6 space-y-12 border-l-2 border-brand-border/60"
              variants={timelineVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
            >
              <motion.li
                className="relative group"
                variants={timelineItemVariants}
              >
                <span className="flex absolute top-6 -left-9 justify-center items-center w-6 h-6 text-white rounded-full ring-4 ring-white shadow-md bg-citius-blue">
                  <PlaneTakeoffIcon className="w-3 h-3" />
                </span>
                <div className="p-6 rounded-xl border shadow-sm transition bg-white/60 border-brand-border group-hover:shadow-lg">
                  <h3 className="mb-2 text-2xl font-semibold text-brand-dark">
                    Our Goal
                  </h3>
                  <p className="leading-relaxed text-brand-muted">
                    To positively shape the future of the travel industry by
                    creating standout experiences, building strong, trusted
                    partnerships, and contributing to the advancement of the
                    MICE travel ecosystem — with every trip we design.
                  </p>
                </div>
              </motion.li>

              <motion.li
                className="relative group"
                variants={timelineItemVariants}
              >
                <span className="flex absolute top-6 -left-9 justify-center items-center w-6 h-6 text-white rounded-full ring-4 ring-white shadow-md bg-citius-orange">
                  <Telescope className="w-3 h-3" />
                </span>
                <div className="p-6 rounded-xl border shadow-sm transition bg-white/60 border-brand-border group-hover:shadow-lg">
                  <h3 className="mb-2 text-2xl font-semibold text-brand-dark">
                    Our Vision
                  </h3>
                  <p className="leading-relaxed text-brand-muted">
                    To be recognized as a trusted industry leader in MICE travel
                    — known for our expertise, consistency, and excellence. We
                    aim to deliver world-class experiences that are seamless,
                    impactful, and profitable for our clients and partners.
                  </p>
                </div>
              </motion.li>

              <motion.li
                className="relative group"
                variants={timelineItemVariants}
              >
                <span className="flex absolute top-6 -left-9 justify-center items-center w-6 h-6 text-white rounded-full ring-4 ring-white shadow-md bg-citius-lime">
                  <Sparkle className="w-3 h-3" />
                </span>
                <div className="p-6 rounded-xl border shadow-sm transition bg-white/60 border-brand-border group-hover:shadow-lg">
                  <h3 className="mb-2 text-2xl font-semibold text-brand-dark">
                    Our Mission
                  </h3>
                  <p className="leading-relaxed text-brand-muted">
                    At Citius Holidays, we believe travel is more than just
                    movement — it&apos;s connection, inspiration, and growth.
                    Our mission is to deliver thoughtfully curated MICE journeys
                    that combine creativity, precision, and care. We empower
                    organizations to celebrate achievements, strengthen
                    relationships, and unlock potential through experiences that
                    are smooth, meaningful, and truly unforgettable.
                  </p>
                </div>
              </motion.li>
            </motion.ol>
          </div>
        </section>
      </AnimatedSection>

      <ValuesCard />
    </>
  );
}
