"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { cn } from "../../utils/cn";

export default function SpiritualTrailsHub({ groups }) {
  return (
    <section className="py-16 md:py-24 bg-white border-t border-brand-light" id="all-trails">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
            Explore trails
          </span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl text-brand-dark mb-4">
            Sacred <span className="text-citius-blue italic">journeys</span>
          </h2>
          <p className="font-sans text-base md:text-lg text-brand-muted max-w-2xl mx-auto leading-relaxed">
            Choose a path below for full itineraries, galleries, departure windows, and booking options.
            Flagship 2026 programmes are open; specialised routes are opening soon.
          </p>
        </motion.div>

        <div className="space-y-14 md:space-y-20">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="flex items-center gap-3 mb-6 md:mb-8">
                <div className="w-10 h-10 rounded-full bg-citius-blue/10 flex items-center justify-center">
                  <Compass className="w-5 h-5 text-citius-blue" />
                </div>
                <h3 className="font-heading text-xl md:text-2xl text-citius-blue">{group.label}</h3>
              </div>
              <div
                className={cn(
                  "grid gap-4 md:gap-6",
                  group.trails.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                {group.trails.map((trail, idx) => (
                  <motion.div
                    key={trail.slug}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Link
                      href={`/pilgrimage/${trail.slug}`}
                      className={cn(
                        "group flex flex-col h-full rounded-2xl border p-6 md:p-7 transition-all duration-300",
                        "border-brand-light bg-linear-to-br from-white to-brand-light/30",
                        "hover:border-citius-orange/35 hover:shadow-lg hover:-translate-y-0.5"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {trail.status === "comingSoon" && (
                          <span className="text-[10px] uppercase tracking-wider font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            Coming soon
                          </span>
                        )}
                        {trail.tagline && (
                          <span className="text-[10px] uppercase tracking-wider text-citius-orange font-medium">
                            {trail.tagline}
                          </span>
                        )}
                      </div>
                      <h4 className="font-heading text-lg md:text-xl text-brand-dark group-hover:text-citius-blue transition-colors mb-2">
                        {trail.title}
                      </h4>
                      <p className="text-sm text-brand-muted leading-relaxed flex-1 line-clamp-3">
                        {trail.subtitle}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-2 text-sm font-heading text-citius-orange tracking-wide">
                        View trail
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
