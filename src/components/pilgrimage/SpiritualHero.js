"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { MapPin, Clock, Mountain, Users, ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const journeys = [
  {
    id: "14day",
    title: "Kailash Mansarovar Yatra",
    badge: "14-Day Expedition",
    subtitle: "A Sacred Himalayan Expedition of Inner Transformation",
    images: [
      { src: "/gallery/spiritual/kailash-peak.webp", alt: "Mount Kailash" },
      { src: "/gallery/spiritual/mansarovar-lake.webp", alt: "Lake Mansarovar" },
      { src: "/gallery/spiritual/kora-path.webp", alt: "Kailash Kora" },
      { src: "/gallery/spiritual/drolma-la.webp", alt: "Drolma La Pass" }
    ],
    quickFacts: [
      { icon: Clock, label: "Duration", value: "14 Days" },
      { icon: Mountain, label: "Max Altitude", value: "5,650m" },
      { icon: MapPin, label: "Route", value: "Ex-Kathmandu" },
      { icon: Users, label: "Group Size", value: "15-25" }
    ],
    price: "INR 2.65 Lakh",
    cta: "Begin Your Transformation"
  },
  {
    id: "aerial",
    title: "Kailash Aerial Darshan",
    badge: "2N/3D Aerial Tour",
    subtitle: "Divine Blessings Without the Trek — For Senior Yatris & All Seekers",
    images: [
      { src: "/gallery/spiritual/aerial-view.webp", alt: "Aerial Kailash" },
      { src: "/gallery/spiritual/flight-window.webp", alt: "Flight Darshan" },
      { src: "/gallery/spiritual/mansarovar-aerial.webp", alt: "Lake from Sky" },
      { src: "/gallery/spiritual/himalayan-range.webp", alt: "Himalayan Range" }
    ],
    quickFacts: [
      { icon: Clock, label: "Duration", value: "2N/3D" },
      { icon: Mountain, label: "Max Altitude", value: "32,000 ft" },
      { icon: MapPin, label: "Route", value: "Ex-Lucknow" },
      { icon: Users, label: "Group Size", value: "25+ pax" }
    ],
    price: "From INR 49,500",
    cta: "Experience Aerial Darshan"
  }
];

