"use client";

import { MapPin } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import {
  domesticDestinations as defaultDomesticDestinations,
  internationalDestinations as defaultInternationalDestinations,
} from "@/data/trendingDestinations";

function DestinationCard({ destination, index }) {
  return (
    <m.div
      className="group relative h-[500px] w-[85vw] flex-shrink-0 cursor-pointer overflow-hidden rounded-3xl md:w-[400px]"
      initial={{ opacity: 0, x: 50 }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, x: 0 }}
    >
      <Image
        alt={destination.name}
        className="object-cover transition-transform duration-700 group-hover:scale-105"
        fill
        quality={90}
        // Wider than the 400px card: object-cover on landscape photos is height-limited
        // (500px tall); a width-only sizes hint made Next serve ~400px-wide assets whose
        // short side was upscaled — soft / “zoomed” look. Hint ~2× the long edge for cover + DPR.
        sizes="(max-width: 768px) 85vw, 1000px"
        src={destination.image || "/placeholder.svg"}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />

      {/* Rank Badge */}
      <div className="absolute top-6 left-6 rounded-full border border-white/20 bg-white/20 px-3 py-1 font-bold text-white text-xs uppercase tracking-wider backdrop-blur-md">
        #{destination.rank} Trending
      </div>

      <div className="absolute right-0 bottom-0 left-0 translate-y-4 transform p-8 transition-transform duration-500 group-hover:translate-y-0">
        <h3 className="mb-2 font-bold font-heading text-4xl text-white">{destination.name}</h3>
        <div className="mb-4 flex items-center gap-2 text-sm text-white/80">
          <MapPin size={16} />
          <span>{destination.percentage}% Popularity Score</span>
        </div>

        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 group-hover:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <p className="mb-6 text-slate-300 text-sm opacity-0 transition-opacity delay-100 duration-500 group-hover:opacity-100">
              {destination.description}
            </p>
          </div>
        </div>

        {/* <div className="flex items-center gap-2 text-white font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200">
            Explore <ArrowRight size={16} />
        </div> */}
      </div>
    </m.div>
  );
}

export default function TrendingDestinations({
  internationalDestinations = defaultInternationalDestinations,
  domesticDestinations = defaultDomesticDestinations,
}) {
  const [activeTab, setActiveTab] = useState("international");
  const destinations =
    activeTab === "international" ? internationalDestinations : domesticDestinations;

  return (
    <div className="relative overflow-hidden py-24">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 -z-10 size-[500px] rounded-full bg-blue-100/50 blur-[120px]" />

      <div className="mx-auto mb-12 flex max-w-7xl flex-col justify-between gap-6 px-4 md:flex-row md:items-end">
        <div>
          <m.h2
            className="mb-4 font-bold font-heading text-4xl text-brand-dark md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            Trending Now
          </m.h2>
          <p className="max-w-md text-brand-muted text-lg">
            Discover the most sought-after destinations for meetings, incentives, conferences, and
            exhibitions
          </p>
        </div>

        <div className="flex rounded-full bg-slate-100 p-1">
          <button
            className={`rounded-full px-6 py-2.5 font-medium text-sm transition-all duration-300 ${
              activeTab === "international"
                ? "bg-white text-brand-dark shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            onClick={() => setActiveTab("international")}
            type="button"
          >
            International
          </button>
          <button
            className={`rounded-full px-6 py-2.5 font-medium text-sm transition-all duration-300 ${
              activeTab === "domestic"
                ? "bg-white text-brand-dark shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            onClick={() => setActiveTab("domestic")}
            type="button"
          >
            Domestic
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="scrollbar-hide overflow-x-auto pb-8 pl-4 md:pl-18">
        <div className="flex w-max gap-6 pr-4 md:pr-10">
          {destinations.length > 0 ? (
            destinations.map((destination, index) => (
              <DestinationCard destination={destination} index={index} key={destination.name} />
            ))
          ) : (
            <div className="w-full py-20 text-center text-brand-muted">Coming Soon…</div>
          )}
        </div>
      </div>
    </div>
  );
}
