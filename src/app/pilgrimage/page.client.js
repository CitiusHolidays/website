"use client";

import { motion } from "motion/react";
import { Heart, Shield, Sunrise } from "lucide-react";
import Image from "next/image";
import AnimatedSection from "../../components/layout/AnimatedSection";
import GalleryGridSmall from "../../components/ui/GalleryGridSmall";
import TrailSection from "../../components/pilgrimage/TrailSection";
import SpiritualHero from "../../components/pilgrimage/SpiritualHero";
import { trails } from "../../data/trails";

export default function PilgrimagePageClient({ images }) {
  return (
    <div className="bg-[#fdfcfb]"> {/* Slightly warmer off-white background */}
      {/* Hero Section */}
      <SpiritualHero />

      {/* Introduction */}
      <section className="relative py-16 md:py-32 overflow-hidden">
        {/* Subtle background texture/pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
        
        <AnimatedSection className="px-4 max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 md:mb-16"
          >
            <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">Our Philosophy</span>
            <h2 className="font-heading text-3xl md:text-5xl text-brand-dark mb-6 md:mb-8 leading-tight">
              Begin Your Journey with the <br className="hidden md:block" />
              <span className="text-citius-blue italic">Sacred Mansarovar Yatra</span>
            </h2>
            <div className="w-16 md:w-24 h-px bg-citius-orange/30 mx-auto mb-8 md:mb-12" />
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center text-left">
            <div className="space-y-6 md:space-y-8 font-sans text-xl md:text-3xl text-brand-muted leading-relaxed">
              <p>
                At Citius, we believe a spiritual journey is more than just visiting a temple — it’s an experience that brings families closer, creates inner calm, and leaves you with a sense of purpose.
              </p>
              <p>
                <strong className="text-brand-dark font-semibold">Spiritual Trails</strong> is our curated collection of soulful travel experiences designed to give you spiritual solace, emotional clarity, and memorable family bonding.
              </p>
            </div>
            
            <div className="grid gap-4 md:gap-6">
              {[
                { title: "Mindfully Designed", desc: "Customised to your family’s beliefs, comfort, and pace.", icon: Heart },
                { title: "Deeply Meaningful", desc: "Moments that matter — rituals, walks, insights.", icon: Sunrise },
                { title: "Seamlessly Managed", desc: "We handle everything so you can focus on reflection.", icon: Shield },
              ].map((item, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex gap-4 md:gap-6 p-6 md:p-8 bg-white rounded-2xl shadow-sm border border-brand-light hover:shadow-md transition-shadow group"
                >
                  <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full bg-brand-light flex items-center justify-center group-hover:bg-citius-orange/10 transition-colors">
                    <item.icon className="w-5 h-5 md:w-6 md:h-6 text-citius-orange" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg md:text-xl font-semibold text-citius-blue mb-1 md:mb-2">{item.title}</h3>
                    <p className="text-sm md:text-base text-brand-muted leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Trails Sections */}
      <div className="space-y-0">
        {trails.map((trail, index) => (
          <TrailSection 
            key={trail.id} 
            trail={trail} 
            className={index % 2 === 0 ? "bg-[#f8f5f2]" : "bg-white"} 
          />
        ))}
      </div>

      <AnimatedSection className="py-16 md:py-32 px-4 bg-brand-dark text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 md:mb-16 gap-6 md:gap-8 text-center md:text-left">
            <div className="w-full">
              <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">Visual Stories</span>
              <h2 className="font-heading text-3xl md:text-5xl leading-tight">Glimpses of <br className="hidden md:block" />the Sacred</h2>
            </div>
            <p className="font-sans text-lg md:text-xl text-white/60 max-w-md mx-auto md:mx-0">
              Capturing moments of devotion, stillness, and the raw beauty of the spiritual landscape.
            </p>
          </div>
          <div className="gallery-light">
            <GalleryGridSmall images={images} />
          </div>
        </div>
      </AnimatedSection>

    </div>
  );
}
