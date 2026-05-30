"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

export default function SacredBharatPromoBanner() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-12 md:py-16 px-4 max-w-6xl mx-auto"
    >
      <div className="rounded-2xl border border-citius-blue/20 bg-linear-to-br from-citius-blue/8 via-white to-citius-orange/8 p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="font-heading text-citius-orange text-xs tracking-[0.3em] uppercase mb-2 block">
            New
          </span>
          <h2 className="font-heading text-2xl md:text-3xl text-brand-dark mb-2">
            Sacred Bharat — Journey of the Soul™
          </h2>
          <p className="font-sans text-brand-muted max-w-xl">
            Mark temples across 12 spiritual trails, earn badges and points, and build your digital
            pilgrimage legacy. Free to track — sign in to save and join the leaderboard.
          </p>
        </div>
        <Link
          href="/sacred-bharat"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-citius-blue px-6 py-3 text-sm font-medium text-white hover:bg-citius-blue/90 transition-colors"
        >
          <Sparkles size={18} />
          Start your journey
          <ArrowRight size={16} />
        </Link>
      </div>
    </motion.section>
  );
}
