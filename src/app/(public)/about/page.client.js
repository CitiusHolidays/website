"use client";

import { Heart, PlaneTakeoffIcon, Sparkle, Telescope } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import AnimatedSection from "@/components/layout/AnimatedSection";
import TeamMember from "@/components/ui/TeamMember";
import ValuesCard from "@/components/ui/ValuesCard";
import arpan from "@/static/team/arpan.webp";
import divyanshu from "@/static/team/divyanshu.webp";
import kushmesh from "@/static/team/kushmesh.webp";
import olyvia from "@/static/team/olyvia.webp";
import rosy from "@/static/team/rosy.webp";

const teamMembers = [
  {
    // position: "Director",
    bio: 'Kushmesh is the unstoppable energy behind Citius Holidays—an adventurer, travel enthusiast, and bold innovator. With a "never-say-die" attitude and a passion for pushing boundaries, he constantly crafts unique, next-level travel experiences. From summiting the Himalayan base camp to leading corporate offsites across continents, his adventurous spirit fuels the Citius vision. Before co-founding Citius, Kushmesh spent 14 years in leadership roles across top consumer brands like ASHIMA Ltd., Welspun, Portico India, and Raymond Ltd., driving sales, retail, and startup operations across diverse geographies. An MTech in Geophysics from BHU, he seamlessly combines analytical thinking with creative strategy. Under his leadership, Citius Holidays continues to grow by leaps and bounds—one extraordinary journey at a time.',
    image: kushmesh,
    name: "Kushmesh Chowdhury",
  },
  {
    // position: "Director",
    bio: "Divyanshu Sharma's journey is a story of reinvention—from building iconic FMCG and OTC brands to pioneering seamless travel experiences. With over a decade of experience in sales and marketing, he led the successful launch and growth of products across top companies like Ciba Vision–Novartis, Dabur, Abbott, Strides Arcolab, and Merck. In 2013, he transitioned into entrepreneurship, bringing with him a decade of expertise in sales, marketing, and consumer strategy. Today, as Director at Citius, he drives the company's systems, processes, HR, and training—ensuring every journey is built on operational excellence and delivered with heart. An alumnus of IIM-Bangalore and BHU, Divyanshu brings sharp strategic vision, a customer-first mindset, and a deep passion for building teams and structures that scale with integrity.",
    image: divyanshu,
    name: "Divyanshu Sharma",
  },
  {
    // position: "Director",
    bio: "With over 28 years of experience in the hospitality industry, Olyvia Basuray stands out as the only Director at Citius Holidays with a core background in hospitality. Her expertise in service excellence and operational leadership brings a unique perspective to the company's growth and client experience. At Citius, she has led the expansion of the South India market—driving strategic initiatives, recruiting top talent, and building a culture rooted in quality and care. Her passion for creating seamless, high-touch experiences continues to shape the company's premium travel offerings, making her a key force in delivering excellence across both corporate and leisure travel.",
    image: olyvia,
    name: "Olyvia Basuray",
    quote: "Becoming number one is easier than remaining number one.",
    quoteAuthor: "Bill Bradley",
  },
  {
    // position: "Director",
    bio: "Based in Kolkata, Rosy Mitra has been a driving force behind Citius Holidays’ growth in the mass travel and cement industry segments since joining the leadership team in 2023. With over two decades of experience across service delivery, marketing and talent acquisition, Rosy brings a unique blend of operational expertise and people-centric leadership. Her career spans impactful roles with organizations like Altius (now Avanade), where she served as Head Recruiter for nearly two decades, SQLI as Program Coordinator, and Genius Consultants. At Citius, she continues to infuse her deep industry insights and strategic thinking, helping the company expand its footprint while ensuring seamless client experiences.",
    image: rosy,
    name: "Rosy Mitra",
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
  show: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" }, x: 0 },
};

export default function AboutPage() {
  return (
    <>
      <section className="relative flex h-[60vh] items-center justify-center overflow-hidden bg-[#0B1026] text-center">
        <m.div
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 mt-3"
          initial={{ opacity: 0.8, scale: 1.1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <Image
            alt="About Citius"
            className="object-cover object-center pt-16 brightness-75"
            fill
            priority
            sizes="100vw"
            src="/gallery/aboutus.webp"
          />
        </m.div>
      </section>

      <section className="bg-brand-light px-4 pt-16 text-center">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 font-semibold text-3xl text-citius-blue">Our Team</h2>
          <p className="mx-auto mb-12 max-w-3xl text-brand-muted">
            Our greatest strength lies in our people. A passionate team committed to guest
            engagement, armed with deep industry knowledge and global exposure.
          </p>
        </div>
      </section>

      <div>
        <section className="bg-brand-light px-4">
          <div className="mx-auto max-w-4xl text-center">
            <m.div
              className="rounded-2xl border border-brand-border bg-[url('/gallery/bgaboutus.webp')] bg-white p-8 shadow-lg md:p-12"
              initial={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <div className="mb-6 flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="flex size-48 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl md:h-52 md:w-52">
                    <Image
                      alt="Shri Arpan Mitra"
                      className="size-full object-cover"
                      height={128}
                      src={arpan}
                      style={{ objectPosition: "center 30%" }}
                      width={128}
                    />
                  </div>
                  <div className="absolute -right-1 -bottom-1 flex size-10 items-center justify-center rounded-full border-2 border-brand-light bg-citius-blue shadow-lg">
                    <Heart className="size-5 text-brand-light" />
                  </div>
                </div>
              </div>

              <h2 className="mb-2 font-bold text-2xl text-brand-dark md:text-3xl">
                In Loving Memory of Shri Arpan Mitra
              </h2>

              <p className="mb-2 font-semibold text-brand-muted text-lg">
                Founder, Citius Holidays
              </p>

              <p className="mb-8 font-medium text-brand-muted">(2008 - 2023)</p>

              <div className="prose max-w-none space-y-4 text-left">
                <p className="text-brand-dark leading-relaxed">
                  Arpan Mitra was not just the founder of Citius Holidays , he was its heart and
                  soul. Leaving behind a successful career at Mahindra & Mahindra, he courageously
                  followed his passion to build a travel company driven by purpose, values, and
                  meaningful experiences.
                </p>

                <p className="text-brand-dark leading-relaxed">
                  What started as a solo dream soon became a shared mission, as Arpan&apos;s
                  childhood friends joined him to shape a workplace where ideas thrived and people
                  mattered.
                </p>

                <p className="text-brand-dark leading-relaxed">
                  On 16th June 2023, we lost Arpan far too soon. His vision, leadership, and love
                  for travel continue to guide us every day.
                </p>

                <p className="text-brand-dark leading-relaxed">
                  He may be gone, but his legacy lives on , in the journeys we craft, the culture he
                  built, and the passion he inspired in all of us.
                </p>
              </div>

              <div className="mt-8 border-brand-border border-t pt-6">
                <p className="mb-2 font-semibold text-brand-dark text-lg">Forever in our hearts.</p>
                <p className="text-brand-muted italic">- Team Citius Holidays</p>
              </div>
            </m.div>
          </div>
        </section>
      </div>

      <AnimatedSection>
        <section className="bg-brand-light px-4 pt-16 pb-8 text-center">
          <div className="mx-auto max-w-4xl text-center">
            <h3 className="mb-4 font-semibold text-2xl text-citius-blue">Our Directors</h3>
            <p className="mx-auto mb-12 max-w-3xl text-brand-muted">
              Our Directors are the driving force behind Citius Holidays. They are the ones who make
              the decisions that shape the company&apos;s future.
            </p>
          </div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-brand-light px-4 pb-16 text-center">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member, i) => (
              <TeamMember image={member.image} index={i} key={member.name} member={member} />
            ))}
          </div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-brand-light px-4 pt-16 text-center">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 font-semibold text-3xl text-citius-blue">Our Beliefs</h2>
          </div>
        </section>
        <section className="relative overflow-hidden bg-brand-light via-brand-light/40 px-4 pb-14">
          <div className="pointer-events-none absolute top-0 -left-40 size-96 rounded-full bg-citius-blue/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 bottom-0 size-96 rounded-full bg-citius-orange/10 blur-3xl" />
          <div className="relative mx-auto max-w-5xl">
            <m.ol
              className="relative ml-6 space-y-12 border-brand-border/60 border-l-2 pl-12"
              initial="hidden"
              variants={timelineVariants}
              viewport={{ amount: 0.2, once: true }}
              whileInView="show"
            >
              <m.li className="group relative" variants={timelineItemVariants}>
                <span className="absolute top-6 -left-9 flex size-6 items-center justify-center rounded-full bg-citius-blue text-white shadow-md ring-4 ring-white">
                  <PlaneTakeoffIcon className="size-3" />
                </span>
                <div className="rounded-xl border border-brand-border bg-white/60 p-6 shadow-sm transition group-hover:shadow-lg">
                  <h3 className="mb-2 font-semibold text-2xl text-brand-dark">Our Goal</h3>
                  <p className="text-brand-muted leading-relaxed">
                    To positively shape the future of the travel industry by creating standout
                    experiences, building strong, trusted partnerships, and contributing to the
                    advancement of the MICE travel ecosystem , with every trip we design.
                  </p>
                </div>
              </m.li>

              <m.li className="group relative" variants={timelineItemVariants}>
                <span className="absolute top-6 -left-9 flex size-6 items-center justify-center rounded-full bg-citius-orange text-brand-dark shadow-md ring-4 ring-white">
                  <Telescope className="size-3" />
                </span>
                <div className="rounded-xl border border-brand-border bg-white/60 p-6 shadow-sm transition group-hover:shadow-lg">
                  <h3 className="mb-2 font-semibold text-2xl text-brand-dark">Our Vision</h3>
                  <p className="text-brand-muted leading-relaxed">
                    To be recognized as a trusted industry leader in MICE travel , known for our
                    expertise, consistency, and excellence. We aim to deliver world-class
                    experiences that are seamless, impactful, and profitable for our clients and
                    partners.
                  </p>
                </div>
              </m.li>

              <m.li className="group relative" variants={timelineItemVariants}>
                <span className="absolute top-6 -left-9 flex size-6 items-center justify-center rounded-full bg-citius-lime text-white shadow-md ring-4 ring-white">
                  <Sparkle className="size-3" />
                </span>
                <div className="rounded-xl border border-brand-border bg-white/60 p-6 shadow-sm transition group-hover:shadow-lg">
                  <h3 className="mb-2 font-semibold text-2xl text-brand-dark">Our Mission</h3>
                  <p className="text-brand-muted leading-relaxed">
                    At Citius Holidays, we believe travel is more than just movement , it&apos;s
                    connection, inspiration, and growth. Our mission is to deliver thoughtfully
                    curated MICE journeys that combine creativity, precision, and care. We empower
                    organizations to celebrate achievements, strengthen relationships, and unlock
                    potential through experiences that are smooth, meaningful, and truly
                    unforgettable.
                  </p>
                </div>
              </m.li>
            </m.ol>
          </div>
        </section>
      </AnimatedSection>

      <ValuesCard />
    </>
  );
}
