"use client";

import { Briefcase, Globe, MapPinned, Trophy, ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import AnimatedSection from "../layout/AnimatedSection";
import AnimatedCounter from "../ui/AnimatedCounter";
import ServiceCard from "../ui/ServiceCard";
import UspElement from "../ui/UspElement";

const ClientShowcase = dynamic(() => import("../ui/ClientShowcase"), {
  ssr: false,
  loading: () => <div className="h-28 w-full" />,
});

const PartnerShowcase = dynamic(() => import("../ui/PartnerShowcase"), {
  ssr: false,
  loading: () => <div className="h-28 w-full" />,
});

const TrendingDestinations = dynamic(() => import("../ui/TrendingDestinations"), {
  ssr: false,
  loading: () => <div className="h-[460px] w-full" />,
});

const AwardsShowcase = dynamic(() => import("../ui/AwardsShowcase"), {
  ssr: false,
  loading: () => <div className="h-24 w-full" />,
});

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

export default function HomeMainClient() {
  return (
    <div className="relative w-full overflow-hidden bg-brand-light">
      <AnimatedSection className="relative py-24 bg-white z-20 -mt-10 rounded-t-[3rem] border-t border-brand-border/50 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-50" />
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

      <div className="bg-slate-50/50">
        <TrendingDestinations />
      </div>

      <AnimatedSection className="py-32 bg-brand-dark text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

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

      <AnimatedSection className="py-24 bg-white">
        <ClientShowcase />
      </AnimatedSection>

      <AnimatedSection>
        <AwardsShowcase />
      </AnimatedSection>

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
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 to-transparent z-10" />
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

      <AnimatedSection className="relative py-32 text-center text-white overflow-hidden">
        <div className="absolute inset-0 bg-blue-900 z-0" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay z-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 z-0" />

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