export default function SpiritualHero() {
  const [journeyIndex, setJourneyIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);

  const currentJourney = journeys[journeyIndex];

  // Auto-cycle through images within a journey
  useEffect(() => {
    const imageTimer = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % currentJourney.images.length);
    }, 5000);
    return () => clearInterval(imageTimer);
  }, [currentJourney.images.length, journeyIndex]);

  const transitionConfig = { duration: 1.2, ease: [0.4, 0, 0.2, 1] };

  return (
    <section className="relative h-screen min-h-[800px] w-full overflow-hidden bg-brand-dark">
      {/* Background Slideshow */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={`${currentJourney.id}-${imageIndex}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.7, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-linear-to-b from-citius-blue/20 via-transparent to-brand-dark/60 z-10" />
          <Image
            src={currentJourney.images[imageIndex].src}
            alt={currentJourney.images[imageIndex].alt}
            fill
            className="object-cover"
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* Atmospheric Gradients */}
      <div className="absolute inset-0 z-10 bg-linear-to-b from-brand-dark/70 via-brand-dark/20 to-brand-dark" />
      <div className="absolute inset-0 z-10 bg-linear-to-r from-brand-dark/50 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-20 flex h-full items-center justify-center px-6">
        <div className="max-w-5xl text-center">
          {/* Main Heading - Static across both journeys */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="mb-3 md:mb-4 block text-xs font-medium uppercase tracking-[0.4em] text-citius-orange">
              Citius Spiritual Trails — 2026
            </span>

            <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight mb-6 md:mb-8">
              Kailash Mansarovar
              <br />
              <span className="text-citius-orange italic">Yatra 2026</span>
            </h1>
          </motion.div>

          {/* Journey Content - Changes with toggle */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentJourney.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {/* Journey Badge */}
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 mb-5">
                <span className="w-2 h-2 rounded-full bg-citius-orange animate-pulse" />
                <span className="text-white/90 text-xs md:text-sm font-medium tracking-wider uppercase">
                  {currentJourney.badge}
                </span>
              </div>

              <p className="font-sans text-lg md:text-2xl italic text-white/80 max-w-3xl mx-auto px-4 leading-relaxed mb-5">
                {currentJourney.subtitle}
              </p>

              {/* Quick Facts */}
              <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6">
                {currentJourney.quickFacts.slice(0, 3).map((fact, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 md:px-4 py-2 rounded-full border border-white/20"
                  >
                    <fact.icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-citius-orange" />
                    <span className="text-white/90 text-xs md:text-sm">
                      <span className="text-white/60">{fact.label}:</span>{" "}
                      <span className="text-white font-medium">{fact.value}</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Price and CTA */}
              <div className="mt-4 md:mt-6">
                <p className="text-white/60 text-sm md:text-base mb-4">
                  Starting from <span className="text-citius-orange font-semibold text-lg md:text-xl">{currentJourney.price}</span>
                </p>
                <button
                  onClick={() => scrollToSection("journey-details")}
                  className="inline-flex items-center gap-2 px-8 md:px-10 py-3.5 md:py-4 bg-citius-orange text-white font-heading tracking-widest text-xs md:text-sm rounded-full shadow-xl shadow-citius-orange/20 hover:shadow-citius-orange/40 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 transition-all duration-300 cursor-pointer"
                >
                  {currentJourney.cta}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-12 md:mt-16 flex flex-col items-center gap-3"
          >
            <div className="h-12 md:h-16 w-px bg-linear-to-b from-citius-orange to-transparent" />
            <p className="font-sans text-xs uppercase tracking-[0.3em] text-white/50">
              Scroll to Explore
            </p>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="w-5 h-5 text-white/40" />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Journey Toggle - Bottom Right */}
      <div className="absolute bottom-8 md:bottom-12 right-8 md:right-12 z-30 flex flex-col items-end gap-3">
        <div className="bg-brand-dark/60 backdrop-blur-md rounded-full p-1.5 border border-white/20 shadow-lg">
          <div className="flex gap-1">
            {journeys.map((journey, idx) => (
              <button
                key={journey.id}
                onClick={() => {
                  setJourneyIndex(idx);
                  setImageIndex(0);
                }}
                className={cn(
                  "px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-heading tracking-wider transition-all duration-300",
                  idx === journeyIndex
                    ? "bg-citius-orange text-white shadow-lg"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                {journey.id === "14day" ? "14-Day Yatra" : "2N/3D Aerial"}
              </button>
            ))}
          </div>
        </div>

        {/* Image Navigation Indicators */}
        <div className="flex gap-2">
          {currentJourney.images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setImageIndex(idx)}
              className={cn(
                "h-1 transition-all duration-500 rounded-full",
                idx === imageIndex
                  ? "w-8 bg-citius-orange"
                  : "w-2 bg-white/30 hover:bg-white/50"
              )}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Side Label */}
      <div className="absolute left-6 md:left-12 top-1/2 z-20 hidden -translate-y-1/2 -rotate-90 origin-left lg:block">
        <p className="font-heading text-xs tracking-[1em] text-white/20 uppercase whitespace-nowrap">
          The Journey Within
        </p>
      </div>

      {/* Year Badge */}
      <div className="absolute bottom-8 md:bottom-12 left-8 md:left-12 z-20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <span className="font-heading text-citius-orange font-bold text-sm md:text-base">26</span>
          </div>
          <div className="text-left">
            <p className="text-white/40 text-xs uppercase tracking-wider">Departures</p>
            <p className="text-white text-sm font-medium">June — September</p>
          </div>
        </div>
      </div>
    </section>
  );
}
