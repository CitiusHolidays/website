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
    bio: "Kushmesh co-founded Citius Holidays after 14 years in leadership roles at ASHIMA Ltd., Welspun, Portico India, and Raymond Ltd., driving sales, retail, and startup operations across India. An MTech in Geophysics from BHU, he brings analytical rigour to itinerary design and corporate programme planning. From Himalayan base camps to multi-city offsites, he has led Citius's growth since the company's early years.",
    image: kushmesh,
    name: "Kushmesh Chowdhury",
  },
  {
    // position: "Director",
    bio: "Divyanshu Sharma spent a decade in sales and marketing at Ciba Vision–Novartis, Dabur, Abbott, Strides Arcolab, and Merck before turning to entrepreneurship in 2013. As Director at Citius, he oversees systems, processes, HR, and training. An alumnus of IIM Bangalore and BHU, he focuses on operational consistency across every programme the company delivers.",
    image: divyanshu,
    name: "Divyanshu Sharma",
  },
  {
    // position: "Director",
    bio: "With over 28 years in hospitality, Olyvia Basuray is the only Director at Citius Holidays with a core background in hotels and guest services. She has led the company's South India expansion — recruiting regional teams, building supplier relationships, and setting service standards for both corporate and leisure programmes.",
    image: olyvia,
    name: "Olyvia Basuray",
    quote: "Becoming number one is easier than remaining number one.",
    quoteAuthor: "Bill Bradley",
  },
  {
    // position: "Director",
    bio: "Based in Kolkata, Rosy Mitra joined Citius Holidays's leadership team in 2023 and leads growth in mass travel and the cement industry segment. With over two decades in service delivery, marketing, and talent acquisition — including nearly 20 years as Head Recruiter at Altius (now Avanade) — she brings operational depth and people-focused leadership to the company's regional expansion.",
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
      <section className="relative flex h-[60vh] items-center justify-center overflow-hidden bg-public-night text-center">
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
        <div className="relative z-10 max-w-3xl px-4 text-white">
          <h1 className="font-bold font-heading text-4xl tracking-tight md:text-6xl">
            About Citius Holidays
          </h1>
        </div>
      </section>

      <section className="bg-public-paper px-4 pt-16 text-center">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 font-heading font-semibold text-3xl text-public-blue">Our Team</h2>
          <p className="mx-auto mb-12 max-w-3xl text-public-muted">
            Our team handles MICE programmes, corporate travel, and leisure routes across India and
            abroad — with offices in Delhi, Kolkata, and Bangalore.
          </p>
        </div>
      </section>

      <div>
        <section className="bg-public-paper px-4">
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

              <h2 className="mb-2 font-bold font-heading text-2xl text-brand-dark md:text-3xl">
                In Loving Memory of Shri Arpan Mitra
              </h2>

              <p className="mb-2 font-semibold text-brand-muted text-lg">
                Founder, Citius Holidays
              </p>

              <p className="mb-8 font-medium text-brand-muted">(2008 - 2023)</p>

              <div className="prose max-w-none space-y-4 text-left">
                <p className="text-brand-dark leading-relaxed">
                  Arpan Mitra founded Citius Holidays after leaving a successful career at Mahindra
                  & Mahindra. He built the company on purpose, values, and careful service.
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
                  He may be gone, but his influence continues — in the programmes we plan, the
                  culture he built, and the standards he set.
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
        <section className="bg-public-paper px-4 pt-16 pb-8 text-center">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 font-heading font-semibold text-2xl text-public-blue">
              Our Directors
            </h2>
            <p className="mx-auto mb-12 max-w-3xl text-public-muted">
              Our Directors lead MICE programmes, corporate travel, and regional expansion across
              India.
            </p>
          </div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-public-paper px-4 pb-16 text-center">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member, i) => (
              <TeamMember image={member.image} index={i} key={member.name} member={member} />
            ))}
          </div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-public-paper px-4 pt-16 text-center">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 font-heading font-semibold text-3xl text-public-blue">
              Our Beliefs
            </h2>
          </div>
        </section>
        <section className="relative overflow-hidden bg-public-paper px-4 pb-14">
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
                <div className="rounded-xl border border-brand-border bg-white/60 p-6 shadow-sm transition-shadow duration-150 ease-out group-hover:shadow-lg">
                  <h3 className="mb-2 font-heading font-semibold text-2xl text-brand-dark">
                    Our Goal
                  </h3>
                  <p className="text-brand-muted leading-relaxed">
                    To strengthen the MICE travel ecosystem through reliable programmes, long-term
                    partnerships, and practical delivery on every trip we plan.
                  </p>
                </div>
              </m.li>

              <m.li className="group relative" variants={timelineItemVariants}>
                <span className="absolute top-6 -left-9 flex size-6 items-center justify-center rounded-full bg-citius-orange text-brand-dark shadow-md ring-4 ring-white">
                  <Telescope className="size-3" />
                </span>
                <div className="rounded-xl border border-brand-border bg-white/60 p-6 shadow-sm transition-shadow duration-150 ease-out group-hover:shadow-lg">
                  <h3 className="mb-2 font-heading font-semibold text-2xl text-brand-dark">
                    Our Vision
                  </h3>
                  <p className="text-brand-muted leading-relaxed">
                    To be a trusted name in MICE travel — known for consistent delivery, clear
                    communication, and programmes that work for clients and partners alike.
                  </p>
                </div>
              </m.li>

              <m.li className="group relative" variants={timelineItemVariants}>
                <span className="absolute top-6 -left-9 flex size-6 items-center justify-center rounded-full bg-citius-lime text-white shadow-md ring-4 ring-white">
                  <Sparkle className="size-3" />
                </span>
                <div className="rounded-xl border border-brand-border bg-white/60 p-6 shadow-sm transition-shadow duration-150 ease-out group-hover:shadow-lg">
                  <h3 className="mb-2 font-heading font-semibold text-2xl text-brand-dark">
                    Our Mission
                  </h3>
                  <p className="text-brand-muted leading-relaxed">
                    At Citius Holidays, we plan MICE programmes that combine creative itinerary
                    design with reliable logistics. We help organisations mark milestones, run
                    effective offsites, and keep delegate travel straightforward from booking to
                    return.
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
