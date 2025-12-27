"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronDown, MapPin, ArrowRight } from "lucide-react";

function DestinationCard({ destination, index }) {
  return (
    <motion.div
      className="group relative flex-shrink-0 w-[85vw] md:w-[400px] h-[500px] rounded-3xl overflow-hidden cursor-pointer"
      initial={{ opacity: 0, x: 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Image
        src={destination.image || "/placeholder.svg"}
        alt={destination.name}
        fill
        sizes="(max-width: 768px) 85vw, 400px"
        className="object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

      {/* Rank Badge */}
      <div className="absolute top-6 left-6 backdrop-blur-md bg-white/20 border border-white/20 px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider">
        #{destination.rank} Trending
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-8 transform transition-transform duration-500 translate-y-4 group-hover:translate-y-0">
        <h3 className="text-4xl font-heading font-bold text-white mb-2">
          {destination.name}
        </h3>
        <div className="flex items-center gap-2 mb-4 text-white/80 text-sm">
           <MapPin size={16} />
           <span>{destination.percentage}% Popularity Score</span>
        </div>
        
        <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500">
          <div className="overflow-hidden">
            <p className="text-slate-300 text-sm mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                {destination.description}
            </p>
          </div>
        </div>

        {/* <div className="flex items-center gap-2 text-white font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200">
            Explore <ArrowRight size={16} />
        </div> */}
      </div>
    </motion.div>
  );
}

export default function TrendingDestinations({
  internationalDestinations = [],
  domesticDestinations = []
}) {
  const [activeTab, setActiveTab] = useState("international");
  const destinations = activeTab === "international" ? internationalDestinations : domesticDestinations;

  return (
    <div className="py-24 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[120px] -z-10"></div>

      <div className="max-w-7xl mx-auto px-4 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
         <div>
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-heading font-bold text-brand-dark mb-4"
            >
                Trending Now
            </motion.h2>
            <p className="text-lg text-brand-muted max-w-md">
              Discover the most sought-after destinations for meetings, incentives, conferences, and exhibitions
            </p>
         </div>

         <div className="flex p-1 bg-slate-100 rounded-full">
            <button
                onClick={() => setActiveTab("international")}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                    activeTab === "international" 
                    ? "bg-white text-brand-dark shadow-sm" 
                    : "text-brand-muted hover:text-brand-dark"
                }`}
            >
                International
            </button>
            <button
                onClick={() => setActiveTab("domestic")}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                    activeTab === "domestic" 
                    ? "bg-white text-brand-dark shadow-sm" 
                    : "text-brand-muted hover:text-brand-dark"
                }`}
            >
                Domestic
            </button>
         </div>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="overflow-x-auto pb-8 scrollbar-hide pl-4 md:pl-18">
         <div className="flex gap-6 w-max pr-4 md:pr-10">
            {destinations.length > 0 ? (
                destinations.map((destination, index) => (
                    <DestinationCard
                        key={destination.name}
                        destination={destination}
                        index={index}
                    />
                ))
            ) : (
                <div className="w-full py-20 text-center text-brand-muted">
                    Coming Soon...
                </div>
            )}
         </div>
      </div>
    </div>
  );
}
