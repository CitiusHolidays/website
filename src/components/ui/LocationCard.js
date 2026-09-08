"use client";
import { MapPin, Phone } from "lucide-react";
import { m } from "motion/react";

export default function LocationCard({ city, address, phone, dialPhone = phone, mapUrl, index }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-brand-border bg-brand-light p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <h3 className="mb-4 font-bold font-heading text-brand-dark text-xl">{city}</h3>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 flex-shrink-0 text-public-orange-ink" />
          <p className="text-brand-muted text-sm leading-relaxed">{address}</p>
        </div>

        <div className="flex items-center gap-3">
          <Phone className="size-5 flex-shrink-0 text-public-orange-ink" />
          <a
            className="inline-flex min-h-11 items-center text-brand-dark text-sm transition-colors duration-200 hover:text-public-orange-ink"
            href={`tel:${dialPhone}`}
          >
            {phone}
          </a>
        </div>
      </div>

      {mapUrl ? (
        <a
          className="mt-2 inline-flex min-h-11 items-center font-semibold text-public-blue text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-public-blue focus-visible:outline-offset-4"
          href={mapUrl}
          rel="noreferrer"
          target="_blank"
        >
          View {city} on a map
        </a>
      ) : null}
    </m.div>
  );
}
