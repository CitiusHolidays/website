"use client";

import { Briefcase, Globe, MapPinned, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRightIcon, useAnimatedIconTrigger } from "@/components/ui/AnimatedLucideIcons";
import { PUBLIC_COMPANY_STATS, PUBLIC_COMPANY_STRENGTHS } from "@/data/publicCompanyFacts";
import { PUBLIC_HOME_SERVICES } from "@/data/publicServices";
import Goa from "@/static/places/goa.webp";
import AnimatedSection from "../layout/AnimatedSection";
import NumberTicker from "../ui/NumberTicker";
import PublicContactCta from "../ui/PublicContactCta";
import PublicGrain from "../ui/PublicGrain";
import ServiceCard from "../ui/ServiceCard";
import UspElement from "../ui/UspElement";

const F1_RACE_IMAGE =
  "https://cdn.sanity.io/images/469zdu2i/production/f56db0ac6b4d193018bdbc901da9e5602322fe98-4032x3024.png";
const GLOBAL_VOYAGES_IMAGE =
  "https://cdn.sanity.io/images/469zdu2i/production/686c6e64e3b26f7e4eede8639b3b049c7e534748-3024x4032.jpg";

function HomeModuleLoading({ className, label }) {
  return (
    <div
      aria-busy="true"
      aria-label={`Loading ${label}`}
      className={`mx-auto w-full max-w-7xl px-4 py-4 ${className}`}
      role="status"
    >
      <span className="sr-only">Loading {label}</span>
      <div aria-hidden="true" className="grid h-full grid-cols-3 gap-3">
        {[0, 1, 2].map((item) => (
          <div
            className="h-full min-h-12 animate-pulse rounded-[var(--radius-public-card)] border border-brand-border/60 bg-public-surface p-3 shadow-sm motion-reduce:animate-none"
            key={item}
          >
            <div className="h-1/2 min-h-5 rounded-[calc(var(--radius-public-card)-0.25rem)] bg-public-blue/10" />
            <div className="mt-2 h-2 w-2/3 rounded-full bg-public-blue/15" />
          </div>
        ))}
      </div>
    </div>
  );
}

const ClientShowcase = dynamic(() => import("../ui/ClientShowcase"), {
  loading: () => <HomeModuleLoading className="h-28" label="client showcase" />,
});

const PartnerShowcase = dynamic(() => import("../ui/PartnerShowcase"), {
  loading: () => <HomeModuleLoading className="h-28" label="partner showcase" />,
});

const TrendingDestinations = dynamic(() => import("../ui/TrendingDestinations"), {
  loading: () => <HomeModuleLoading className="h-[460px]" label="destinations" />,
});

const AwardsShowcase = dynamic(() => import("../ui/AwardsShowcase"), {
  loading: () => <HomeModuleLoading className="h-24" label="awards showcase" />,
});

const homeServiceIcons = {
  "domestic-travel": MapPinned,
  "international-travel": Globe,
  mice: Briefcase,
  "sporting-events": Trophy,
};

const homeServicePresentation = {
  "domestic-travel": { className: "lg:col-span-3", image: Goa },
  "international-travel": {
    className: "sm:col-span-2 lg:col-span-6",
    image: GLOBAL_VOYAGES_IMAGE,
  },
  mice: {
    className: "sm:col-span-2 lg:col-span-6 lg:row-span-2 lg:min-h-[46rem]",
    image: "/gallery/mice.webp",
  },
  "sporting-events": {
    className: "lg:col-span-3",
    image: F1_RACE_IMAGE,
  },
};

const services = PUBLIC_HOME_SERVICES.map((service) => ({
  ...homeServicePresentation[service.id],
  description: service.home.description,
  icon: homeServiceIcons[service.id],
  id: service.id,
  title: service.home.title,
}));

export default function HomeMainClient() {
  const servicesArrowRef = useRef(null);
  const servicesArrowTrigger = useAnimatedIconTrigger(servicesArrowRef);
  return (
    <div className="relative w-full overflow-hidden bg-public-paper">
      <div className="relative z-20 -mt-10 rounded-t-[3rem] border-brand-border/50 border-t bg-public-surface shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
        <TrendingDestinations />
      </div>

      <AnimatedSection className="relative overflow-hidden bg-public-night py-32 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(var(--color-public-blue)_1px,transparent_1px)] opacity-10 [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

        <div className="relative z-10">
          <div className="mb-20 px-4 text-center">
            <h2 className="mb-6 font-heading font-semibold text-4xl md:text-5xl">What We Do</h2>
            <p className="mx-auto max-w-2xl font-light text-lg text-slate-400">
              MICE programmes, corporate travel, leisure holidays, and pilgrimage routes — planned
              end to end.
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
              {...servicesArrowTrigger}
            >
              Explore all services
              <ArrowRightIcon aria-hidden="true" ref={servicesArrowRef} size={18} />
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
            Why companies choose Citius
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-public-muted leading-8">
            Fifteen years in MICE and corporate travel, 52 active corporate partners, and offices in
            Delhi, Kolkata, and Bangalore.
          </p>
        </div>

        <AnimatedSection className="py-20" data-proof-module="company-stats">
          <div className="mb-14 text-center">
            <p className="mb-2 font-medium text-public-blue text-sm uppercase tracking-widest">
              Our Impact
            </p>
            <h3 className="font-heading font-semibold text-3xl text-public-ink md:text-4xl">
              By the Numbers
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
                We handle venue shortlists, delegate logistics, visas, hotels, and on-ground
                coordination — so your team can focus on the programme itself.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {PUBLIC_COMPANY_STRENGTHS.map((usp) => (
                  <UspElement key={usp} title={usp} />
                ))}
              </div>
            </div>
            <div className="public-media-edge group relative min-h-[32rem] overflow-hidden bg-[radial-gradient(circle_at_20%_15%,rgba(72,105,190,0.72),transparent_42%),linear-gradient(145deg,#101a3b_0%,#0B1026_58%,#213b77_100%)]">
              <Image
                alt="The Citius Holidays team together at a company event"
                className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:group-hover:scale-[1.03] motion-reduce:transition-none"
                fill
                sizes="(max-width: 1023px) 100vw, 50vw"
                src="/gallery/aboutus.webp"
              />
              <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] opacity-40 [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
              <Globe
                aria-hidden="true"
                className="absolute top-14 right-10 size-64 text-white/[0.06] transition-transform duration-300 fine-hover:group-hover:-translate-x-2 fine-hover:group-hover:translate-y-2 motion-reduce:transition-none"
                strokeWidth={0.8}
              />
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
            Planning a trip or event?
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-lg text-public-lime/70">
            Tell us your dates, group size, and destination. We&apos;ll send a proposal within two
            business days.
          </p>
          <PublicContactCta>Start Planning Now</PublicContactCta>
        </div>
      </AnimatedSection>
    </div>
  );
}
