"use client";

import { Heart } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import AnimatedSection from "@/components/layout/AnimatedSection";
import TeamMember from "@/components/ui/TeamMember";
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

export default function AboutPage() {
  return (
    <>
      <section className="bg-public-night px-4 pt-32 pb-10 text-white sm:pt-36 sm:pb-14">
        <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
          <h1 className="mb-8 text-balance font-bold font-heading text-3xl tracking-tight sm:text-5xl lg:mb-0">
            About Citius Holidays
          </h1>
          <Image
            alt="Citius team members in matching polo shirts gathered on an indoor stage"
            className="public-media-edge h-auto w-full"
            height={1280}
            priority
            sizes="(max-width: 1023px) 100vw, 552px"
            src="/gallery/aboutus.webp"
            width={1920}
          />
        </div>
      </section>

      <section className="bg-public-paper px-4 pt-16 text-center">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 font-heading font-semibold text-3xl text-public-blue">Our Team</h2>
          <p className="mx-auto mb-12 max-w-3xl text-public-muted">
            Our team handles MICE programmes, corporate travel, and leisure routes across India and
            abroad.
          </p>
        </div>
      </section>

      <div>
        <section className="bg-public-paper px-4">
          <div className="mx-auto max-w-4xl text-center">
            <m.div
              className="rounded-2xl border border-brand-border bg-white p-5 sm:p-8"
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

              <p className="mb-6 font-medium text-brand-muted">(2008 - 2023)</p>

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
              Meet the people leading our programmes and regional teams.
            </p>
          </div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-public-paper px-4 pb-16 text-center">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member, i) => (
              <TeamMember image={member.image} index={i} key={member.name} member={member} />
            ))}
          </div>
        </section>
      </AnimatedSection>

      <section className="bg-public-surface px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-heading font-semibold text-2xl text-public-blue">How we work</h2>
          <p className="mt-4 text-public-muted leading-relaxed">
            Clear communication, careful supplier selection, and reliable on-ground delivery guide
            our programmes. We build long-term relationships with clients and partners, invest in
            our people, and respect the communities and cultures we visit.
          </p>
        </div>
      </section>
    </>
  );
}
