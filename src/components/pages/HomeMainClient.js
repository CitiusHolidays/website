"use client";

import { ArrowRight, Briefcase, Globe, MapPinned, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import AnimatedSection from "../layout/AnimatedSection";
import AnimatedCounter from "../ui/AnimatedCounter";
import ServiceCard from "../ui/ServiceCard";
import UspElement from "../ui/UspElement";

const ClientShowcase = dynamic(() => import("../ui/ClientShowcase"), {
  loading: () => <div className="h-28 w-full" />,
  ssr: false,
});

const PartnerShowcase = dynamic(() => import("../ui/PartnerShowcase"), {
  loading: () => <div className="h-28 w-full" />,
  ssr: false,
});

const TrendingDestinations = dynamic(() => import("../ui/TrendingDestinations"), {
  loading: () => <div className="h-[460px] w-full" />,
  ssr: false,
});

const AwardsShowcase = dynamic(() => import("../ui/AwardsShowcase"), {
  loading: () => <div className="h-24 w-full" />,
  ssr: false,
});

const services = [
  {
    description: "End-to-end management for Meetings, Incentives, Conferences & Exhibitions.",
    icon: Briefcase,
    title: "MICE Excellence",
  },
  {
    description: "Curated global itineraries for corporate & leisure travelers.",
    icon: Globe,
    title: "Global Voyages",
  },
  {
    description: "Discover India with bespoke experiential journeys.",
    icon: MapPinned,
    title: "Domestic Gems",
  },
  {
    description: "Access to the world's premier sporting spectacles with VIP hospitality.",
    icon: Trophy,
    title: "Elite Sports",
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
  { label: "Years of Excellence", value: 15 },
  { label: "Global Destinations", value: 75 },
  { label: "Corporate Partners", value: 52 },
  { label: "Happy Travelers", value: 99_768 },
];

export default function HomeMainClient() {
  return (
    <div className="relative w-full overflow-hidden bg-public-paper">
      <AnimatedSection className="relative z-20 -mt-10 rounded-t-[3rem] border-brand-border/50 border-t bg-public-surface py-24 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-public-blue/20 to-transparent opacity-50" />
        <div className="mb-16 text-center">
          <p className="mb-2 font-medium text-public-blue text-sm uppercase tracking-widest">
            Our Impact
          </p>
          <h2 className="font-heading font-semibold text-4xl text-public-ink">
            A Legacy of Excellence
          </h2>
        </div>
        <div className="mx-auto grid max-w-6xl place-items-center gap-12 px-4 sm:grid-cols-2 md:grid-cols-4">
          {stats.map((s) => (
            <AnimatedCounter key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </AnimatedSection>

      <div className="bg-public-paper/50">
        <TrendingDestinations />
      </div>

      <AnimatedSection className="relative overflow-hidden bg-public-night py-32 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(var(--color-public-blue)_1px,transparent_1px)] opacity-10 [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

        <div className="relative z-10">
          <div className="mb-20 px-4 text-center">
            <h2 className="mb-6 font-heading font-semibold text-4xl md:text-5xl">
              Curated Services
            </h2>
            <p className="mx-auto max-w-2xl font-light text-lg text-slate-400">
              Experience tailored solutions designed for the modern traveler and corporate entity.
            </p>
          </div>

          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <ServiceCard
                description={service.description}
                icon={service.icon}
                key={service.title}
                title={service.title}
              />
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-public-surface py-24">
        <ClientShowcase />
      </AnimatedSection>

      <AnimatedSection>
        <AwardsShowcase />
      </AnimatedSection>

      <AnimatedSection className="bg-public-paper py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 font-bold font-heading text-4xl text-public-ink">
              Why Choose Citius?
            </h2>
            <p className="mb-8 text-lg text-public-muted leading-relaxed">
              We create journeys with purpose, precision, and passion , delivering seamless,
              memorable travel experiences every single time
            </p>
            <div className="grid grid-cols-2 gap-4">
              {usps.map((usp) => (
                <UspElement key={usp} title={usp} />
              ))}
            </div>
          </div>
          <div className="group relative h-[500px] overflow-hidden rounded-3xl shadow-2xl">
            <div className="absolute inset-0 z-10 bg-gradient-to-tr from-public-night/40 to-transparent" />
            <div className="absolute inset-0 bg-[url('/gallery/aboutus.webp')] bg-center bg-cover transition-transform duration-700 fine-hover:group-hover:scale-105" />
            <div className="absolute right-0 bottom-0 left-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-8">
              <div className="font-heading text-2xl text-white italic">
                &quot;Travel is the only thing you buy that makes you richer.&quot;
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection>
        <PartnerShowcase />
      </AnimatedSection>

      <AnimatedSection className="relative overflow-hidden py-32 text-center text-white">
        <div className="absolute inset-0 z-0 bg-public-night" />
        <div className="absolute inset-0 z-10 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-public-night via-public-blue to-public-night" />

        <div className="relative z-20 mx-auto max-w-3xl px-4">
          <h2 className="mb-8 font-bold font-heading text-4xl leading-tight md:text-5xl">
            Ready for your next <br />
            <span className="text-public-green/80">extraordinary journey?</span>
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-lg text-public-lime/70">
            Let our experts craft a personalized itinerary that exceeds your expectations.
          </p>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-public-surface px-10 py-5 font-semibold text-public-night shadow-lg transition-[scale,box-shadow] duration-300 fine-hover:hover:scale-105 hover:shadow-xl"
            href="/contact"
          >
            Start Planning Now <ArrowRight size={18} />
          </Link>
        </div>
      </AnimatedSection>
    </div>
  );
}
