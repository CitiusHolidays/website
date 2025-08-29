"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { ChevronDown, MapPin, Star } from "lucide-react";

import CapeTown from "@/static/places/capetown.png";
import Georgia from "@/static/places/georgia.png";
import Japan from "@/static/places/japan.png";
import Portugal from "@/static/places/portugal.png";
import Vietnam from "@/static/places/vietnam.png";

function DestinationCard({ destination, index }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const collapsedHeight = "60px";
  const isLong = destination.description.length > 150;

  return (
    <motion.div
      className="group relative flex flex-col bg-brand-light rounded-xl shadow-sm border border-brand-border overflow-hidden hover:shadow-lg transition-all duration-300"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
    >
      <div className="relative h-56 overflow-hidden">
        <Image
          src={destination.image || "/placeholder.svg"}
          alt={destination.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center justify-center w-10 h-10 text-sm font-bold text-white rounded-full bg-citius-blue shadow-lg">
            {destination.rank}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-10">
          <h3 className="text-xl font-bold text-white text-balance">
            {destination.name}
          </h3>
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4 text-white/80" />
            <span className="text-sm text-white/80">MICE Destination</span>
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-citius-orange fill-current" />
            <span className="text-sm font-medium text-brand-muted">
              #{destination.rank} Trending
            </span>
          </div>
        </div>

        <div className="flex-1">
          <motion.div
            animate={{
              height: isExpanded || !isLong ? "auto" : collapsedHeight,
            }}
            className="overflow-hidden relative"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <p className="text-sm text-brand-muted leading-relaxed">
              {destination.description}
            </p>
          </motion.div>

          {isLong && (
            <motion.button
              onClick={() => setIsExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1 text-citius-blue hover:text-citius-blue/80 transition-colors text-sm font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
            >
              <span>{isExpanded ? "Show Less" : "Read More"}</span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-brand-muted uppercase tracking-wide">
              Popularity Score
            </span>
            <span className="text-sm font-bold text-brand-dark">
              {destination.percentage}%
            </span>
          </div>
          <div className="w-full bg-brand-light rounded-full h-2">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-citius-blue to-citius-orange"
              initial={{ width: 0 }}
              whileInView={{ width: `${destination.percentage}%` }}
              viewport={{ once: true }}
              transition={{
                duration: 1.2,
                delay: index * 0.2 + 0.5,
                ease: "easeOut",
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function TrendingDestinations({
  internationalDestinations = [],
  domesticDestinations = []
}) {
  const hasInternational = internationalDestinations.length > 0;
  const hasDomestic = domesticDestinations.length > 0;

  return (
    <div className="py-16 px-4 bg-brand-light">
      <div className="max-w-7xl mx-auto">
        {hasInternational && (
          <>
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-brand-dark text-balance mb-4">
                Top Trending International MICE Destinations
              </h2>
              <p className="text-brand-muted text-lg max-w-2xl mx-auto text-pretty">
                Discover the most sought-after international destinations for meetings,
                incentives, conferences, and exhibitions
              </p>
            </motion.div>

            <motion.div
              className="mb-12 p-6 bg-brand-light rounded-xl border border-brand-border"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-brand-dark mb-6 text-center">
                International Popularity Rankings
              </h3>
              <div className="space-y-4 max-w-3xl mx-auto">
                {internationalDestinations.map((destination, index) => (
                  <motion.div
                    key={`int-bar-${destination.name}`}
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-brand-light rounded-full bg-citius-blue flex-shrink-0">
                      {destination.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-brand-dark truncate">
                          {destination.name}
                        </span>
                        <span className="text-xs text-brand-muted ml-2">
                          {destination.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-brand-light rounded-full h-2">
                        <motion.div
                          className="h-2 rounded-full bg-gradient-to-r from-citius-blue to-citius-orange"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${destination.percentage}%` }}
                          viewport={{ once: true }}
                          transition={{
                            duration: 1,
                            delay: index * 0.15 + 0.3,
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-16">
              {internationalDestinations.map((destination, index) => (
                <DestinationCard
                  key={destination.name}
                  destination={destination}
                  index={index}
                />
              ))}
            </div>
          </>
        )}

        {hasDomestic && (
          <>
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-brand-dark text-balance mb-4">
                Top Trending Domestic MICE Destinations
              </h2>
              <p className="text-brand-muted text-lg max-w-2xl mx-auto text-pretty">
                Discover the most sought-after domestic destinations for meetings,
                incentives, conferences, and exhibitions
              </p>
            </motion.div>

            <motion.div
              className="mb-12 p-6 bg-brand-light rounded-xl border border-brand-border"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-brand-dark mb-6 text-center">
                Domestic Popularity Rankings
              </h3>
              <div className="space-y-4 max-w-3xl mx-auto">
                {domesticDestinations.map((destination, index) => (
                  <motion.div
                    key={`dom-bar-${destination.name}`}
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-brand-light rounded-full bg-citius-blue flex-shrink-0">
                      {destination.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-brand-dark truncate">
                          {destination.name}
                        </span>
                        <span className="text-xs text-brand-muted ml-2">
                          {destination.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-brand-light rounded-full h-2">
                        <motion.div
                          className="h-2 rounded-full bg-gradient-to-r from-citius-blue to-citius-orange"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${destination.percentage}%` }}
                          viewport={{ once: true }}
                          transition={{
                            duration: 1,
                            delay: index * 0.15 + 0.3,
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {domesticDestinations.map((destination, index) => (
                <DestinationCard
                  key={destination.name}
                  destination={destination}
                  index={index}
                />
              ))}
            </div>
          </>
        )}

        {!hasInternational && !hasDomestic && (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-brand-dark mb-4">
              Trending Destinations Coming Soon
            </h2>
            <p className="text-brand-muted">
              We&apos;re working on bringing you the latest trending destinations.
            </p>
          </motion.div>
        )}

      </div>
    </div>
  );
}
