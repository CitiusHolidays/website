"use client";

import { motion } from "motion/react";
import { Heart, Shield, Sunrise } from "lucide-react";
import Image from "next/image";
import AnimatedSection from "../../components/layout/AnimatedSection";
import GalleryGridSmall from "../../components/ui/GalleryGridSmall";
import SectionHeading from "../../components/ui/SectionHeading";
import TrailSection from "../../components/pilgrimage/TrailSection";
import { trails } from "../../data/trails";

export default function PilgrimagePageClient({ images }) {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[#0B1026] z-10 bg-[url('/gallery/bgtrails.png')] bg-cover bg-center" />
        <div className="relative z-20 max-w-4xl px-4 mx-auto text-white">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-lg font-medium tracking-wider uppercase text-citius-orange"
          >
            Meaningful Journeys. Mindful Moments.
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 text-5xl font-bold leading-tight md:text-7xl"
          >
            Spiritual Trails
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl font-light italic opacity-90"
          >
            “Not a trek. Not a tour. A transformation—where every step becomes a prayer.”
          </motion.p>
        </div>
      </section>

      {/* Introduction */}
      <AnimatedSection className="py-20 px-4 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-semibold text-citius-blue mb-8">
          Begin Your Journey with the Sacred Mansarovar Yatra
        </h2>
        <div className="space-y-6 text-lg text-brand-muted leading-relaxed">
          <p>
            At Citius, we believe a spiritual journey is more than just visiting a temple or a sacred site — it’s an experience that brings families closer, creates inner calm, and leaves you with a sense of purpose.
          </p>
          <p>
            <strong>Spiritual Trails</strong> is our curated collection of soulful travel experiences designed to give you spiritual solace, emotional clarity, and memorable family bonding. Whether you seek blessings, gratitude, healing, or simply a peaceful escape, we craft every detail with heart and intention.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          {[
            { title: "Mindfully Designed", desc: "Customised to your family’s beliefs, comfort, and pace.", icon: Heart },
            { title: "Deeply Meaningful", desc: "Moments that matter — rituals, walks, insights.", icon: Sunrise },
            { title: "Seamlessly Managed", desc: "We handle everything so you can focus on reflection.", icon: Shield },
          ].map((item, idx) => (
            <div key={idx} className="p-6 bg-brand-light/30 rounded-xl border border-brand-light">
              <item.icon className="w-10 h-10 text-citius-orange mx-auto mb-4" />
              <h3 className="font-semibold text-citius-blue mb-2">{item.title}</h3>
              <p className="text-sm text-brand-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* Trails Sections */}
      {trails.map((trail, index) => (
        <TrailSection 
          key={trail.id} 
          trail={trail} 
          className={index % 2 === 0 ? "bg-brand-light/20" : "bg-white"} 
        />
      ))}

      <AnimatedSection className="py-20 px-4">
        <SectionHeading title="Glimpses of the Sacred" />
        <GalleryGridSmall images={images} className="mx-auto max-w-6xl" />
      </AnimatedSection>

    </div>
  );
}
