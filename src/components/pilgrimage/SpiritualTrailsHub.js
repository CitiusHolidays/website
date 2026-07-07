"use client";

import { ArrowRight, Compass } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { cn } from "../../utils/cn";

export default function SpiritualTrailsHub({ groups }) {
  return (
    <section className="border-brand-light border-t bg-white py-16 md:py-24" id="all-trails">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <m.div
          className="mb-12 text-center md:mb-16"
          initial={{ opacity: 0, y: 16 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
            Explore trails
          </span>
          <h2 className="mb-4 font-heading text-3xl text-brand-dark md:text-4xl lg:text-5xl">
            Sacred <span className="text-citius-blue italic">journeys</span>
          </h2>
          <p className="mx-auto max-w-2xl font-sans text-base text-brand-muted leading-relaxed md:text-lg">
            Choose a path below for full itineraries, galleries, departure windows, and booking
            options. Flagship 2026 programmes are open; specialised routes are opening soon.
          </p>
        </m.div>

        <div className="space-y-14 md:space-y-20">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="mb-6 flex items-center gap-3 md:mb-8">
                <div className="flex size-10 items-center justify-center rounded-full bg-citius-blue/10">
                  <Compass className="size-5 text-citius-blue" />
                </div>
                <h3 className="font-heading text-citius-blue text-xl md:text-2xl">{group.label}</h3>
              </div>
              <div
                className={cn(
                  "grid gap-4 md:gap-6",
                  group.trails.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
                )}
              >
                {group.trails.map((trail, idx) => (
                  <m.div
                    initial={{ opacity: 0, y: 12 }}
                    key={trail.slug}
                    transition={{ delay: idx * 0.05 }}
                    viewport={{ once: true }}
                    whileInView={{ opacity: 1, y: 0 }}
                  >
                    <Link
                      className={cn(
                        "group flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 md:p-7",
                        "border-brand-light bg-linear-to-br from-white to-brand-light/30",
                        "hover:-translate-y-0.5 hover:border-citius-orange/35 hover:shadow-lg"
                      )}
                      href={`/pilgrimage/${trail.slug}`}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {trail.status === "comingSoon" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-[10px] text-amber-800 uppercase tracking-wider">
                            Coming soon
                          </span>
                        )}
                        {trail.tagline && (
                          <span className="font-medium text-[10px] text-citius-orange uppercase tracking-wider">
                            {trail.tagline}
                          </span>
                        )}
                      </div>
                      <h4 className="mb-2 font-heading text-brand-dark text-lg transition-colors group-hover:text-citius-blue md:text-xl">
                        {trail.title}
                      </h4>
                      <p className="line-clamp-3 flex-1 text-brand-muted text-sm leading-relaxed">
                        {trail.subtitle}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-2 font-heading text-citius-orange text-sm tracking-wide">
                        View trail
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </m.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
