"use client";
import { MapPin, Phone } from "lucide-react";
import { m } from "motion/react";

export default function LocationCard({ city, address, phone, mapUrl, index }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-brand-border bg-brand-light p-6 shadow-sm transition-all duration-200 hover:shadow-md"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <h3 className="mb-4 font-bold text-brand-dark text-xl">{city}</h3>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 flex-shrink-0 text-citius-orange" />
          <p className="text-brand-muted text-sm leading-relaxed">{address}</p>
        </div>

        <div className="flex items-center gap-3">
          <Phone className="size-5 flex-shrink-0 text-citius-orange" />
          <a
            className="text-brand-dark text-sm transition-colors duration-200 hover:text-citius-orange"
            href={`tel:${phone}`}
          >
            {phone}
          </a>
        </div>
      </div>

      {mapUrl && (
        <div className="mt-4">
          <iframe
            allowFullScreen=""
            className="rounded-md border border-brand-border"
            height="150"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-popups allow-presentation"
            src={mapUrl}
            style={{ border: 0 }}
            title={`${city} office location`}
            width="100%"
          />
        </div>
      )}
    </m.div>
  );
}
