"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SpiritualTrailsHub({ groups }) {
  const forthcomingTrails = groups.flatMap((group) =>
    group.trails.filter((trail) => trail.status === "comingSoon")
  );

  return (
    <section
      aria-labelledby="forthcoming-trails-title"
      className="scroll-mt-24 border-brand-light border-t bg-public-surface py-10 md:py-16"
      id="all-trails"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2
          className="font-heading text-2xl text-public-ink md:text-3xl"
          id="forthcoming-trails-title"
        >
          Forthcoming programmes
        </h2>
        <p className="mt-3 max-w-2xl text-public-muted leading-relaxed">
          These six programmes are under review and are not open for booking. View the known details
          or register your interest.
        </p>
        <ul className="mt-6 grid gap-x-8 sm:grid-cols-2">
          {forthcomingTrails.map((trail) => (
            <li className="border-brand-light border-b" key={trail.slug}>
              <Link
                className="flex min-h-14 items-center justify-between gap-4 py-3 font-medium text-public-blue transition-colors hover:text-public-orange-ink focus-visible:outline-2 focus-visible:outline-public-blue focus-visible:outline-offset-2"
                href={`/pilgrimage/${trail.slug}`}
              >
                {trail.title}
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
