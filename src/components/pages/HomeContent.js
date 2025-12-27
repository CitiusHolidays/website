"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { Briefcase, Globe, MapPinned, Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import AnimatedSection from "../layout/AnimatedSection";
import AnimatedCounter from "../ui/AnimatedCounter";
import AwardsShowcase from "../ui/AwardsShowcase";
import ClientShowcase from "../ui/ClientShowcase";
import PartnerShowcase from "../ui/PartnerShowcase";
import SectionHeading from "../ui/SectionHeading";
import ServiceCard from "../ui/ServiceCard";
import TrendingDestinations from "../ui/TrendingDestinations";
import UspElement from "../ui/UspElement";

import Bali from "@/static/places/bali.webp";
import Colombo from "@/static/places/colombo.webp";
import Dubai from "@/static/places/dubai.webp";
import Georgia from "@/static/places/georgia.webp";
import Goa from "@/static/places/goa.webp";
import Jaipur from "@/static/places/jaipur.webp";
import Kochi from "@/static/places/kochi.webp";
import Kolkata from "@/static/places/kolkata.webp";
import Langkawi from "@/static/places/langkawi.webp";
import Puri from "@/static/places/puri.webp";

const services = [
  {
    title: "MICE Excellence",
    icon: Briefcase,
    description:
      "End-to-end management for Meetings, Incentives, Conferences & Exhibitions.",
  },
  {
    title: "Global Voyages",
    icon: Globe,
    description:
      "Curated global itineraries for corporate & leisure travelers.",
  },
  {
    title: "Domestic Gems",
    icon: MapPinned,
    description: "Discover India with bespoke experiential journeys.",
  },
  {
    title: "Elite Sports",
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
  "Curated Experiences",
  "Luxury Concierge",
];

const stats = [
  { value: 15, label: "Years of Excellence" },
  { value: 75, label: "Global Destinations" },
  { value: 52, label: "Corporate Partners" },
  { value: 99768, label: "Happy Travelers" },
];

const internationalDestinations = [
  {
    rank: 1,
    name: "Dubai",
    description:
      "Dubai emerges as a premier MICE destination with its futuristic skyline, world-class convention centers like Dubai World Trade Centre, and luxury resorts. From incentive trips to the Burj Khalifa to grand exhibitions, Dubai offers unparalleled hospitality, connectivity, and innovative event spaces.",
    image: Dubai,
    percentage: 100,
  },
  {
    rank: 2,
    name: "Colombo",
    description:
      "Colombo blends urban sophistication with Sri Lankan charm, featuring modern venues like the BMICH and proximity to pristine beaches. Ideal for conferences and incentives, it provides cost-effective solutions, rich cultural experiences, and excellent infrastructure for international business events.",
    image: Colombo,
    percentage: 95,
  },
  {
    rank: 3,
    name: "Langkawi",
    description:
      "Langkawi's lush rainforests and crystal-clear waters make it a tropical paradise for MICE retreats. With eco-friendly resorts and adventure activities, it's perfect for team-building incentives and relaxed meetings, offering a serene escape with modern facilities.",
    image: Langkawi,
    percentage: 90,
  },
  {
    rank: 4,
    name: "Georgia",
    description:
      "Georgia captivates MICE travelers with its mix of European charm and Eurasian hospitality. Tbilisi and Batumi feature state-of-the-art venues, while the country's scenic mountains and renowned wine regions provide memorable incentive experiences. Visa-friendly policies and a growing infrastructure make Georgia a rising star for corporate events.",
    image: Georgia,
    percentage: 85,
  },
  {
    rank: 5,
    name: "Bali",
    description:
      "Bali captivates with its spiritual serenity and vibrant culture, boasting high-end resorts and convention centers in areas like Nusa Dua. Perfect for wellness-focused incentives and creative conferences, it combines luxury, natural beauty, and Balinese hospitality.",
    image: Bali,
    percentage: 80,
  },
];

const domesticDestinations = [
  {
    rank: 1,
    name: "Jaipur",
    description:
      "A heritage-rich MICE hub that combines royal venues for gala dinners with large-scale, integrated precincts such as JECC and the adjoining convention hotel for seamless stay-meet-network experiences.",
    image: Jaipur,
    percentage: 100,
  },
  {
    rank: 2,
    name: "Kolkata",
    description:
      "Kolkata, the cultural capital, offers heritage venues and modern convention centers for diverse MICE events. From literary festivals to business summits, it provides intellectual stimulation, culinary delights, and colonial architecture for memorable corporate gatherings.",
    image: Kolkata,
    percentage: 95,
  },
  {
    rank: 3,
    name: "Goa",
    description:
      "A beachside MICE favorite where upscale resorts pair world-class conference facilities with seamless work-leisure balance, from waterfront ballrooms to breakout spaces amid palms. Incentive add-ons span water sports, yoga by the sea, and vibrant nightlife.",
    image: Goa,
    percentage: 90,
  },
  {
    rank: 4,
    name: "Puri",
    description:
      "Puri's sacred beaches and Jagannath Temple backdrop create a unique setting for spiritual and cultural MICE experiences. With beach resorts and convention facilities, it's ideal for wellness retreats and incentive programs blending devotion and relaxation.",
    image: Puri,
    percentage: 85,
  },
  {
    rank: 5,
    name: "Cochin",
    description:
      "A backwater-framed city where island convention hotels and modern venues host high-profile business gatherings, underscored by Kerala's dedicated push to grow weddings and MICE.",
    image: Kochi,
    percentage: 80,
  },
];

export default function HomeContent() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-brand-light"
    >
      {/* HERO SECTION */}
      <section className="relative h-screen min-h-[700px] flex items-center justify-center text-center overflow-hidden">
        <motion.div
          style={{ y, opacity }}
          className="absolute inset-0 w-full h-full"
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/gallery/bgfooter.webp"
            className="object-cover object-center w-full h-full brightness-[0.65]"
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
          {/* Atmospheric Overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay"></div>
        </motion.div>

        <div className="relative z-10 px-4 max-w-5xl mx-auto flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 inline-block px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-medium tracking-wider text-white uppercase"
          >
            Premium Travel Partners
          </motion.div>

          <h1
            className="font-heading font-semibold text-4xl md:text-6xl lg:text-7xl text-white leading-[1.1] tracking-tight mb-8 drop-shadow-2xl"
          >
            Your next great journey <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white italic">
              starts here.
            </span>
          </h1>

          <motion.p
            className="mb-10 text-lg md:text-xl text-slate-200 max-w-2xl mx-auto leading-relaxed font-light"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
          >
            Crafted by experts. Designed for you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
            className="flex gap-4"
          >
            <Link
              href="/contact"
              className="group relative px-8 py-4 bg-white text-slate-900 rounded-full font-semibold text-sm overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <span className="relative z-10 flex items-center gap-2">
                Plan Your Trip{" "}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Link>

            <Link
              href="/services"
              className="px-8 py-4 bg-transparent border border-white/30 text-white rounded-full font-semibold text-sm hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
            >
              Explore Services
            </Link>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-white/50 to-transparent"></div>
        </motion.div>
      </section>

      {/* STATS SECTION */}
      <AnimatedSection className="relative py-24 bg-white z-20 -mt-10 rounded-t-[3rem] border-t border-brand-border/50 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-50"></div>
        <div className="text-center mb-16">
          <p className="text-citius-blue font-medium uppercase tracking-widest text-sm mb-2">
            Our Impact
          </p>
          <h2 className="font-heading text-4xl font-semibold text-brand-dark">
            A Legacy of Excellence
          </h2>
        </div>
        <div className="grid gap-12 place-items-center px-4 mx-auto max-w-6xl sm:grid-cols-2 md:grid-cols-4">
          {stats.map((s) => (
            <AnimatedCounter key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </AnimatedSection>

      {/* TRENDING DESTINATIONS - Full Width */}
      <div className="bg-slate-50/50">
        <TrendingDestinations
          internationalDestinations={internationalDestinations}
          domesticDestinations={domesticDestinations}
        />
      </div>

      {/* SERVICES SECTION */}
      <AnimatedSection className="py-32 bg-brand-dark text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"></div>

        <div className="relative z-10">
          <div className="text-center mb-20 px-4">
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Curated Services
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg font-light">
              Experience tailored solutions designed for the modern traveler and
              corporate entity.
            </p>
          </div>

          <div className="grid gap-6 px-4 mx-auto max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <ServiceCard key={service.title} {...service} />
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* CLIENTS */}
      <AnimatedSection className="py-24 bg-white">
        <ClientShowcase />
      </AnimatedSection>

      <AnimatedSection>
        <AwardsShowcase />
      </AnimatedSection>

      {/* USP SECTION */}
      <AnimatedSection className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-heading text-4xl font-bold text-brand-dark mb-6">
              Why Choose Citius?
            </h2>
            <p className="text-brand-muted text-lg mb-8 leading-relaxed">
              We create journeys with purpose, precision, and passion —
              delivering seamless, memorable travel experiences every single
              time
            </p>
            <div className="grid grid-cols-2 gap-4">
              {usps.map((usp) => (
                <UspElement key={usp} title={usp} />
              ))}
            </div>
          </div>
          <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-transparent z-10"></div>
            <div className="absolute inset-0 bg-[url('/gallery/aboutus.webp')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute bottom-0 left-0 right-0 p-8 z-20 bg-gradient-to-t from-black/80 to-transparent">
              <div className="text-white font-heading text-2xl italic">
                &quot;Travel is the only thing you buy that makes you
                richer.&quot;
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection>
        <PartnerShowcase />
      </AnimatedSection>

      {/* CTA */}
      <AnimatedSection className="relative py-32 text-center text-white overflow-hidden">
        <div className="absolute inset-0 bg-blue-900 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 z-0"></div>

        <div className="relative z-20 max-w-3xl mx-auto px-4">
          <h2 className="mb-8 text-4xl md:text-5xl font-heading font-bold leading-tight">
            Ready for your next <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-emerald-200">
              extraordinary journey?
            </span>
          </h2>
          <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto">
            Let our experts craft a personalized itinerary that exceeds your
            expectations.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-10 py-5 font-semibold text-blue-950 bg-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            Start Planning Now <ArrowRight size={18} />
          </Link>
        </div>
      </AnimatedSection>
    </div>
  );
}
