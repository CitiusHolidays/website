"use client";
import { motion } from "motion/react";
import { MapPin, Phone } from "lucide-react";

export default function LocationCard({ city, address, phone, mapUrl, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white rounded-lg border border-brand-border p-6 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <h3 className="text-xl font-bold text-brand-dark mb-4">{city}</h3>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-citius-orange mt-0.5 flex-shrink-0" />
          <p className="text-brand-muted text-sm leading-relaxed">{address}</p>
        </div>

        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-citius-orange flex-shrink-0" />
          <a
            href={`tel:${phone}`}
            className="text-brand-dark text-sm hover:text-citius-orange transition-colors duration-200"
          >
            {phone}
          </a>
        </div>
      </div>

      {mapUrl && (
        <div className="mt-4">
          <iframe
            title={`${city} office location`}
            src={mapUrl}
            width="100%"
            height="150"
            loading="lazy"
            className="rounded-md border border-brand-border"
            style={{ border: 0 }}
            allowFullScreen=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </motion.div>
  );
}
