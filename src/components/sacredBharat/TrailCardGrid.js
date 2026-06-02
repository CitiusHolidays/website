"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { m as motion } from "motion/react";
import Link from "next/link";
import { TRAILS } from "@/data/sacredBharat/trails";
import { cn } from "@/utils/cn";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function TrailCardGrid() {
  const { progress } = useSacredBharatContext();
  const trailProgressBySlug = Object.fromEntries(progress.trails.map((t) => [t.slug, t]));

  return (
    <section id="trails" className="py-16 md:py-24 bg-white border-t border-brand-light">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-16">
          <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
            12 spiritual trails
          </span>
          <h2 className="font-heading text-3xl md:text-4xl text-brand-dark">
            Complete a trail, earn your badge
          </h2>
          <p className="font-sans text-brand-muted mt-4 max-w-2xl mx-auto">
            Each trail grants bonus points and a unique badge when every sacred site is marked
            visited. Many temples belong to multiple trails.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRAILS.map((trail, idx) => {
            const tp = trailProgressBySlug[trail.slug];
            const percent = tp?.percent ?? 0;
            const complete = tp?.complete ?? false;
            return (
              <motion.div
                key={trail.slug}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.03 }}
              >
                <Link
                  href={`/sacred-bharat/trails/${trail.slug}`}
                  className={cn(
                    "group flex flex-col h-full rounded-2xl border p-6 transition-all duration-300",
                    complete
                      ? "border-citius-orange/40 bg-citius-orange/5"
                      : "border-brand-light hover:border-citius-blue/30 hover:shadow-lg hover:-translate-y-0.5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-2xl" aria-hidden>
                      {trail.emoji}
                    </span>
                    {complete && <CheckCircle2 className="size-5 text-citius-orange shrink-0" />}
                  </div>
                  <h3 className="font-heading text-lg text-brand-dark group-hover:text-citius-blue transition-colors">
                    {trail.title}
                  </h3>
                  <p className="font-sans text-sm text-brand-muted mt-2 flex-1">
                    +{trail.completionBonus} completion bonus · {trail.badgeName}
                  </p>
                  <div className="mt-4">
                    <div className="h-1.5 rounded-full bg-brand-light overflow-hidden">
                      <div
                        className="h-full rounded-full bg-citius-blue transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="font-sans text-xs text-brand-muted mt-2 tabular-nums">
                      {tp?.visited ?? 0}/{tp?.total ?? 0} complete · {percent}%
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-citius-blue">
                    View trail
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
