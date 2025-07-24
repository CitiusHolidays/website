"use client"

import { motion } from "motion/react";
import AnimatedSection from "../../components/layout/AnimatedSection";
import GalleryGrid from "../../components/ui/GalleryGrid";

export default function GalleryPageClient({ images }) {
  return (
    <>
      <section className="relative h-[70vh] flex items-center justify-center text-center overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/gallery/bgfooter.png"
          className="absolute inset-0 w-full h-full object-cover bg-brand-dark object-center brightness-75"
        >
          <source src="/gallery/sunset.mp4" type="video/mp4" />
        </video>
        <div className="relative z-10 max-w-3xl px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-bold text-brand-light mb-4"
          >
            Gallery
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-brand-light"
          >
            Browse memorable moments and events curated by Citius across the
            globe.
          </motion.p>
        </div>
      </section>
      {/* <AnimatedSection className="py-16 bg-white px-4"> */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="py-16 bg-white px-4"
        >
          <GalleryGrid images={images} className="max-w-6xl mx-auto" />
        </motion.div>
      {/* </AnimatedSection> */}
    </>
  );
}
