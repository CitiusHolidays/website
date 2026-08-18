"use client";

import { ArrowRight, Briefcase, Globe, MapPinned, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PUBLIC_COMPANY_STATS, PUBLIC_COMPANY_STRENGTHS } from "@/data/publicCompanyFacts";
import { PUBLIC_HOME_SERVICES } from "@/data/publicServices";
import Goa from "@/static/places/goa.webp";
import Japan from "@/static/places/japan.webp";
import AnimatedSection from "../layout/AnimatedSection";
import NumberTicker from "../ui/NumberTicker";
import PublicContactCta from "../ui/PublicContactCta";
import PublicGrain from "../ui/PublicGrain";
import ServiceCard from "../ui/ServiceCard";
import UspElement from "../ui/UspElement";

const ClientShowcase = dynamic(() => import("../ui/ClientShowcase"), {
  loading: () => <div className="h-28 w-full" />,
});

const PartnerShowcase = dynamic(() => import("../ui/PartnerShowcase"), {
  loading: () => <div className="h-28 w-full" />,
});

const TrendingDestinations = dynamic(() => import("../ui/TrendingDestinations"), {
  loading: () => <div className="h-[460px] w-full" />,
});

const AwardsShowcase = dynamic(() => import("../ui/AwardsShowcase"), {
  loading: () => <div className="h-24 w-full" />,
});

const homeServiceIcons = {
  "domestic-travel": MapPinned,
  "international-travel": Globe,
  mice: Briefcase,
  "sporting-events": Trophy,
};

const homeServicePresentation = {
  "domestic-travel": { className: "lg:col-span-3", image: Goa },
  "international-travel": { className: "sm:col-span-2 lg:col-span-6", image: Japan },
  mice: {
    className: "sm:col-span-2 lg:col-span-6 lg:row-span-2 lg:min-h-[46rem]",
    image: "/gallery/mice.webp",
  },
  "sporting-events": { className: "lg:col-span-3", image: "/gallery/aboutus.webp" },
};

const services = PUBLIC_HOME_SERVICES.map((service) => ({
  ...homeServicePresentation[service.id],
  description: service.home.description,
  icon: homeServiceIcons[service.id],
  id: service.id,
  title: service.home.title,
}));

export default function HomeMainClient() {
  return (
    <div className="relative w-full overflow-hidden bg-public-paper">
      <div className="relative z-20 -mt-10 rounded-t-[3rem] border-brand-border/50 border-t bg-public-surface shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
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

          <div className="mx-auto grid max-w-7xl grid-flow-row gap-5 px-4 sm:grid-cols-2 lg:grid-flow-dense lg:grid-cols-12 lg:grid-rows-[repeat(2,minmax(22rem,1fr))]">
            {services.map((service) => (
              <ServiceCard
                className={service.className}
                description={service.description}
                icon={service.icon}
                image={service.image}
                key={service.id}
                title={service.title}
              />
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-public-surface px-6 py-3 font-semibold text-public-night transition-colors hover:bg-public-paper focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
              href="/services"
            >
              Explore all services <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </AnimatedSection>

      <section aria-labelledby="home-proof-heading" className="bg-public-surface pt-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="mb-3 font-medium text-public-blue text-sm uppercase tracking-widest">
            Why Citius
          </p>
          <h2
            className="font-heading font-semibold text-4xl text-public-ink md:text-5xl"
            id="home-proof-heading"
          >
            Proof behind every journey
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-public-muted leading-8">
            Experience, trusted relationships, industry recognition, and worldwide support come
            together in every programme we plan.
          </p>
        </div>

        <AnimatedSection className="py-20" data-proof-module="company-stats">
          <div className="mb-14 text-center">
            <p className="mb-2 font-medium text-public-blue text-sm uppercase tracking-widest">
              Our Impact
            </p>
            <h3 className="font-heading font-semibold text-3xl text-public-ink md:text-4xl">
              A Legacy of Excellence
            </h3>
          </div>
          <div className="mx-auto grid max-w-6xl place-items-center gap-12 px-4 sm:grid-cols-2 md:grid-cols-4">
            {PUBLIC_COMPANY_STATS.map((s) => (
              <NumberTicker key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection className="bg-public-paper py-12" data-proof-module="clients">
          <ClientShowcase className="bg-transparent" />
        </AnimatedSection>

        <AnimatedSection data-proof-module="awards">
          <AwardsShowcase />
        </AnimatedSection>

        <AnimatedSection className="bg-public-paper py-24" data-proof-module="strengths">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-6 font-bold font-heading text-4xl text-public-ink">
                Why Choose Citius?
              </h3>
              <p className="mb-8 text-lg text-public-muted leading-relaxed">
                We create journeys with purpose, precision, and passion, delivering seamless,
                memorable travel experiences every single time.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {PUBLIC_COMPANY_STRENGTHS.map((usp) => (
                  <UspElement key={usp} title={usp} />
                ))}
              </div>
            </div>
            <div className="public-media-edge group relative min-h-[32rem] overflow-hidden">
              <div className="absolute inset-0 z-10 bg-gradient-to-tr from-public-night/40 to-transparent" />
              <div className="absolute inset-0 bg-[url('/gallery/aboutus.webp')] bg-center bg-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:group-hover:scale-[1.03] motion-reduce:transition-none" />
              <div className="absolute right-0 bottom-0 left-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-8">
                <div className="font-heading text-2xl text-white italic">
                  &quot;Travel is the only thing you buy that makes you richer.&quot;
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection data-proof-module="partners">
          <PartnerShowcase />
        </AnimatedSection>
      </section>

      <AnimatedSection className="relative overflow-hidden py-32 text-center text-white">
        <div className="absolute inset-0 z-0 bg-public-night" />
        <PublicGrain className="z-10" />
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-public-night via-public-blue to-public-night" />

        <div className="relative z-20 mx-auto max-w-3xl px-4">
          <h2 className="mb-8 font-bold font-heading text-4xl leading-tight md:text-5xl">
            Ready for your next <br />
            <span className="text-public-green/80">extraordinary journey?</span>
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-lg text-public-lime/70">
            Let our experts craft a personalized itinerary that exceeds your expectations.
          </p>
          <PublicContactCta>Start Planning Now</PublicContactCta>
        </div>
      </AnimatedSection>
    </div>
  );
}
