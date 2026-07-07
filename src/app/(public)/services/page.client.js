"use client";

import { m } from "motion/react";
import AnimatedSection from "@/components/layout/AnimatedSection";
import CircularServicesMenu from "@/components/ui/CircularServicesMenu";

export default function ServicesPage() {
  return (
    <>
      <div className="h-19 bg-[#0B1026]" />
      {/* <AnimatedSection className="relative py-20 px-4 bg-gradient-to-b from-brand-light via-white to-white overflow-hidden"> */}
      <AnimatedSection className="relative overflow-hidden bg-[url('/gallery/bgfooter.webp')] bg-center bg-cover px-4 py-20">
        <div className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-citius-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -bottom-20 size-96 rounded-full bg-citius-orange/20 blur-3xl" />

        <div className="relative mx-auto mb-16 max-w-4xl text-center">
          <m.h1
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 font-extrabold text-4xl text-citius-blue md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            A Spectrum of World-Class Services
          </m.h1>
          <m.p
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl text-brand-muted"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            Discover our comprehensive suite of services crafted to make every journey and event
            effortless, memorable, and aligned with your business goals.
          </m.p>
        </div>

        <m.div
          animate={{ opacity: 1, scale: 1 }}
          className="relative mx-auto max-w-6xl"
          initial={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <CircularServicesMenu />
        </m.div>
      </AnimatedSection>
    </>
  );
}
