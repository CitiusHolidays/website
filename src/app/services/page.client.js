"use client";

import { motion } from "motion/react";
import AnimatedSection from "../../components/layout/AnimatedSection";
import CircularServicesMenu from "../../components/ui/CircularServicesMenu";

export const generateMetadata = () => ({
  title: 'Services | Citius Travel Management',
  description: 'Explore the comprehensive suite of travel and event services offered by Citius, from MICE and VISA assistance to branding and sporting events.',
})

export default function ServicesPage() {
  return (
    <AnimatedSection className="relative py-20 px-4 bg-gradient-to-b from-brand-light via-white to-white overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-citius-blue/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-citius-orange/20 blur-3xl" />

      <div className="relative max-w-4xl mx-auto text-center mb-16">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-4xl md:text-5xl font-extrabold text-citius-blue mb-4"
        >
          A Spectrum of World-Class Services
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-brand-muted max-w-2xl mx-auto"
        >
          Discover our comprehensive suite of services crafted to make every
          journey and event effortless, memorable, and aligned with your
          business goals.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-w-6xl mx-auto"
      >
        <CircularServicesMenu />
      </motion.div>
    </AnimatedSection>
  );
}
