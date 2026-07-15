"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { TRAILS } from "@/data/sacredBharat/trails";
import { cn } from "@/utils/cn";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function TrailCardGrid() {
  const { progress } = useSacredBharatContext();
  const trailProgressBySlug = Object.fromEntries(progress.trails.map((t) => [t.slug, t]));

  return (
    <section className="border-brand-light border-t bg-white py-16 md:py-24" id="trails">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center md:mb-16">
          <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
            12 spiritual trails
          </span>
          <h2 className="font-heading text-3xl text-brand-dark md:text-4xl">
            Complete a trail, earn your badge
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-brand-muted">
            Each trail grants a completion bonus and a unique badge when every sacred site is marked
            visited. Many temples belong to multiple trails.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRAILS.map((trail, idx) => {
            const tp = trailProgressBySlug[trail.slug];
            const percent = tp?.percent ?? 0;
            const complete = tp?.complete ?? false;
            return (
              <m.div
                initial={{ opacity: 0, y: 12 }}
                key={trail.slug}
                transition={{ delay: idx * 0.03 }}
                viewport={{ once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <Link
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border p-6 transition-[translate,border-color,box-shadow] duration-300",
                    complete
                      ? "border-citius-orange/40 bg-citius-orange/5"
                      : "border-brand-light fine-hover:hover:-translate-y-0.5 hover:border-citius-blue/30 hover:shadow-lg"
                  )}
                  href={`/sacred-bharat/trails/${trail.slug}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span aria-hidden className="text-2xl">
                      {trail.emoji}
                    </span>
                    {complete && <CheckCircle2 className="size-5 shrink-0 text-citius-orange" />}
                  </div>
                  <h3 className="font-heading text-brand-dark text-lg transition-colors group-hover:text-citius-blue">
                    {trail.title}
                  </h3>
                  <p className="mt-2 flex-1 font-sans text-brand-muted text-sm">
                    +{trail.completionBonus} completion bonus · {trail.badgeName}
                  </p>
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-brand-light">
                      <div
                        className="h-full rounded-full bg-citius-blue transition-[width] duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-2 font-sans text-brand-muted text-xs tabular-nums">
                      {tp?.visited ?? 0}/{tp?.total ?? 0} complete · {percent}%
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 font-medium text-citius-blue text-sm">
                    View trail
                    <ArrowRight className="size-4 transition-transform fine-hover:group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
