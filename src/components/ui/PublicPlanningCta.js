"use client";

import AnimatedSection from "../layout/AnimatedSection";
import PublicContactCta from "./PublicContactCta";
import PublicGrain from "./PublicGrain";

// The standard closing call on public pages: one place to ask for a proposal.
export default function PublicPlanningCta() {
  return (
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
  );
}
