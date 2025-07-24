"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import CapeTown from "@/static/places/capetown.png";
import Georgia from "@/static/places/georgia.png";
import Japan from "@/static/places/japan.png";
import Portugal from "@/static/places/portugal.png";
import Vietnam from "@/static/places/vietnam.png";

const destinations = [
  {
    rank: 1,
    name: "Vietnam",
    description:
      "Vietnam is rapidly emerging as a top MICE destination, offering a blend of modern convention centers, vibrant cities like Ho Chi Minh and Hanoi, and breathtaking natural backdrops such as Ha Long Bay. Its excellent hospitality, value for money, and unique cultural experiences make it ideal for meetings, incentives, conferences, and exhibitions.",
    image: Vietnam,
    percentage: 100,
  },
  {
    rank: 2,
    name: "Georgia",
    description:
      "Georgia captivates MICE travelers with its mix of European charm and Eurasian hospitality. Tbilisi and Batumi feature state-of-the-art venues, while the country’s scenic mountains and renowned wine regions provide memorable incentive experiences. Visa-friendly policies and a growing infrastructure make Georgia a rising star for corporate events.",
    image: Georgia,
    percentage: 95,
  },
  {
    rank: 3,
    name: "Japan",
    description:
      "Japan seamlessly combines tradition and innovation, making it a premier MICE destination. Tokyo, Osaka, and Kyoto offer world-class facilities, efficient transport, and impeccable service. Delegates can enjoy unique cultural immersions, from tea ceremonies to cherry blossom viewing, ensuring unforgettable business and incentive trips.",
    image: Japan,
    percentage: 90,
  },
  {
    rank: 4,
    name: "Cape Town, South Africa",
    description:
      "Cape Town stands out for its stunning landscapes, iconic Table Mountain, and vibrant waterfront. The city boasts modern convention centers, luxury accommodations, and diverse adventure options for incentives. Its rich history, excellent cuisine, and warm climate make it a favorite for international MICE events.",
    image: CapeTown,
    percentage: 85,
  },
  {
    rank: 5,
    name: "Portugal",
    description:
      "Portugal offers a perfect mix of historic charm and contemporary amenities for MICE groups. Lisbon and Porto feature top-tier venues, while the country’s beautiful coastline and renowned gastronomy enhance incentive programs. Portugal’s accessibility, safety, and welcoming atmosphere make it a sought-after destination for business events.",
    image: Portugal,
    percentage: 80,
  },
];

function DestinationCard({ destination, index }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const collapsedHeight = "48px";
  const isLong = destination.description.length > 200;

  return (
    <motion.div
      className="relative flex flex-col w-full bg-white rounded-2xl shadow-lg group"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ y: -5 }}
    >
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center justify-center w-10 h-10 text-base font-bold text-white rounded-full bg-citius-orange">
          {destination.rank}
        </div>
      </div>
      <div className="relative h-48 overflow-hidden">
        <Image
          src={destination.image}
          alt={destination.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <div className="p-6 flex flex-col h-full">
        <h4 className="mb-3 text-xl font-semibold text-brand-dark">
          {destination.name}
        </h4>
        <div className="relative flex-1">
          <motion.div
            animate={{
              height: isExpanded || !isLong ? "auto" : collapsedHeight,
            }}
            className="overflow-hidden relative"
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="mb-4 text-base text-gray-600 leading-relaxed">
              {destination.description}
            </p>
          </motion.div>
          {isLong && (
            <motion.button
              onClick={() => setIsExpanded((v) => !v)}
              className="mt-1 flex items-center gap-1 text-citius-blue hover:text-citius-orange transition-colors text-sm font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
            >
              <span>{isExpanded ? "Show Less" : "Read More"}</span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </motion.button>
          )}
        </div>
        <div className="space-y-3 mt-4">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Popularity</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              className="h-3 rounded-full bg-gradient-to-r from-citius-orange to-citius-blue"
              initial={{ width: 0 }}
              whileInView={{ width: `${destination.percentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: index * 0.2 + 0.5 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function TrendingDestinations() {
  return (
    <div className="mt-16">
      <motion.h3
        className="mb-8 text-3xl font-semibold text-center text-citius-blue"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        Top 5 Trending MICE Destinations in 2025
      </motion.h3>

      <motion.div
        className="mt-3 pb-6 bg-gray-50 rounded-lg"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <div className="space-y-4 max-w-2xl mx-auto">
          {destinations.map((destination, index) => (
            <motion.div
              key={`bar-${destination.name}`}
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white rounded-full bg-citius-orange flex-shrink-0">
                {destination.rank}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-brand-dark">
                    {destination.name}
                  </span>
                </div>
                <div className="w-full bg-white rounded-full h-3 shadow-inner">
                  <motion.div
                    className="h-3 rounded-full bg-gradient-to-r from-citius-blue to-citius-orange"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${destination.percentage}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: index * 0.15 + 0.5 }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="grid container grid-cols-1 gap-8 px-4 mx-auto md:grid-cols-2 lg:grid-cols-5 justify-items-center pt-8">
        {destinations.map((destination, index) => (
          <DestinationCard
            key={destination.name}
            destination={destination}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
