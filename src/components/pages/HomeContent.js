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
import TrendingDestinations from "../ui/TrendingDestinations";
import UspElement from "../ui/UspElement";

import CapeTown from "@/static/places/capetown.png";
import Georgia from "@/static/places/georgia.png";
import Japan from "@/static/places/japan.png";
import Portugal from "@/static/places/portugal.png";
import Vietnam from "@/static/places/vietnam.png";

import Goa from "@/static/places/goa.png";
import Jaipur from "@/static/places/jaipur.png";
import Bengaluru from "@/static/places/bengaluru.png";
import Kochi from "@/static/places/kochi.png";
import Mussoorie from "@/static/places/mussoorie.png";

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
  { value: 52, label: "Esteemed Partners" },
  { value: 99768, label: "Passengers Travelled" }
];

const internationalDestinations = [
  {
    rank: 1,
    name: "Vietnam",
    description:
      "Vietnam is rapidly emerging as a top MICE destination, offering a blend of modern convention centers, vibrant cities like Ho Chi Minh and Hanoi, and breathtaking natural backdrops such as Ha Long Bay. Its excellent hospitality, value for money, and unique cultural experiences make it ideal for meetings, incentives, conferences, and exhibitions.",
    image: Vietnam,
    percentage: 100,
  },
  {
    rank: 2,
    name: "Georgia",
    description:
      "Georgia captivates MICE travelers with its mix of European charm and Eurasian hospitality. Tbilisi and Batumi feature state-of-the-art venues, while the country's scenic mountains and renowned wine regions provide memorable incentive experiences. Visa-friendly policies and a growing infrastructure make Georgia a rising star for corporate events.",
    image: Georgia,
    percentage: 95,
  },
  {
    rank: 3,
    name: "Japan",
    description:
      "Japan seamlessly combines tradition and innovation, making it a premier MICE destination. Tokyo, Osaka, and Kyoto offer world-class facilities, efficient transport, and impeccable service. Delegates can enjoy unique cultural immersions, from tea ceremonies to cherry blossom viewing, ensuring unforgettable business and incentive trips.",
    image: Japan,
    percentage: 90,
  },
  {
    rank: 4,
    name: "Cape Town, South Africa",
    description:
      "Cape Town stands out for its stunning landscapes, iconic Table Mountain, and vibrant waterfront. The city boasts modern convention centers, luxury accommodations, and diverse adventure options for incentives. Its rich history, excellent cuisine, and warm climate make it a favorite for international MICE events.",
    image: CapeTown,
    percentage: 85,
  },
  {
    rank: 5,
    name: "Portugal",
    description:
      "Portugal offers a perfect mix of historic charm and contemporary amenities for MICE groups. Lisbon and Porto feature top-tier venues, while the country's beautiful coastline and renowned gastronomy enhance incentive programs. Portugal's accessibility, safety, and welcoming atmosphere make it a sought-after destination for business events.",
    image: Portugal,
    percentage: 80,
  },
];

const domesticDestinations = [
  {
    rank: 1,
    name: "Goa",
    description:
      "A beachside MICE favorite where upscale resorts pair world-class conference facilities with seamless work–leisure balance, from waterfront ballrooms to breakout spaces amid palms. Incentive add‑ons span water sports, yoga by the sea, and vibrant nightlife, supported by active government focus on expanding MICE-ready infrastructure and connectivity.", // [2][5][1]
    image: Goa,
    percentage: 100,
  },
  {
    rank: 2,
    name: "Jaipur",
    description:
      "A heritage-rich MICE hub that combines royal venues for gala dinners with large-scale, integrated precincts such as JECC and the adjoining convention hotel for seamless stay‑meet‑network experiences. Strong air/road access and Rajasthan’s culture, crafts, and cuisine elevate team-building and incentive programs with memorable, sense-of-place moments.", // [6][10]
    image: Jaipur,
    percentage: 95,
  },
  {
    rank: 3,
    name: "Bengaluru",
    description:
      "India’s tech capital offers a deep venue ecosystem anchored by the Bangalore International Exhibition Centre, delivering expansive, purpose-built halls and conferencing for high-impact conventions. Metro and air connectivity, modern hotels, and diverse dining scenes make it ideal for summits, product launches, and innovation-led corporate gatherings.", // [7][11]
    image: Bengaluru,
    percentage: 90,
  },
  {
    rank: 4,
    name: "Kochi",
    description:
      "A backwater-framed city where island convention hotels and modern venues host high-profile business gatherings, underscored by Kerala’s dedicated push to grow weddings and MICE. Historic quarters, coastal cuisine, and houseboat experiences provide distinctive incentive options alongside an emerging city-level MICE initiative.", // [12][14][17][19]
    image: Kochi,
    percentage: 85,
  },
  {
    rank: 5,
    name: "Mussoorie",
    description:
      "A Himalayan hill-station retreat suited to leadership offsites and rewards, with heritage properties offering elegant halls, lawns, and salons for meetings and celebrations. Cool mountain air, colonial promenades, and forest trails add restorative incentive possibilities around compact, premium event footprints.", // [18]
    image: Mussoorie,
    percentage: 80,
  },
];

export default function HomeContent() {
  return (
    <>
      <section className="relative h-[90vh] flex items-center justify-center text-center overflow-hidden">
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
        <TrendingDestinations
          internationalDestinations={internationalDestinations}
          domesticDestinations={domesticDestinations}
        />
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
          className="inline-block px-8 py-4 font-semibold text-brand-light rounded-md shadow bg-citius-orange hover:brightness-110"
        >
          Reach Us for a Proposal
        </Link>
      </AnimatedSection>
    </>
  );
}

