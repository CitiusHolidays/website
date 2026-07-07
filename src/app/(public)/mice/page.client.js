"use client";

import { Briefcase, PiggyBank, ThumbsUp, Users } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import AnimatedSection from "@/components/layout/AnimatedSection";
import GalleryGridSmall from "@/components/ui/GalleryGridSmall";

import WorldMap from "@/static/worldmap.webp";

const commitments = [
  {
    Icon: Users,
    title: "Designated Account Manager",
  },
  {
    Icon: ThumbsUp,
    title: "Long-term Relationship Continuity",
  },
  {
    Icon: PiggyBank,
    title: "Cost Optimization Tips",
  },
  {
    Icon: Briefcase,
    title: "24/7 On-ground Support",
  },
];

export default function MicePageClient({ images }) {
  return (
    <>
      <section className="relative flex h-[50vh] items-center justify-center overflow-hidden bg-[#0B1026] text-center">
        <m.div
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 mt-3"
          initial={{ opacity: 0.8, scale: 1.1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <Image
            alt="Corporate conference"
            className="object-cover object-center pt-16 brightness-75"
            fill
            priority
            sizes="100vw"
            src="/gallery/mice.webp"
          />
        </m.div>
        <m.h1
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 font-bold text-4xl text-white md:text-5xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          Meeting Your MICE Goals
        </m.h1>
      </section>

      <AnimatedSection>
        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-brand-muted text-lg">
            For over <strong>15 glorious years</strong>, Citius has delivered world-class Meetings,
            Incentives, Conferences, and Exhibitions. Our team is empowered by quality training,
            rich travel exposure, and an unwavering commitment to guest engagement.
          </p>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-[url('/gallery/bgmice.webp')] bg-center bg-cover px-4 py-16 text-center">
          <h2 className="mb-8 font-semibold text-3xl text-citius-blue">
            Successfully Executed MICE Programs Across the Globe
          </h2>
          <m.div
            initial={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ amount: 0.2, once: true }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            <Image alt="World map" className="mx-auto" height={400} src={WorldMap} width={800} />
          </m.div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-white px-4 py-16">
          <h2 className="mb-12 text-center font-semibold text-3xl text-citius-blue">
            Our Commitment
          </h2>
          <m.div
            className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 md:grid-cols-4"
            initial="hidden"
            variants={{
              show: { transition: { staggerChildren: 0.15 } },
            }}
            viewport={{ amount: 0.2, once: true }}
            whileInView="show"
          >
            {commitments.map(({ title, Icon }) => (
              <m.div
                className="text-center"
                key={title}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Icon className="mx-auto mb-4 size-10 text-citius-orange" />
                <p className="font-medium text-brand-dark">{title}</p>
              </m.div>
            ))}
          </m.div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="bg-brand-light px-4 py-8">
          <h2 className="mb-8 text-center font-semibold text-3xl text-citius-blue">
            A Glimpse Into Our Events
          </h2>
          <GalleryGridSmall className="mx-auto max-w-6xl" images={images} />
        </section>
      </AnimatedSection>

      <AnimatedSection className="flex justify-center pb-8">
        <Link href="/gallery">
          <button
            className="mx-auto rounded-md bg-citius-orange px-6 py-3 font-semibold text-brand-light shadow hover:brightness-110"
            type="button"
          >
            View More
          </button>
        </Link>
      </AnimatedSection>
    </>
  );
}
