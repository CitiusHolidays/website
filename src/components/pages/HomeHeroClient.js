"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import HeroVideo from "./HeroVideo";

export default function HomeHeroClient() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={heroRef}
      className="relative h-screen min-h-[700px] flex items-center justify-center text-center overflow-hidden"
    >
      <motion.div
        style={{ y, opacity, willChange: "transform, opacity" }}
        className="absolute inset-0 w-full h-full"
      >
        <HeroVideo className="object-cover object-center w-full h-full brightness-[0.65]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay" />
      </motion.div>

      <div className="relative z-10 px-4 max-w-5xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 inline-block px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-medium tracking-wider text-white uppercase"
        >
          Premium Travel Partners
        </motion.div>

        <h1 className="font-heading font-semibold text-4xl md:text-6xl lg:text-7xl text-white leading-[1.1] tracking-tight mb-8 drop-shadow-2xl">
          Your next great journey <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white italic">
            starts here.
          </span>
        </h1>

        <motion.p
          className="mb-10 text-lg md:text-xl text-slate-200 max-w-2xl mx-auto leading-relaxed font-light"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
        >
          Crafted by experts. Designed for you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
          className="flex gap-4"
        >
          <Link
            href="/contact"
            className="group relative px-8 py-4 bg-white text-slate-900 rounded-full font-semibold text-sm overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            <span className="relative z-10 flex items-center gap-2">
              Plan Your Trip{" "}
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>

          <Link
            href="/services"
            className="px-8 py-4 bg-transparent border border-white/30 text-white rounded-full font-semibold text-sm hover:bg-white/10 backdrop-blur-sm transition-all duration-300"
          >
            Explore Services
          </Link>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/50 to-transparent" />
      </motion.div>
    </section>
  );
}
