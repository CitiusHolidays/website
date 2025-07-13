"use client";

import { motion } from "motion/react";
import { Briefcase, Globe, MapPinned, Trophy } from "lucide-react";
import Link from "next/link";
import AnimatedSection from "../layout/AnimatedSection";
import AnimatedCounter from "../ui/AnimatedCounter";
import AwardsShowcase from "../ui/AwardsShowcase";
import ClientShowcase from "../ui/ClientShowcase";
import PartnerShowcase from "../ui/PartnerShowcase";
import SectionHeading from "../ui/SectionHeading";
import ServiceCard from "../ui/ServiceCard";
import UspElement from "../ui/UspElement";

const services = [
  {
    title: "MICE",
    icon: Briefcase,
    description:
      "End-to-end management for Meetings, Incentives, Conferences & Exhibitions.",
  },
  {
    title: "International Travel",
    icon: Globe,
    description:
      "Curated global itineraries for corporate & leisure travelers.",
  },
  {
    title: "Domestic Travel",
    icon: MapPinned,
    description: "Discover India with bespoke experiential journeys.",
  },
  {
    title: "Sporting Events",
    icon: Trophy,
    description:
      "Access to the world's premier sporting spectacles with VIP hospitality.",
  },
];

const usps = [
  "Personalized Travel Plans",
  "Experiential Travel",
  "Eco-Friendly Journeys",
  "Smart Travel Planning",
  "Local Expert Support",
  "Worldwide Connections",
  "24/7 Assistance",
  "Trusted by the Best",
];

const stats = [
  { value: 15, label: "Glorious Years" },
  { value: 75, label: "Destinations Served" },
  { value: 51, label: "Esteemed Partners" },
  { value: 96541, label: "Passengers Travelled" }
];

export default function HomeContent() {
  return (
    <>
      <section className="relative h-[70vh] flex items-center justify-center text-center overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/gallery/bgfooter.png"
          className="object-cover object-center absolute inset-0 w-full h-full brightness-75 bg-brand-dark"
        >
          <source src="/hero.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="relative z-10 px-4 max-w-3xl">
          <motion.h1
            className="mb-4 text-4xl font-bold text-white md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            We Inspire to Travel
          </motion.h1>
          <motion.p
            className="mb-8 text-lg md:text-xl text-brand-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            Global Leaders in MICE, Corporate, and Curated Travel Experiences
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
          >
            <div className="flex flex-col gap-4 justify-center sm:flex-row">
              <Link
                href="/contact"
                className="px-6 py-3 font-semibold text-white rounded-md shadow bg-citius-orange hover:brightness-110"
              >
                Plan Your Trip
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
      <AnimatedSection className="py-16 bg-white">
        <SectionHeading title="A Legacy of Excellence" />
        <div className="grid gap-8 place-items-center px-4 mx-auto max-w-5xl sm:grid-cols-2 md:grid-cols-4">
          {stats.map((s) => (
            <AnimatedCounter key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection>
        <ClientShowcase />
      </AnimatedSection>

      <AnimatedSection className="py-16 bg-brand-light">
        <SectionHeading title="Our Core Services" />
        <div className="grid gap-8 px-4 mx-auto max-w-6xl sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <ServiceCard key={service.title} {...service} />
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection>
        <AwardsShowcase />
      </AnimatedSection>

      <AnimatedSection className="py-16 bg-white">
        <SectionHeading
          title="The Citius Advantage"
          subtitle="Our Core Services"
        />
        <div className="grid gap-6 px-4 mx-auto max-w-4xl sm:grid-cols-2">
          {usps.map((usp) => (
            <UspElement key={usp} title={usp} />
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection>
        <PartnerShowcase />
      </AnimatedSection>

      <AnimatedSection className="px-4 py-16 text-center text-white bg-citius-blue">
        <h2 className="mb-6 text-3xl font-semibold">
          Let&apos;s Build Your Next Unforgettable Experience
        </h2>
        <Link
          href="/contact"
          className="inline-block px-8 py-4 font-semibold text-white rounded-md shadow bg-citius-orange hover:brightness-110"
        >
          Reach Us for a Proposal
        </Link>
      </AnimatedSection>
    </>
  );
}

