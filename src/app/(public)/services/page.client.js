"use client";

import CircularServicesMenu from "@/components/ui/CircularServicesMenu";

export default function ServicesPage() {
  return (
    <>
      <div className="h-19 bg-public-night" />
      <section className="relative overflow-hidden bg-[url('/gallery/bgfooter.webp')] bg-center bg-cover px-4 py-20">
        <div className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-citius-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -bottom-20 size-96 rounded-full bg-citius-orange/20 blur-3xl" />

        <div className="relative mx-auto mb-16 max-w-4xl text-center">
          <h1 className="public-enter mb-4 font-extrabold font-heading text-4xl text-public-blue md:text-5xl">
            Travel & Event Services
          </h1>
          <p className="public-enter mx-auto max-w-2xl text-public-muted [--public-enter-delay:60ms]">
            MICE, visa assistance, event management, branding, sporting hospitality, and pilgrimage
            routes — planned and delivered by one team.
          </p>
        </div>

        {/* The menu staggers its own service orbit in after hydration; no outer gate. */}
        <div className="relative mx-auto max-w-6xl">
          <CircularServicesMenu />
        </div>
      </section>
    </>
  );
}
