"use client";

import { MapPin, Mountain, Sparkles } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import { sacredSites } from "../../data/trails";
import { cn } from "../../utils/cn";

function SacredSiteCard({ site, index }) {
  const isEven = index % 2 === 0;
  const img = site.image;

  return (
    <m.div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-brand-light/50 bg-white shadow-brand-dark/5 shadow-xl md:rounded-3xl",
        "transition-all duration-500 hover:shadow-2xl hover:shadow-brand-dark/10"
      )}
      initial={{ opacity: 0, y: 40 }}
      transition={{ delay: index * 0.1, duration: 0.7, ease: "easeOut" }}
      viewport={{ margin: "-100px", once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className={cn("grid gap-0 md:grid-cols-2", !isEven && "md:direction-rtl")}>
        {/* Image Section */}
        <div className="relative h-64 overflow-hidden bg-brand-light md:h-80 lg:h-96">
          {img?.src ? (
            <Image
              alt={img.alt || site.name}
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              src={img.src}
            />
          ) : (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-gradient-to-br",
                index % 3 === 0 && "from-citius-blue/20 via-citius-orange/10 to-citius-blue/30",
                index % 3 === 1 && "from-citius-orange/20 via-amber-100/30 to-citius-orange/20",
                index % 3 === 2 && "from-emerald-100/40 via-citius-blue/10 to-teal-100/30"
              )}
            >
              <div className="p-6 text-center">
                <Mountain className="mx-auto mb-3 size-12 text-citius-blue/30 md:h-16 md:w-16" />
                <p className="font-heading text-citius-blue/50 text-sm">{site.name}</p>
              </div>
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/60 via-transparent to-transparent" />

          {/* Location Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <MapPin className="size-3.5 text-citius-orange" />
            <span className="font-medium text-brand-dark text-xs">{site.location}</span>
          </div>

          {/* Elevation Badge */}
          <div className="absolute right-4 bottom-4 rounded-lg bg-brand-dark/80 px-3 py-2 backdrop-blur-sm">
            <span className="font-medium text-white/90 text-xs">{site.elevation}</span>
          </div>

          {/* Hover Reveal */}
          <m.div
            className="absolute inset-0 flex items-center justify-center bg-citius-blue/10 opacity-0 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-100"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
          >
            <div className="text-center">
              <Sparkles className="mx-auto mb-2 size-8 text-citius-orange" />
              <p className="font-heading text-sm text-white">Sacred Site</p>
            </div>
          </m.div>
        </div>

        {/* Content Section */}
        <div
          className={cn(
            "flex flex-col justify-center p-6 md:p-8 lg:p-10",
            !isEven && "md:order-first"
          )}
        >
          <div className="mb-4">
            <span className="mb-3 inline-block rounded-full bg-citius-orange/10 px-3 py-1 font-medium text-citius-orange text-xs">
              {site.significance}
            </span>
            <h3 className="mb-2 font-heading text-citius-blue text-xl md:text-2xl lg:text-3xl">
              {site.name}
            </h3>
            <p className="flex items-center gap-1.5 text-brand-muted text-sm">
              <MapPin className="size-3.5" />
              {site.location} • {site.elevation}
            </p>
          </div>

          <p className="font-sans text-base text-brand-dark/80 leading-relaxed md:text-lg">
            {site.description}
          </p>

          {/* Decorative Line */}
          <div className="mt-6 flex items-center gap-3 md:mt-8">
            <div className="h-px flex-grow bg-gradient-to-r from-citius-orange/30 to-transparent" />
            <Sparkles className="size-4 text-citius-orange/50" />
            <div className="h-px flex-grow bg-gradient-to-l from-citius-orange/30 to-transparent" />
          </div>
        </div>
      </div>
    </m.div>
  );
}

export default function SacredSitesVisual({ className }) {
  return (
    <section className={cn("bg-white py-16 md:py-32", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <m.div
          className="mb-12 text-center md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
            Sacred Geography
          </span>
          <h2 className="mb-4 font-heading text-3xl text-brand-dark leading-tight md:mb-6 md:text-5xl">
            The Path of <span className="text-citius-blue italic">Transformation</span>
          </h2>
          <p className="mx-auto max-w-2xl font-sans text-base text-brand-muted leading-relaxed md:text-xl">
            Each sacred site along the yatra holds profound spiritual significance. Understanding
            their meaning deepens the journey.
          </p>
          <div className="mx-auto mt-6 h-px w-16 bg-citius-orange/30 md:mt-8 md:w-24" />
        </m.div>

        {/* Sacred Sites Grid */}
        <div className="space-y-6 md:space-y-8">
          {sacredSites.map((site, index) => (
            <SacredSiteCard index={index} key={site.id} site={site} />
          ))}
        </div>

        {/* Bottom Note */}
        <m.div
          className="mt-12 text-center md:mt-16"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.3 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="inline-block rounded-2xl bg-brand-dark/5 px-6 py-4 md:px-8 md:py-5">
            <p className="font-sans text-brand-muted text-sm italic md:text-base">
              &ldquo;The mountain does not call those who are ready. It calls those who are willing
              to be transformed.&rdquo;
            </p>
          </div>
        </m.div>
      </div>
    </section>
  );
}
