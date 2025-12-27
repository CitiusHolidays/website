"use client"

import { motion } from "motion/react";
import { Briefcase, PiggyBank, ThumbsUp, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import AnimatedSection from "../../components/layout/AnimatedSection";
import GalleryGridSmall from "../../components/ui/GalleryGridSmall";

import WorldMap from "../../static/worldmap.webp";

export const generateMetadata = () => ({
  title: "Expert MICE Services & Corporate Event Planning | Citius",
  description:
    "Citius specializes in planning and executing flawless Meetings, Incentives, Conferences, and Exhibitions (MICE) worldwide. Contact us for a proposal.",
});

const commitments = [
  {
    title: "Designated Account Manager",
    Icon: Users,
  },
  {
    title: "Long-term Relationship Continuity",
    Icon: ThumbsUp,
  },
  {
    title: "Cost Optimization Tips",
    Icon: PiggyBank,
  },
  {
    title: "24/7 On-ground Support",
    Icon: Briefcase,
  },
]; 

export default function MicePageClient({ images }) {
  return (
    <>
      <section className="relative h-[50vh] bg-[#0B1026] flex items-center justify-center text-center overflow-hidden">
        <motion.div
          className="absolute inset-0 mt-3"
          initial={{ scale: 1.1, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <Image
            src="/gallery/mice.webp"
            alt="Corporate conference"
            fill
            priority
            className="object-cover object-center pt-16 brightness-75"
          />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 text-4xl font-bold text-white md:text-5xl"
        >
          Meeting Your MICE Goals
        </motion.h1>
      </section>

      <AnimatedSection>
        <section className="px-4 py-16 mx-auto max-w-3xl text-center">
          <p className="text-lg text-brand-muted">
            For over <strong>15 glorious years</strong>, Citius has delivered
            world-class Meetings, Incentives, Conferences, and Exhibitions. Our
            team is empowered by quality training, rich travel exposure, and an
            unwavering commitment to guest engagement.
          </p>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="px-4 py-16 text-center bg-[url('/gallery/bgmice.webp')] bg-cover bg-center">
          <h2 className="mb-8 text-3xl font-semibold text-citius-blue">
            Successfully Executed MICE Programs Across the Globe
          </h2>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Image
              src={WorldMap}
              alt="World map"
              width={800}
              height={400}
              className="mx-auto"
            />
          </motion.div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="px-4 py-16 bg-white">
          <h2 className="mb-12 text-3xl font-semibold text-center text-citius-blue">
            Our Commitment
          </h2>
          <motion.div
            className="grid gap-8 mx-auto max-w-5xl sm:grid-cols-2 md:grid-cols-4"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              show: { transition: { staggerChildren: 0.15 } },
            }}
          >
            {commitments.map(({ title, Icon }) => (
              <motion.div
                key={title}
                className="text-center"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Icon className="mx-auto mb-4 w-10 h-10 text-citius-orange" />
                <p className="font-medium text-brand-dark">{title}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </AnimatedSection>

      <AnimatedSection>
        <section className="px-4 py-8 bg-brand-light">
          <h2 className="mb-8 text-3xl font-semibold text-center text-citius-blue">
            A Glimpse Into Our Events
          </h2>
          <GalleryGridSmall images={images} className="mx-auto max-w-6xl" />
        </section>
      </AnimatedSection>

      <AnimatedSection className="flex justify-center pb-8">
        <Link href="/gallery">
          <button type="button" className="px-6 py-3 mx-auto font-semibold text-brand-light rounded-md shadow bg-citius-orange hover:brightness-110">
            View More
          </button>
        </Link>
      </AnimatedSection>
    </>
  );
}
