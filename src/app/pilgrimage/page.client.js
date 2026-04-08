"use client";

import { motion } from "motion/react";
import { Heart, Shield, Sunrise, Sparkles, ArrowRight, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import AnimatedSection from "../../components/layout/AnimatedSection";
import GalleryGridSmall from "../../components/ui/GalleryGridSmall";
import SpiritualHero from "../../components/pilgrimage/SpiritualHero";
import SpiritualTrailsHub from "../../components/pilgrimage/SpiritualTrailsHub";
import TestimonialsSection from "../../components/pilgrimage/TestimonialsSection";
import SacredSitesVisual from "../../components/pilgrimage/SacredSitesVisual";
import JourneyComparison from "../../components/pilgrimage/JourneyComparison";
import { getTrailsForHub, groupTrailsForHub } from "../../data/trails";

export default function PilgrimagePageClient({ images }) {
  const hubGroups = groupTrailsForHub(getTrailsForHub());

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <SpiritualHero />

      {/* Introduction Section */}
      <section className="relative py-16 md:py-32 overflow-hidden bg-[#fdfcfb]">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
        
        <AnimatedSection className="px-4 max-w-6xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 md:mb-16"
          >
            <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
              Citius Spiritual Trails
            </span>
            <h2 className="font-heading text-3xl md:text-5xl lg:text-6xl text-brand-dark mb-4 md:mb-6 leading-tight">
              The 2026 Kailash <br className="hidden md:block" />
              <span className="text-citius-blue italic">Mansarovar Collection</span>
            </h2>
            <p className="font-sans text-lg md:text-xl text-brand-muted max-w-3xl mx-auto leading-relaxed">
              Flagship yatra and aerial darshan — plus specialised routes and programmes opening soon.
              Explore every trail below for galleries, dates, inclusions, and booking.
            </p>
            <div className="w-16 md:w-24 h-px bg-citius-orange/30 mx-auto mt-6 md:mt-10" />
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-start text-left">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-5 md:space-y-6 font-sans text-lg md:text-xl text-brand-muted leading-relaxed"
            >
              <p>
                For centuries, the Kailash Mansarovar Yatra has drawn seekers from across the world. 
                The mountain stands as a silent witness to the human quest for transcendence — 
                untouched by climbers, unmarked by human ambition, yet profoundly transformative 
                to all who approach it with devotion.
              </p>
              <p>
                <strong className="text-brand-dark font-semibold">Citius Spiritual Trails</strong> offers 
                two carefully crafted journeys for 2026. Whether you seek the complete pilgrimage experience 
                or divine darshan without physical exertion, both paths lead to the same blessings.
              </p>
              <div className="pt-4">
                <p className="font-heading text-citius-blue italic text-xl">
                  &ldquo;The mountain does not judge your path. It only reflects your devotion.&rdquo;
                </p>
              </div>
            </motion.div>
            
            <div className="grid gap-4 md:gap-5">
              {[
                { 
                  title: "Spiritually Curated", 
                  desc: "Every ritual, every stop, every moment designed for inner transformation.", 
                  icon: Sparkles 
                },
                { 
                  title: "Safety First", 
                  desc: "Experienced guides, medical support, and acclimatization protocols at every step.", 
                  icon: Shield 
                },
                { 
                  title: "Comfort & Care", 
                  desc: "Quality accommodation, pure vegetarian meals, and seamless logistics.", 
                  icon: Heart 
                },
                { 
                  title: "Sacred Stories", 
                  desc: "Immersive storytelling that brings the spiritual significance alive.", 
                  icon: Sunrise 
                },
              ].map((item, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex gap-4 md:gap-5 p-5 md:p-6 bg-white rounded-2xl shadow-sm border border-brand-light hover:shadow-md hover:border-citius-orange/20 transition-all group"
                >
                  <div className="shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-full bg-brand-light flex items-center justify-center group-hover:bg-citius-orange/10 transition-colors">
                    <item.icon className="w-5 h-5 md:w-6 md:h-6 text-citius-orange" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base md:text-lg font-semibold text-citius-blue mb-1">{item.title}</h3>
                    <p className="text-sm md:text-base text-brand-muted leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
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
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 md:mb-16"
          >
            <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
              Why Choose Citius
            </span>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl text-brand-dark mb-4">
              Your Trust, <span className="text-citius-blue italic">Our Commitment</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                title: "15+ Years Experience",
                desc: "Conducting sacred journeys with deep understanding of both logistics and spiritual significance.",
                stat: "1000+",
                statLabel: "Yatris served"
              },
              {
                title: "Safety Excellence",
                desc: "Emergency protocols, medical support, oxygen cylinders, and trained guides at every altitude.",
                stat: "100%",
                statLabel: "Safety record"
              },
              {
                title: "Sacred Authenticity",
                desc: "Every ritual performed traditionally. Every site approached with reverence and understanding.",
                stat: "14",
                statLabel: "Days of transformation"
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center p-6 md:p-8 bg-brand-light/50 rounded-2xl border border-brand-light hover:border-citius-orange/30 transition-all"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-citius-blue/10 flex items-center justify-center">
                  <span className="font-heading text-2xl text-citius-blue font-bold">{item.stat}</span>
                </div>
                <p className="text-xs text-brand-muted uppercase tracking-wider mb-2">{item.statLabel}</p>
                <h3 className="font-heading text-lg md:text-xl text-citius-blue mb-2">{item.title}</h3>
                <p className="text-sm text-brand-muted leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <AnimatedSection className="py-16 md:py-32 px-4 bg-brand-dark text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 md:mb-14 gap-6 text-center md:text-left">
            <div className="w-full md:w-auto">
              <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
                Visual Stories
              </span>
              <h2 className="font-heading text-3xl md:text-5xl leading-tight">
                Glimpses of <br className="hidden md:block" />
                <span className="text-citius-orange">the Sacred</span>
              </h2>
            </div>
            <p className="font-sans text-base md:text-lg text-white/60 max-w-md mx-auto md:mx-0">
              Capturing moments of devotion, stillness, and the raw beauty of the spiritual landscape.
            </p>
          </div>
          <div className="gallery-light">
            <GalleryGridSmall images={images} />
          </div>
          <p className="text-center text-white/40 text-sm mt-8">
            Images from previous yatras. Your journey will create its own sacred memories.
          </p>
        </div>
      </AnimatedSection>

      {/* Final CTA Section */}
      <section className="py-16 md:py-24 bg-linear-to-b from-[#f8f5f2] to-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-brand-dark/10 border border-brand-light"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-citius-orange/10 flex items-center justify-center">
              <Phone className="w-7 h-7 text-citius-orange" />
            </div>
            <h2 className="font-heading text-2xl md:text-4xl text-brand-dark mb-4">
              Begin Your Sacred Journey
            </h2>
            <p className="font-sans text-base md:text-lg text-brand-muted mb-8 max-w-xl mx-auto">
              Speak with our yatra specialists to understand which journey suits you best. 
              We&apos;re here to guide you every step of the way.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-citius-orange text-white font-heading tracking-wider text-sm rounded-full shadow-xl shadow-citius-orange/20 hover:shadow-citius-orange/40 hover:-translate-y-0.5 transition-all duration-300"
              >
                Request Detailed Brochure
                <ArrowRight className="w-4 h-4" />
              </Link>
              {/* <a 
                href="tel:+91XXXXXXXXXX"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-dark text-white font-heading tracking-wider text-sm rounded-full hover:bg-brand-dark/90 transition-all duration-300"
              >
                <Phone className="w-4 h-4" />
                Call Our Team
              </a> */}
            </div>
            <p className="text-xs text-brand-muted mt-6">
              Early registration recommended. 2026 departures filling fast.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-light shadow-lg p-3 md:hidden z-50 flex gap-3 px-4">
        <a 
          href="tel:+91XXXXXXXXXX"
          className="flex-1 py-3 bg-brand-dark text-white text-sm font-medium rounded-full text-center"
        >
          Call Now
        </a>
        <Link 
          href="/contact"
          className="flex-1 py-3 bg-citius-orange text-white text-sm font-medium rounded-full text-center"
        >
          Enquire
        </Link>
      </div>
    </div>
  );
}
