"use client";

import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import Kashmir from "@/static/places/kashmir.webp";
import PublicContactCta from "../ui/PublicContactCta";
import PublicGrain from "../ui/PublicGrain";
import HeroVideo from "./HeroVideo";

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function HomeHeroClient() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    offset: ["start start", "end start"],
    target: heroRef,
  });

  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    ["translate3d(0, 0%, 0)", "translate3d(0, 50%, 0)"]
  );
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const reducedMotionPreference = !!useReducedMotion();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  );
  const shouldReduceMotion = isHydrated && reducedMotionPreference;

  return (
    <section
      className="relative flex min-h-[max(100dvh,700px)] items-center justify-center overflow-hidden text-center"
      ref={heroRef}
    >
      <m.div
        className="motion-reduce-spatial absolute inset-0 z-0 size-full"
        style={{
          opacity: shouldReduceMotion ? 1 : opacity,
          transform: shouldReduceMotion ? "none" : transform,
        }}
      >
        <HeroVideo
          className="size-full object-cover object-center brightness-[0.65]"
          controlClassName="!right-auto !left-[max(1rem,var(--safe-area-inset-left))]"
          poster={Kashmir.src}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-public-night/60" />
      </m.div>
      <PublicGrain className="z-[1]" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4">
        <h1 className="mb-8 max-w-[18ch] text-balance font-heading font-semibold text-4xl text-white leading-[1.4] tracking-tight drop-shadow-2xl md:text-6xl lg:text-7xl lg:leading-tight">
          Your next great journey <span className="text-blue-100">starts here.</span>
        </h1>

        <m.p
          animate={{ opacity: 1, y: 0 }}
          className="motion-reduce-spatial mx-auto mb-10 max-w-2xl font-light text-lg text-slate-200 leading-relaxed md:text-xl"
          initial={false}
          transition={
            shouldReduceMotion ? { duration: 0 } : { delay: 0.3, duration: 0.8, ease: "easeOut" }
          }
        >
          Crafted by experts. Designed for you.
        </m.p>

        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="motion-reduce-spatial flex gap-4"
          initial={false}
          transition={
            shouldReduceMotion ? { duration: 0 } : { delay: 0.5, duration: 0.6, ease: "easeOut" }
          }
        >
          <PublicContactCta>Plan Your Trip</PublicContactCta>

          <Link
            className="material-decorative-glass material-public-night rounded-full border border-white/30 bg-transparent px-8 py-4 font-semibold text-sm text-white backdrop-blur-sm transition-colors duration-300 hover:bg-white/10"
            href="/services"
          >
            Explore Services
          </Link>
        </m.div>
      </div>
    </section>
  );
}
