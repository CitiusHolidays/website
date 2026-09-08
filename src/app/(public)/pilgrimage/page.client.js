"use client";

import { ArrowRight, Phone } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import AnimatedSection from "@/components/layout/AnimatedSection";
import PilgrimageRouteFitSelector from "@/components/pilgrimage/PilgrimageRouteFitSelector";
import SacredSitesVisual from "@/components/pilgrimage/SacredSitesVisual";
import SpiritualHero from "@/components/pilgrimage/SpiritualHero";
import SpiritualTrailsHub from "@/components/pilgrimage/SpiritualTrailsHub";
import TestimonialsSection from "@/components/pilgrimage/TestimonialsSection";
import GalleryGridSmall from "@/components/ui/GalleryGridSmall";
import { getTrailsForHub, groupTrailsForHub } from "@/data/trails";
import { PILGRIMAGE_CONTACT_HREFS } from "@/lib/public/contactIntent";

export default function PilgrimagePageClient({ images }) {
  const hubGroups = groupTrailsForHub(getTrailsForHub());

  return (
    <div className="bg-public-surface">
      {/* Hero Section */}
      <SpiritualHero />

      <PilgrimageRouteFitSelector />

      <SpiritualTrailsHub groups={hubGroups} />

      {/* Sacred Sites Visual */}
      <SacredSitesVisual />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Why Citius - Trust Section */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <m.div
            className="mb-12 text-center md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="mb-4 font-heading text-3xl text-public-ink md:text-4xl lg:text-5xl">
              Why choose Citius: Your Trust,{" "}
              <span className="text-public-blue">Our Commitment</span>
            </h2>
          </m.div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {[
              {
                desc: "Yatra logistics and route planning backed by 15+ years of Himalayan pilgrimage operations.",
                stat: "1000+",
                statLabel: "Yatris served",
                title: "15+ Years Operating",
              },
              {
                desc: "Emergency protocols, medical support, oxygen cylinders, and trained guides at every altitude.",
                stat: "100%",
                statLabel: "Safety record",
                title: "Safety Protocols",
              },
              {
                desc: "Rituals performed in traditional form. Sites approached with guidance on local custom.",
                stat: "14",
                statLabel: "Days on the full yatra",
                title: "Traditional Practice",
              },
            ].map((item, idx) => (
              <m.div
                className="rounded-2xl border border-brand-light bg-brand-light/50 p-6 text-center transition-colors hover:border-citius-orange/30 md:p-8"
                initial={{ opacity: 0, y: 20 }}
                key={item.title}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-citius-blue/10">
                  <span className="font-bold font-heading text-2xl text-citius-blue">
                    {item.stat}
                  </span>
                </div>
                <p className="mb-2 text-public-muted text-xs uppercase tracking-wider">
                  {item.statLabel}
                </p>
                <h3 className="mb-2 font-heading text-citius-blue text-lg md:text-xl">
                  {item.title}
                </h3>
                <p className="text-public-muted text-sm leading-relaxed">{item.desc}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <AnimatedSection className="bg-public-night px-4 py-16 text-white md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col items-start justify-between gap-6 text-center md:mb-14 md:flex-row md:items-end md:text-left">
            <div className="w-full md:w-auto">
              <h2 className="font-heading text-3xl leading-tight md:text-5xl">
                Visual stories: Glimpses of <br className="hidden md:block" />
                <span className="text-public-orange">the Sacred</span>
              </h2>
            </div>
            <p className="mx-auto max-w-md font-sans text-base text-white/60 md:mx-0 md:text-lg">
              Photos from previous yatras — devotion, rest stops, and the Himalayan route.
            </p>
          </div>
          <div className="gallery-light">
            <GalleryGridSmall images={images} />
          </div>
          <p className="mt-8 text-center text-brand-muted-on-dark text-sm">
            Photos from previous departures.
          </p>
        </div>
      </AnimatedSection>

      {/* Final CTA Section */}
      <section className="bg-linear-to-b from-public-paper to-public-surface py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <m.div
            className="rounded-3xl border border-brand-light bg-white p-8 shadow-2xl shadow-brand-dark/10 md:p-12"
            initial={{ opacity: 0, y: 30 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-citius-orange/10">
              <Phone className="size-7 text-public-orange-ink" />
            </div>
            <h2 className="mb-4 font-heading text-2xl text-public-ink md:text-4xl">
              Talk Through Your Kailash Plans
            </h2>
            <p className="mx-auto mb-8 max-w-xl font-sans text-base text-public-muted md:text-lg">
              Speak with a yatra specialist to compare the published 14-day route and aerial darshan
              details, then identify the questions that still need confirmation.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-full bg-citius-orange px-8 py-4 font-heading text-brand-dark text-sm tracking-wider shadow-citius-orange/20 shadow-xl transition-[translate,box-shadow] duration-300 fine-hover:hover:-translate-y-0.5 hover:shadow-citius-orange/40"
                href={PILGRIMAGE_CONTACT_HREFS.callback}
              >
                Request a Callback
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="mt-6 text-public-muted text-xs">
              Programme details are reviewed with you before any booking decision.
            </p>
          </m.div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="safe-area-bottom-bar fixed right-0 bottom-0 left-0 z-50 flex gap-3 border-brand-light border-t bg-white pt-3 shadow-lg md:hidden">
        <Link
          className="flex-1 rounded-full bg-brand-dark py-3 text-center font-medium text-sm text-white"
          href={PILGRIMAGE_CONTACT_HREFS.callback}
        >
          Request Callback
        </Link>
        <Link
          className="flex-1 rounded-full bg-citius-orange py-3 text-center font-medium text-brand-dark text-sm"
          href={PILGRIMAGE_CONTACT_HREFS.enquiry}
        >
          Enquire
        </Link>
      </div>
    </div>
  );
}
