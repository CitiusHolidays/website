"use client";

import { Calendar, MapPin, Plane } from "lucide-react";
import Link from "next/link";
import { getTempleJourneyPlan } from "@/lib/sacredBharat/journeyPlanner";

/**
 * @param {{ templeId: string, visitedTempleIds: string[] }} props
 */
export default function TempleJourneyCard({ templeId, visitedTempleIds }) {
  const plan = getTempleJourneyPlan(templeId, visitedTempleIds);
  if (!plan || plan.visited) {
    return null;
  }

  const contactHref = `/contact?interest=sacred-bharat&temple=${encodeURIComponent(templeId)}`;

  return (
    <div className="mt-2 rounded-xl border border-citius-blue/20 bg-citius-blue/5 px-4 py-3 text-sm">
      <p className="font-medium text-brand-dark">
        Score available: <span className="tabular-nums text-citius-orange">{plan.pointsAvailable}</span>{" "}
        pts
      </p>
      {plan.mythology ? (
        <p className="mt-2 text-brand-muted leading-relaxed">{plan.mythology}</p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-brand-muted sm:grid-cols-2">
        {plan.nearestAirport ? (
          <div className="flex items-start gap-2">
            <Plane className="mt-0.5 size-4 shrink-0 text-citius-blue" />
            <div>
              <dt className="text-xs uppercase tracking-wide">Nearest airport</dt>
              <dd className="text-brand-dark">{plan.nearestAirport}</dd>
            </div>
          </div>
        ) : null}
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 size-4 shrink-0 text-citius-blue" />
          <div>
            <dt className="text-xs uppercase tracking-wide">Best season</dt>
            <dd className="text-brand-dark">{plan.bestSeason}</dd>
          </div>
        </div>
      </dl>
      {plan.nearbySacredPlaces.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1 font-medium text-brand-dark text-xs">
            <MapPin className="size-3.5" />
            Nearby sacred places
          </p>
          <ul className="flex flex-wrap gap-2">
            {plan.nearbySacredPlaces.map((place) => (
              <li
                className="rounded-full border border-brand-light bg-white px-2.5 py-0.5 text-xs tabular-nums"
                key={place.id}
              >
                {place.name}
                {place.visited ? " ✓" : ` · ${place.points} pts`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-citius-blue px-4 py-2 font-medium text-white text-xs hover:bg-citius-blue/90"
        href={contactHref}
      >
        Plan my pilgrimage
      </Link>
    </div>
  );
}
