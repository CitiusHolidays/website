"use client";

import { MapPin } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import {
  domesticDestinations as defaultDomesticDestinations,
  internationalDestinations as defaultInternationalDestinations,
} from "@/data/trendingDestinations";

function DestinationCard({ destination }) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  return (
    <article className="group relative flex min-h-[500px] w-[85vw] flex-shrink-0 items-end overflow-hidden rounded-3xl md:w-[400px]">
      <Image
        alt=""
        className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:group-hover:scale-105 motion-reduce:transition-none"
        fill
        sizes="(max-width: 768px) 85vw, 1000px"
        src={destination.image || "/gallery/aboutus.webp"}
      />
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          expanded ? "opacity-100" : "opacity-90 fine-hover:group-hover:opacity-100"
        }`}
      />

      <div className="material-decorative-glass absolute top-6 left-6 rounded-full border border-white/20 bg-white/20 px-3 py-1 font-bold text-white text-xs uppercase tracking-wider backdrop-blur-md">
        #{destination.rank} Trending
      </div>

      <div className="relative z-10 w-full p-8">
        <h3 className="mb-2 text-balance font-bold font-heading text-4xl text-white">
          {destination.name}
        </h3>
        <div className="mb-4 flex items-center gap-2 text-sm text-white/80">
          <MapPin aria-hidden="true" size={16} />
          <span>{destination.percentage}% Popularity Score</span>
        </div>
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
            expanded
              ? "grid-rows-[1fr]"
              : "grid-rows-[3rem] group-focus-within:grid-rows-[1fr] fine-hover:group-hover:grid-rows-[1fr]"
          }`}
        >
          <p className="min-h-0 max-w-[34ch] overflow-hidden text-pretty text-slate-200 text-sm leading-6">
            {destination.description}
          </p>
        </div>
      </div>

      <button
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `Hide the full ${destination.name} description`
            : `Show the full ${destination.name} description`
        }
        className="fine-hover:pointer-events-none absolute inset-0 z-20 rounded-3xl focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
        onClick={toggleExpanded}
        type="button"
      />
    </article>
  );
}

export default function TrendingDestinations({
  internationalDestinations = defaultInternationalDestinations,
  domesticDestinations = defaultDomesticDestinations,
}) {
  const [activeTab, setActiveTab] = useState("international");
  const selectRegion = (event) => setActiveTab(event.currentTarget.value);
  const destinations =
    activeTab === "international" ? internationalDestinations : domesticDestinations;

  return (
    <div className="relative overflow-hidden py-24">
      <div className="absolute top-0 right-0 -z-10 size-[500px] rounded-full bg-blue-100/50 blur-[120px]" />

      <div className="mx-auto mb-12 flex max-w-7xl flex-col justify-between gap-6 px-4 md:flex-row md:items-end">
        <div>
          <h2 className="mb-4 text-balance font-bold font-heading text-4xl text-brand-dark md:text-5xl">
            Trending Now
          </h2>
          <p className="max-w-md text-pretty text-brand-muted text-lg">
            Discover the most sought-after destinations for meetings, incentives, conferences, and
            exhibitions
          </p>
        </div>

        <fieldset className="m-0 flex min-w-0 rounded-full border-0 bg-slate-100 p-1">
          <legend className="sr-only">Destination region</legend>
          <button
            aria-pressed={activeTab === "international"}
            className={`rounded-full px-6 py-2.5 font-medium text-sm transition-[background-color,color,box-shadow] duration-300 ${
              activeTab === "international"
                ? "bg-white text-brand-dark shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            onClick={selectRegion}
            type="button"
            value="international"
          >
            International
          </button>
          <button
            aria-pressed={activeTab === "domestic"}
            className={`rounded-full px-6 py-2.5 font-medium text-sm transition-[background-color,color,box-shadow] duration-300 ${
              activeTab === "domestic"
                ? "bg-white text-brand-dark shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            onClick={selectRegion}
            type="button"
            value="domestic"
          >
            Domestic
          </button>
        </fieldset>
      </div>

      <section
        aria-label={`${activeTab === "international" ? "International" : "Domestic"} trending destinations`}
        className="scrollbar-hide overflow-x-auto ps-4 pb-8 md:ps-18"
      >
        <div className="flex w-max gap-6 pr-4 md:pr-10">
          {destinations.length > 0 ? (
            destinations.map((destination) => (
              <DestinationCard destination={destination} key={destination.name} />
            ))
          ) : (
            <div className="w-full py-20 text-center text-brand-muted">Coming Soon…</div>
          )}
        </div>
      </section>
    </div>
  );
}
