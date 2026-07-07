"use client";

import { ArrowRight } from "lucide-react";
import { m, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import HeroVideo from "./HeroVideo";

export default function HomeHeroClient() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    offset: ["start start", "end start"],
    target: heroRef,
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      className="relative flex h-screen min-h-[700px] items-center justify-center overflow-hidden text-center"
      ref={heroRef}
    >
      <m.div className="absolute inset-0 size-full" style={{ opacity, y }}>
        <HeroVideo className="size-full object-cover object-center brightness-[0.65]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay" />
      </m.div>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4">
        <m.div
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 font-medium text-white text-xs uppercase tracking-wider backdrop-blur-md"
          initial={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          Premium Travel Partners
        </m.div>

        <h1 className="mb-8 font-heading font-semibold text-4xl text-white leading-[1.1] tracking-tight drop-shadow-2xl md:text-6xl lg:text-7xl">
          Your next great journey <br />
          <span className="text-blue-100 italic">starts here.</span>
        </h1>

        <m.p
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-10 max-w-2xl font-light text-lg text-slate-200 leading-relaxed md:text-xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
        >
          Crafted by experts. Designed for you.
        </m.p>

        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
        >
          <Link
            className="group relative overflow-hidden rounded-full bg-white px-8 py-4 font-semibold text-slate-900 text-sm shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            href="/contact"
          >
            <span className="relative z-10 flex items-center gap-2">
              Plan Your Trip{" "}
              <ArrowRight className="transition-transform group-hover:translate-x-1" size={16} />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </Link>

          <Link
            className="rounded-full border border-white/30 bg-transparent px-8 py-4 font-semibold text-sm text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/10"
            href="/services"
          >
            Explore Services
          </Link>
        </m.div>
      </div>

      <m.div
        animate={{ opacity: 1 }}
        className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/50"
        initial={{ opacity: 0 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <span className="text-[10px] uppercase tracking-widest">Scroll</span>
        <div className="h-12 w-[1px] bg-gradient-to-b from-white/50 to-transparent" />
      </m.div>
    </section>
  );
}
