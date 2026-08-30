"use client";

import { MapPin } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import {
  domesticDestinations as defaultDomesticDestinations,
  internationalDestinations as defaultInternationalDestinations,
} from "@/data/trendingDestinations";
import DestinationShortlistPlanner, {
  useDestinationShortlist,
} from "./DestinationShortlistPlanner";

const COPY_REST_HEIGHT = "3rem";

function DestinationCard({ destination, onSave, saved }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const copyRef = useRef(null);
  const open = expanded || hovered;

  useLayoutEffect(() => {
    const node = copyRef.current;
    if (!node) {
      return;
    }
    const measure = () => setFullHeight(node.scrollHeight);
    measure();
    const ResizeObserverClass = globalThis.ResizeObserver;
    if (!ResizeObserverClass) {
      return;
    }
    const observer = new ResizeObserverClass(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const toggleExpanded = () => {
    setExpanded((current) => !current);
  };
  const handlePointerEnter = (event) => {
    if (event.pointerType === "mouse") {
      setHovered(true);
    }
  };
  const handlePointerLeave = () => setHovered(false);

  return (
    <article
      className="group relative flex min-h-[500px] w-[85vw] flex-shrink-0 items-end overflow-hidden rounded-3xl md:w-[400px]"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <Image
        alt=""
        className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:group-hover:scale-105 motion-reduce:transition-none"
        fill
        sizes="(max-width: 768px) 85vw, 1000px"
        src={destination.image || "/gallery/aboutus.webp"}
      />
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? "opacity-100" : "opacity-90"
        }`}
      />

      <div className="material-decorative-glass absolute top-6 left-6 rounded-full border border-white/20 bg-white/20 px-3 py-1 font-bold text-white text-xs uppercase tracking-wider backdrop-blur-md [--material-preference-background:var(--color-public-night)] [--material-preference-boundary:var(--color-public-surface)]">
        #{destination.rank} Trending
      </div>

      <button
        aria-label={`Save ${destination.name} to your shortlist`}
        aria-pressed={saved}
        className={`absolute top-4 right-4 z-30 inline-flex min-h-11 items-center rounded-full border px-4 font-semibold text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 ${
          saved
            ? "border-citius-blue bg-citius-blue text-white"
            : "border-white/70 bg-white/95 text-brand-dark"
        }`}
        onClick={() => onSave(destination, saved)}
        type="button"
      >
        {saved ? "Saved" : "Save"}
      </button>

      <div className="relative z-10 w-full p-8">
        <h3 className="mb-2 text-balance font-bold font-heading text-4xl text-white leading-[1.4]">
          {destination.name}
        </h3>
        <div className="mb-4 flex items-center gap-2 text-sm text-white/80">
          <MapPin aria-hidden="true" size={16} />
          <span>{destination.percentage}% Popularity Score</span>
        </div>
        <div
          className="overflow-hidden transition-[height] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          data-copy-open={open ? "true" : "false"}
          style={{
            height: open && fullHeight > 0 ? `${fullHeight}px` : COPY_REST_HEIGHT,
          }}
        >
          <p className="max-w-[34ch] text-pretty text-slate-200 text-sm leading-6" ref={copyRef}>
            {destination.description}
          </p>
        </div>
      </div>

      <button
        aria-expanded={open}
        aria-label={
          open
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
  const shortlist = useDestinationShortlist();
  const selectRegion = (event) => setActiveTab(event.currentTarget.value);
  const destinations =
    activeTab === "international" ? internationalDestinations : domesticDestinations;
  const allDestinations = [...internationalDestinations, ...domesticDestinations];
  const savedIds = new Set(shortlist.plan.shortlist.map(({ id }) => id));

  return (
    <div className="relative overflow-hidden py-24">
      <div className="absolute top-0 right-0 -z-10 size-[500px] rounded-full bg-blue-100/50 blur-[120px]" />

      <div className="mx-auto mb-12 flex max-w-7xl flex-col justify-between gap-6 px-4 md:flex-row md:items-end">
        <div>
          <h2 className="mb-4 text-balance font-bold font-heading text-4xl text-brand-dark md:text-5xl">
            Trending Now
          </h2>
          <p className="max-w-md text-pretty text-brand-muted text-lg">
            Top destinations for meetings, incentives, conferences, and exhibitions
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

      <m.section
        animate={{ opacity: 1 }}
        aria-label={`${activeTab === "international" ? "International" : "Domestic"} trending destinations`}
        className="scrollbar-hide overflow-x-auto ps-4 pb-8 md:ps-18"
        initial={{ opacity: 0.7 }}
        key={activeTab}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex w-max gap-6 pr-4 md:pr-10">
          {destinations.length > 0 ? (
            destinations.map((destination) => (
              <DestinationCard
                destination={destination}
                key={destination.id}
                onSave={(selectedDestination, isSaved) =>
                  isSaved
                    ? shortlist.remove(selectedDestination.id)
                    : shortlist.add(selectedDestination)
                }
                saved={savedIds.has(destination.id)}
              />
            ))
          ) : (
            <div className="w-full py-20 text-center text-brand-muted">Coming Soon…</div>
          )}
        </div>
      </m.section>
      <DestinationShortlistPlanner destinations={allDestinations} shortlist={shortlist} />
    </div>
  );
}
