"use client";

import { motion } from "motion/react";
import { Mountain, MapPin, Sparkles } from "lucide-react";
import { sacredSites } from "../../data/trails";
import { cn } from "../../utils/cn";

function SacredSiteCard({ site, index }) {
  const isEven = index % 2 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-xl shadow-brand-dark/5 border border-brand-light/50",
        "hover:shadow-2xl hover:shadow-brand-dark/10 transition-all duration-500"
      )}
    >
      <div className={cn(
        "grid md:grid-cols-2 gap-0",
        !isEven && "md:direction-rtl"
      )}>
        {/* Image Section */}
        <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden">
          {/* Placeholder Gradient */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br flex items-center justify-center",
            index % 3 === 0 && "from-citius-blue/20 via-citius-orange/10 to-citius-blue/30",
            index % 3 === 1 && "from-citius-orange/20 via-amber-100/30 to-citius-orange/20",
            index % 3 === 2 && "from-emerald-100/40 via-citius-blue/10 to-teal-100/30"
          )}>
            <div className="text-center p-6">
              <Mountain className="w-12 h-12 md:w-16 md:h-16 text-citius-blue/30 mx-auto mb-3" />
              <p className="font-heading text-citius-blue/50 text-sm">{site.name}</p>
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/60 via-transparent to-transparent" />

          {/* Location Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
            <MapPin className="w-3.5 h-3.5 text-citius-orange" />
            <span className="text-xs font-medium text-brand-dark">{site.location}</span>
          </div>

          {/* Elevation Badge */}
          <div className="absolute bottom-4 right-4 bg-brand-dark/80 backdrop-blur-sm px-3 py-2 rounded-lg">
            <span className="text-xs text-white/90 font-medium">{site.elevation}</span>
          </div>

          {/* Hover Reveal */}
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute inset-0 bg-citius-blue/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          >
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-citius-orange mx-auto mb-2" />
              <p className="text-white font-heading text-sm">Sacred Site</p>
            </div>
          </motion.div>
        </div>

        {/* Content Section */}
        <div className={cn(
          "p-6 md:p-8 lg:p-10 flex flex-col justify-center",
          !isEven && "md:order-first"
        )}>
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-citius-orange/10 text-citius-orange text-xs font-medium rounded-full mb-3">
              {site.significance}
            </span>
            <h3 className="font-heading text-xl md:text-2xl lg:text-3xl text-citius-blue mb-2">
              {site.name}
            </h3>
            <p className="text-sm text-brand-muted flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {site.location} • {site.elevation}
            </p>
          </div>

          <p className="font-sans text-base md:text-lg text-brand-dark/80 leading-relaxed">
            {site.description}
          </p>

          {/* Decorative Line */}
          <div className="mt-6 md:mt-8 flex items-center gap-3">
            <div className="h-px flex-grow bg-gradient-to-r from-citius-orange/30 to-transparent" />
            <Sparkles className="w-4 h-4 text-citius-orange/50" />
            <div className="h-px flex-grow bg-gradient-to-l from-citius-orange/30 to-transparent" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SacredSitesVisual({ className }) {
  return (
    <section className={cn("py-16 md:py-32 bg-white", className)}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-20"
        >
          <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
            Sacred Geography
          </span>
          <h2 className="font-heading text-3xl md:text-5xl text-brand-dark mb-4 md:mb-6 leading-tight">
            The Path of <span className="text-citius-blue italic">Transformation</span>
          </h2>
          <p className="font-sans text-base md:text-xl text-brand-muted max-w-2xl mx-auto leading-relaxed">
            Each sacred site along the yatra holds profound spiritual significance. Understanding their meaning deepens the journey.
          </p>
          <div className="w-16 md:w-24 h-px bg-citius-orange/30 mx-auto mt-6 md:mt-8" />
        </motion.div>

        {/* Sacred Sites Grid */}
        <div className="space-y-6 md:space-y-8">
          {sacredSites.map((site, index) => (
            <SacredSiteCard key={site.id} site={site} index={index} />
          ))}
        </div>

        {/* Bottom Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 md:mt-16 text-center"
        >
          <div className="inline-block bg-brand-dark/5 rounded-2xl px-6 py-4 md:px-8 md:py-5">
            <p className="font-sans text-sm md:text-base text-brand-muted italic">
              &ldquo;The mountain does not call those who are ready. It calls those who are willing to be transformed.&rdquo;
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
