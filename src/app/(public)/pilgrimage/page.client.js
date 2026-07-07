"use client";

import { ArrowRight, Heart, Phone, Shield, Sparkles, Sunrise } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import AnimatedSection from "@/components/layout/AnimatedSection";
import JourneyComparison from "@/components/pilgrimage/JourneyComparison";
import SacredSitesVisual from "@/components/pilgrimage/SacredSitesVisual";
import SpiritualHero from "@/components/pilgrimage/SpiritualHero";
import SpiritualTrailsHub from "@/components/pilgrimage/SpiritualTrailsHub";
import TestimonialsSection from "@/components/pilgrimage/TestimonialsSection";
import GalleryGridSmall from "@/components/ui/GalleryGridSmall";
import { getTrailsForHub, groupTrailsForHub } from "@/data/trails";

export default function PilgrimagePageClient({ images }) {
  const hubGroups = groupTrailsForHub(getTrailsForHub());

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <SpiritualHero />

      {/* Introduction Section */}
      <section className="relative overflow-hidden bg-[#fdfcfb] py-16 md:py-32">
        {/* Subtle background texture */}
        <div className="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] opacity-[0.03]" />

        <AnimatedSection className="relative z-10 mx-auto max-w-6xl px-4 text-center">
          <m.div
            className="mb-10 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
              Citius Spiritual Trails
            </span>
            <h2 className="mb-4 font-heading text-3xl text-brand-dark leading-tight md:mb-6 md:text-5xl lg:text-6xl">
              The 2026 Kailash <br className="hidden md:block" />
              <span className="text-citius-blue italic">Mansarovar Collection</span>
            </h2>
            <p className="mx-auto max-w-3xl font-sans text-brand-muted text-lg leading-relaxed md:text-xl">
              Flagship yatra and aerial darshan , plus specialised routes and programmes opening
              soon. Explore every trail below for galleries, dates, inclusions, and booking.
            </p>
            <div className="mx-auto mt-6 h-px w-16 bg-citius-orange/30 md:mt-10 md:w-24" />
          </m.div>

          <div className="grid items-start gap-8 text-left md:gap-16 lg:grid-cols-2">
            <m.div
              className="space-y-5 font-sans text-brand-muted text-lg leading-relaxed md:space-y-6 md:text-xl"
              initial={{ opacity: 0, x: -30 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <p>
                For centuries, the Kailash Mansarovar Yatra has drawn seekers from across the world.
                The mountain stands as a silent witness to the human quest for transcendence ,
                untouched by climbers, unmarked by human ambition, yet profoundly transformative to
                all who approach it with devotion.
              </p>
              <p>
                <strong className="font-semibold text-brand-dark">Citius Spiritual Trails</strong>{" "}
                offers two carefully crafted journeys for 2026. Whether you seek the complete
                pilgrimage experience or divine darshan without physical exertion, both paths lead
                to the same blessings.
              </p>
              <div className="pt-4">
                <p className="font-heading text-citius-blue text-xl italic">
                  &ldquo;The mountain does not judge your path. It only reflects your
                  devotion.&rdquo;
                </p>
              </div>
            </m.div>

            <div className="grid gap-4 md:gap-5">
              {[
                {
                  desc: "Every ritual, every stop, every moment designed for inner transformation.",
                  icon: Sparkles,
                  title: "Spiritually Curated",
                },
                {
                  desc: "Experienced guides, medical support, and acclimatization protocols at every step.",
                  icon: Shield,
                  title: "Safety First",
                },
                {
                  desc: "Quality accommodation, pure vegetarian meals, and seamless logistics.",
                  icon: Heart,
                  title: "Comfort & Care",
                },
                {
                  desc: "Immersive storytelling that brings the spiritual significance alive.",
                  icon: Sunrise,
                  title: "Sacred Stories",
                },
              ].map((item, idx) => (
                <m.div
                  className="group flex gap-4 rounded-2xl border border-brand-light bg-white p-5 shadow-sm transition-all hover:border-citius-orange/20 hover:shadow-md md:gap-5 md:p-6"
                  initial={{ opacity: 0, x: 20 }}
                  key={item.title}
                  transition={{ delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, x: 0 }}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-light transition-colors group-hover:bg-citius-orange/10 md:h-12 md:w-12">
                    <item.icon className="size-5 text-citius-orange md:h-6 md:w-6" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-heading font-semibold text-base text-citius-blue md:text-lg">
                      {item.title}
                    </h3>
                    <p className="text-brand-muted text-sm leading-relaxed md:text-base">
                      {item.desc}
                    </p>
                  </div>
                </m.div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Journey Comparison */}
      <div id="journey-details">
        <JourneyComparison />
      </div>

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
            <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
              Why Choose Citius
            </span>
            <h2 className="mb-4 font-heading text-3xl text-brand-dark md:text-4xl lg:text-5xl">
              Your Trust, <span className="text-citius-blue italic">Our Commitment</span>
            </h2>
          </m.div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {[
              {
                desc: "Conducting sacred journeys with deep understanding of both logistics and spiritual significance.",
                stat: "1000+",
                statLabel: "Yatris served",
                title: "15+ Years Experience",
              },
              {
                desc: "Emergency protocols, medical support, oxygen cylinders, and trained guides at every altitude.",
                stat: "100%",
                statLabel: "Safety record",
                title: "Safety Excellence",
              },
              {
                desc: "Every ritual performed traditionally. Every site approached with reverence and understanding.",
                stat: "14",
                statLabel: "Days of transformation",
                title: "Sacred Authenticity",
              },
            ].map((item, idx) => (
              <m.div
                className="rounded-2xl border border-brand-light bg-brand-light/50 p-6 text-center transition-all hover:border-citius-orange/30 md:p-8"
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
                <p className="mb-2 text-brand-muted text-xs uppercase tracking-wider">
                  {item.statLabel}
                </p>
                <h3 className="mb-2 font-heading text-citius-blue text-lg md:text-xl">
                  {item.title}
                </h3>
                <p className="text-brand-muted text-sm leading-relaxed">{item.desc}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <AnimatedSection className="bg-brand-dark px-4 py-16 text-white md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col items-start justify-between gap-6 text-center md:mb-14 md:flex-row md:items-end md:text-left">
            <div className="w-full md:w-auto">
              <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
                Visual Stories
              </span>
              <h2 className="font-heading text-3xl leading-tight md:text-5xl">
                Glimpses of <br className="hidden md:block" />
                <span className="text-citius-orange">the Sacred</span>
              </h2>
            </div>
            <p className="mx-auto max-w-md font-sans text-base text-white/60 md:mx-0 md:text-lg">
              Capturing moments of devotion, stillness, and the raw beauty of the spiritual
              landscape.
            </p>
          </div>
          <div className="gallery-light">
            <GalleryGridSmall images={images} />
          </div>
          <p className="mt-8 text-center text-sm text-white/40">
            Images from previous yatras. Your journey will create its own sacred memories.
          </p>
        </div>
      </AnimatedSection>

      {/* Final CTA Section */}
      <section className="bg-linear-to-b from-[#f8f5f2] to-white py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <m.div
            className="rounded-3xl border border-brand-light bg-white p-8 shadow-2xl shadow-brand-dark/10 md:p-12"
            initial={{ opacity: 0, y: 30 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-citius-orange/10">
              <Phone className="size-7 text-citius-orange" />
            </div>
            <h2 className="mb-4 font-heading text-2xl text-brand-dark md:text-4xl">
              Begin Your Sacred Journey
            </h2>
            <p className="mx-auto mb-8 max-w-xl font-sans text-base text-brand-muted md:text-lg">
              Speak with our yatra specialists to understand which journey suits you best.
              We&apos;re here to guide you every step of the way.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-full bg-citius-orange px-8 py-4 font-heading text-sm text-white tracking-wider shadow-citius-orange/20 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-citius-orange/40"
                href="/contact"
              >
                Request Detailed Brochure
                <ArrowRight className="size-4" />
              </Link>
              {/* <a 
                href="tel:+91XXXXXXXXXX"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-dark text-white font-heading tracking-wider text-sm rounded-full hover:bg-brand-dark/90 transition-all duration-300"
              >
                <Phone className="size-4" />
                Call Our Team
              </a> */}
            </div>
            <p className="mt-6 text-brand-muted text-xs">
              Early registration recommended. 2026 departures filling fast.
            </p>
          </m.div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="fixed right-0 bottom-0 left-0 z-50 flex gap-3 border-brand-light border-t bg-white p-3 px-4 shadow-lg md:hidden">
        <a
          className="flex-1 rounded-full bg-brand-dark py-3 text-center font-medium text-sm text-white"
          href="tel:+91XXXXXXXXXX"
        >
          Call Now
        </a>
        <Link
          className="flex-1 rounded-full bg-citius-orange py-3 text-center font-medium text-sm text-white"
          href="/contact"
        >
          Enquire
        </Link>
      </div>
    </div>
  );
}
