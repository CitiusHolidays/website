"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Map, Heart, Shield, Users, CheckCircle, 
  AlertCircle, Mountain, Coffee, FileText, 
  MapPin, Star, Sparkles, Clock, Calendar,
  ArrowRight, IndianRupee, Info
} from "lucide-react";
import Link from "next/link";
import { cn } from "../../utils/cn";

const TabButton = ({ active, onClick, label, icon: Icon }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 text-xs md:text-sm font-heading tracking-wider transition-all rounded-full border uppercase whitespace-nowrap",
      active 
        ? "bg-citius-blue text-white border-citius-blue shadow-lg scale-105" 
        : "bg-white text-brand-muted border-gray-200 hover:border-citius-blue/30 hover:text-citius-blue"
    )}
  >
    {Icon && <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />}
    {label}
  </button>
);

function HighlightsTab({ highlights }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <h3 className="font-heading text-xl md:text-2xl text-citius-blue text-center mb-8">
        Sacred Sites Along the Journey
      </h3>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {highlights.map((site, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="group bg-linear-to-br from-white to-brand-light/50 rounded-2xl p-5 md:p-6 border border-brand-light hover:border-citius-orange/30 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-citius-orange/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-citius-orange" />
              </div>
              <div>
                <span className="text-[10px] md:text-xs text-citius-orange font-medium uppercase tracking-wider">
                  {site.significance}
                </span>
                <h4 className="font-heading text-base md:text-lg text-citius-blue leading-tight">
                  {site.title}
                </h4>
              </div>
            </div>
            <p className="text-xs md:text-sm text-brand-muted mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {site.location}
            </p>
            <p className="text-sm text-brand-dark/80 leading-relaxed">
              {site.description}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ItineraryTab({ itinerary, hasAltitude }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-heading text-xl md:text-2xl text-citius-blue">
          {itinerary.length}-Day Journey
        </h3>
        <span className="text-xs md:text-sm text-brand-muted bg-brand-light px-3 py-1.5 rounded-full">
          Scroll to explore each day
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-linear-to-b from-citius-orange via-citius-blue to-citius-orange/30" />

        {/* Day Cards */}
        <div className="space-y-4 md:space-y-6">
          {itinerary.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative pl-12 md:pl-16"
            >
              {/* Timeline Dot */}
              <div className="absolute left-2 md:left-4 top-4 w-4 h-4 md:w-5 md:h-5 rounded-full bg-white border-2 border-citius-orange shadow-md flex items-center justify-center z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-citius-orange" />
              </div>

              {/* Day Card */}
              <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-brand-light hover:shadow-md hover:border-citius-orange/20 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <span className="font-heading text-xs font-bold text-citius-orange tracking-widest uppercase bg-citius-orange/10 px-2.5 py-1 rounded-full">
                    {item.day}
                  </span>
                  {item.altitude && (
                    <span className="text-xs text-brand-muted flex items-center gap-1 bg-brand-light px-2 py-1 rounded-full">
                      <Mountain className="w-3 h-3" />
                      {item.altitude}
                    </span>
                  )}
                  {item.trek && (
                    <span className="text-xs text-citius-blue flex items-center gap-1 bg-citius-blue/10 px-2 py-1 rounded-full">
                      <MapPin className="w-3 h-3" />
                      {item.trek}
                    </span>
                  )}
                  {item.flight && (
                    <span className="text-xs text-citius-orange flex items-center gap-1 bg-citius-orange/10 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {item.flight}
                    </span>
                  )}
                </div>

                <h4 className="font-heading text-base md:text-lg text-citius-blue mb-2 leading-tight">
                  {item.title}
                </h4>
                <p className="font-sans text-sm text-brand-muted leading-relaxed mb-3">
                  {item.desc}
                </p>

                {/* Highlights Tags */}
                {item.highlights && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.highlights.map((highlight, hidx) => (
                      <span
                        key={hidx}
                        className="text-[10px] md:text-xs text-citius-blue/80 bg-citius-blue/5 px-2 py-1 rounded-full"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}

                {/* Accommodation & Meals */}
                {(item.accommodation || item.meals) && (
                  <div className="flex flex-wrap gap-3 text-xs text-brand-muted pt-3 border-t border-brand-light">
                    {item.accommodation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {item.accommodation}
                      </span>
                    )}
                    {item.meals && (
                      <span className="flex items-center gap-1">
                        <Coffee className="w-3 h-3" />
                        {item.meals}
                      </span>
                    )}
                    {item.transport && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {item.transport}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function PricingTab({ trail }) {
  const isAerial = trail.id === "kailash-aerial-3day";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Price Display */}
      <div className="text-center mb-8">
        {isAerial ? (
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {trail.pricing.tiers.map((tier) => (
              <div
                key={tier.name}
                className="bg-white rounded-2xl p-6 border-2 border-brand-light hover:border-citius-orange/50 transition-all"
              >
                <span className="text-xs uppercase tracking-wider text-brand-muted mb-2 block">
                  {tier.name} Package
                </span>
                <div className="flex items-baseline justify-center gap-1">
                  <IndianRupee className="w-5 h-5 text-citius-blue" />
                  <span className="font-heading text-3xl text-citius-blue font-bold">
                    {tier.price.replace("INR ", "")}
                  </span>
                </div>
                <p className="text-xs text-brand-muted mt-2">{tier.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-linear-to-br from-citius-blue to-citius-blue/90 rounded-3xl p-8 text-white max-w-md mx-auto">
            <span className="text-sm text-white/80 uppercase tracking-wider mb-2 block">
              Starting From
            </span>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-2xl">{trail.pricing.basePrice}</span>
            </div>
            <p className="text-sm text-white/70 mt-2">{trail.pricing.note}</p>
            <p className="text-xs text-white/50 mt-1">{trail.pricing.nriPrice}</p>
          </div>
        )}

        {/* Add-on for Aerial */}
        {isAerial && trail.pricing.addOn && (
          <div className="mt-6 bg-citius-orange/5 rounded-xl p-4 max-w-md mx-auto border border-citius-orange/20">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-citius-orange" />
              <span className="text-sm font-medium text-citius-orange">Optional Add-On</span>
            </div>
            <p className="font-heading text-brand-dark">{trail.pricing.addOn.name}</p>
            <p className="text-xs text-brand-muted">{trail.pricing.addOn.description}</p>
            <p className="text-sm font-semibold text-citius-blue mt-1">{trail.pricing.addOn.price}</p>
          </div>
        )}
      </div>

      {/* Inclusions & Exclusions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inclusions */}
        <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100">
          <h4 className="font-heading text-lg text-emerald-800 mb-5 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            What&apos;s Included
          </h4>
          <ul className="space-y-3">
            {trail.details.inclusions.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Exclusions */}
        <div className="bg-red-50/50 rounded-2xl p-6 border border-red-100">
          <h4 className="font-heading text-lg text-red-800 mb-5 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Not Included
          </h4>
          <ul className="space-y-3">
            {trail.details.exclusions.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Accommodation */}
      <div className="bg-brand-light/50 rounded-2xl p-6 border border-brand-light">
        <h4 className="font-heading text-lg text-citius-blue mb-5 flex items-center gap-2">
          <Mountain className="w-5 h-5 text-citius-orange" />
          Accommodation Details
        </h4>
        <div className="grid sm:grid-cols-2 gap-4">
          {trail.details.accommodation.map((item, i) => (
            <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-brand-light">
              <p className="text-[10px] font-bold text-citius-orange uppercase tracking-wider mb-1">
                {item.type}
              </p>
              <p className="text-sm text-brand-dark">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transport Info for Aerial */}
      {isAerial && trail.details.transport && (
        <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
          <h4 className="font-heading text-lg text-citius-blue mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-citius-orange" />
            Transport Details
          </h4>
          <div className="space-y-2 text-sm text-brand-muted">
            <p><strong className="text-brand-dark">Surface:</strong> {trail.details.transport.surface}</p>
            <p><strong className="text-brand-dark">Flight:</strong> {trail.details.transport.flight}</p>
            <p><strong className="text-brand-dark">Border:</strong> {trail.details.transport.border}</p>
          </div>
        </div>
      )}

      {/* Medical Info */}
      {trail.details.medical && (
        <div className="bg-amber-50/50 rounded-2xl p-6 border border-amber-100">
          <h4 className="font-heading text-lg text-amber-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            Medical Support
          </h4>
          <div className="space-y-2 text-sm text-brand-muted">
            <p><strong className="text-brand-dark">Support:</strong> {trail.details.medical.support}</p>
            <p><strong className="text-brand-dark">Checkup:</strong> {trail.details.medical.checkup}</p>
            <p><strong className="text-brand-dark">Emergency:</strong> {trail.details.medical.emergency}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function InfoTab({ info, isAerial }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-8"
    >
      <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
        {/* Eligibility */}
        <div className="space-y-6">
          <div>
            <h4 className="font-heading text-lg text-citius-blue mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-citius-orange" />
              Eligibility & Health
            </h4>
            <ul className="space-y-2">
              {info.eligibility.map((item, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-brand-light/50 rounded-lg text-sm text-brand-muted">
                  <div className="w-1.5 h-1.5 bg-citius-orange rounded-full mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {info.medicalRequirements && (
            <div>
              <h4 className="font-heading text-lg text-citius-blue mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-citius-orange" />
                Medical Requirements
              </h4>
              <ul className="space-y-2">
                {info.medicalRequirements.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg text-sm text-brand-muted">
                    <div className="w-1.5 h-1.5 bg-citius-blue rounded-full mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* What to Pack & Other Info */}
        <div className="space-y-6">
          {info.whatToPack && (
            <div>
              <h4 className="font-heading text-lg text-citius-blue mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-citius-orange" />
                What to Pack
              </h4>
              <ul className="space-y-2">
                {info.whatToPack.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 bg-orange-50/50 rounded-lg text-sm text-brand-muted">
                    <div className="w-1.5 h-1.5 bg-citius-orange rounded-full mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Best Time */}
          <div className="bg-citius-blue/5 rounded-xl p-5 border border-citius-blue/10">
            <h4 className="font-heading text-base text-citius-blue mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-citius-orange" />
              Best Time to Visit
            </h4>
            <p className="text-sm text-brand-muted">{info.bestTime}</p>
          </div>

          {/* Border Info for Aerial */}
          {isAerial && info.borderInfo && (
            <div className="bg-citius-orange/5 rounded-xl p-5 border border-citius-orange/10">
              <h4 className="font-heading text-base text-citius-orange mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Border Information
              </h4>
              <p className="text-sm text-brand-muted">{info.borderInfo.title}</p>
              <p className="text-xs text-brand-muted mt-1">{info.borderInfo.documents}</p>
            </div>
          )}

          {/* Meal Info for Aerial */}
          {isAerial && info.mealPlan && (
            <div className="bg-emerald-50/50 rounded-xl p-5 border border-emerald-100">
              <h4 className="font-heading text-base text-emerald-700 mb-2 flex items-center gap-2">
                <Coffee className="w-4 h-4" />
                Meal Plan
              </h4>
              <p className="text-sm text-brand-muted">{info.mealPlan}</p>
            </div>
          )}
        </div>
      </div>

      {/* Safety Notes */}
      {info.safetyNotes && (
        <div className="bg-red-50/50 rounded-2xl p-6 border border-red-100">
          <h4 className="font-heading text-lg text-red-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Important Safety Notes
          </h4>
          <ul className="grid sm:grid-cols-2 gap-2">
            {info.safetyNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-brand-muted">
                <span className="text-red-500 mt-0.5">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Visa & Connectivity */}
      {info.visa && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-brand-dark rounded-xl p-5 text-white">
            <p className="text-xs text-citius-orange uppercase tracking-wider mb-2">Travel Documents</p>
            <p className="text-sm text-white/80">{info.visa.title}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-brand-light">
            <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-2">Digital Connection</p>
            <p className="text-sm text-brand-dark">{info.visa.connectivity}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function TrailSection({ trail, className, isAlternate }) {
  const [activeTab, setActiveTab] = useState("overview");
  
  if (!trail) return null;

  const { id, title, subtitle, tagline, positioning, overview, highlights, itinerary, details, info } = trail;
  const isAerial = id === "kailash-aerial-3day";

  return (
    <section 
      id={isAerial ? "package-aerial" : "package-14day"}
      className={cn(
        "py-16 md:py-32 scroll-mt-20",
        isAlternate ? "bg-[#f8f5f2]" : "bg-white",
        className
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {tagline && (
              <span className="inline-block bg-citius-orange/10 text-citius-orange text-xs font-medium tracking-wider uppercase px-3 py-1.5 rounded-full mb-4">
                {tagline}
              </span>
            )}
            <h2 className="font-heading text-2xl md:text-4xl lg:text-5xl text-citius-blue mb-3 md:mb-4 leading-tight">
              {title}
            </h2>
            <p className="font-sans text-lg md:text-xl text-brand-muted max-w-2xl mx-auto italic leading-relaxed">
              {subtitle}
            </p>
            {positioning && (
              <p className="font-sans text-sm md:text-base text-brand-muted/80 max-w-xl mx-auto mt-3">
                {positioning}
              </p>
            )}
            <div className="w-12 md:w-16 h-1 bg-citius-orange mx-auto mt-6 md:mt-8 rounded-full" />
          </motion.div>
        </div>

        {/* Quick Facts Bar */}
        {trail.quickFacts && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-3 md:gap-6 mb-10 md:mb-14"
          >
            {Object.entries(trail.quickFacts).map(([key, value]) => (
              <div
                key={key}
                className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-brand-light"
              >
                <span className="text-[10px] md:text-xs text-brand-muted uppercase tracking-wider block">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className="text-sm md:text-base font-heading text-citius-blue font-medium">
                  {value}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Tabs Navigation */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-12">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            label="Overview"
            icon={Star}
          />
          {highlights && (
            <TabButton
              active={activeTab === "highlights"}
              onClick={() => setActiveTab("highlights")}
              label="Highlights"
              icon={Sparkles}
            />
          )}
          <TabButton
            active={activeTab === "itinerary"}
            onClick={() => setActiveTab("itinerary")}
            label="Itinerary"
            icon={Map}
          />
          <TabButton
            active={activeTab === "pricing"}
            onClick={() => setActiveTab("pricing")}
            label="Pricing & Details"
            icon={FileText}
          />
          <TabButton
            active={activeTab === "info"}
            onClick={() => setActiveTab("info")}
            label="Important Info"
            icon={Info}
          />
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl shadow-brand-dark/5 border border-brand-light p-5 md:p-10 lg:p-14 min-h-[400px] relative overflow-hidden">
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-citius-orange/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          
          <AnimatePresence mode="wait">
            {activeTab === "overview" && overview && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 md:space-y-8"
              >
                <div className="grid lg:grid-cols-5 gap-6 md:gap-12 items-start">
                  <div className="lg:col-span-3">
                    <h3 className="font-heading text-xl md:text-2xl text-citius-blue mb-4 md:mb-6">
                      {overview.title}
                    </h3>
                    <div className="space-y-3 md:space-y-4 font-sans text-base md:text-lg text-brand-muted leading-relaxed">
                      {overview.intro.map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                      {overview.quote && (
                        <blockquote className="relative p-4 md:p-6 border-l-2 border-citius-orange bg-brand-light/30 italic my-6 md:my-8 text-lg md:text-xl">
                          <span className="absolute -top-3 -left-1 text-4xl md:text-5xl text-citius-orange/20 font-serif">&ldquo;</span>
                          {overview.quote}
                        </blockquote>
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-2 bg-brand-dark rounded-2xl p-6 md:p-8 text-white shadow-xl">
                    <h4 className="font-heading text-lg md:text-xl text-citius-orange mb-4 md:mb-6 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      The Citius Promise
                    </h4>
                    <ul className="space-y-3 md:space-y-4">
                      {overview.promise.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 group">
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-citius-orange/20 transition-colors">
                            <CheckCircle className="w-3 h-3 text-citius-orange" />
                          </div>
                          <span className="font-sans text-sm text-white/80 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                    {overview.closing && (
                      <div className="mt-6 md:mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="font-sans text-lg md:text-xl italic text-citius-orange whitespace-pre-line">
                          {overview.closing}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "highlights" && highlights && (
              <HighlightsTab highlights={highlights} />
            )}

            {activeTab === "itinerary" && itinerary && (
              <ItineraryTab 
                itinerary={itinerary} 
                hasAltitude={!isAerial}
              />
            )}

            {activeTab === "pricing" && details && (
              <PricingTab trail={trail} />
            )}

            {activeTab === "info" && info && (
              <InfoTab info={info} isAerial={isAerial} />
            )}
          </AnimatePresence>
        </div>
        
        {/* CTA Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 md:mt-16 text-center"
        >
          <div className="bg-linear-to-br from-brand-dark to-citius-blue rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden group">
            {/* Decorative circles */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-citius-orange/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-citius-blue/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
            
            <div className="relative z-10">
              <h3 className="font-heading text-2xl md:text-3xl text-white mb-3 italic">
                Ready for <span className="text-citius-orange">Transformation?</span>
              </h3>
              <p className="font-sans text-base md:text-lg text-white/60 mb-6 max-w-xl mx-auto">
                {isAerial 
                  ? "Limited seats per charter. Book early for preferred dates."
                  : "Multiple departure batches June–September 2026. Early registration recommended."
                }
              </p>
              <Link 
                href="/contact"
                className="inline-flex items-center gap-2 px-8 md:px-10 py-3.5 md:py-4 bg-citius-orange text-white font-heading tracking-wider text-sm rounded-full shadow-xl shadow-citius-orange/20 hover:shadow-citius-orange/40 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 transition-all duration-300"
              >
                Request Detailed Brochure
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
