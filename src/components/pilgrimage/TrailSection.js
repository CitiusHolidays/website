"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  Map,
  Heart,
  Shield,
  Users,
  CheckCircle,
  AlertCircle,
  Mountain,
  Coffee,
  FileText,
  MapPin,
  Star,
  Sparkles,
  Clock,
  Calendar,
  ArrowRight,
  IndianRupee,
  Info,
  Camera,
  MessageSquare,
  Video,
  BookOpen,
  ExternalLink,
  Quote
} from "lucide-react";
import Link from "next/link";
import { cn } from "../../utils/cn";
import { getTrailTestimonials, toYoutubeEmbedUrl } from "../../data/trails";

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

/** Per-day image: use `image.src` or a dashed placeholder (`image.caption` optional). */
function DayItineraryImage({ item, dayLabel }) {
  const image = item.image;
  if (image?.src) {
    return (
      <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl border border-brand-light bg-brand-light/20 shadow-inner">
        <Image
          src={image.src}
          alt={image.alt || `${dayLabel} — ${item.title || "Itinerary"}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 360px"
        />
      </div>
    );
  }

  const caption = image?.caption || `Add a photo for ${dayLabel}`;

  return (
    <div className="relative flex aspect-16/10 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-citius-orange/25 bg-linear-to-br from-brand-light/80 to-brand-light/40 px-3 text-center shadow-inner">
      <Camera className="mb-2 h-8 w-8 text-citius-orange/45" aria-hidden />
      <p className="text-xs font-heading leading-snug text-brand-muted">{caption}</p>
    </div>
  );
}

function ItineraryTab({ itinerary, itineraryTimelineImage }) {
  const hasImage = itineraryTimelineImage?.src;
  const showPlaceholder = itineraryTimelineImage?.placeholder && !hasImage;

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

      {(hasImage || showPlaceholder) && (
        <div className="mb-8 rounded-2xl overflow-hidden border border-brand-light bg-brand-light/30 shadow-inner">
          {hasImage ? (
            <div className="relative aspect-21/9 w-full md:aspect-2.4/1">
              <Image
                src={itineraryTimelineImage.src}
                alt={itineraryTimelineImage.alt || "Journey visual"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 72rem"
              />
            </div>
          ) : (
            <div className="relative aspect-21/9 w-full md:aspect-2.4/1 flex flex-col items-center justify-center bg-linear-to-br from-brand-light/80 to-brand-light/40 border-2 border-dashed border-citius-orange/25">
              <Camera className="w-10 h-10 text-citius-orange/50 mb-2" />
              <p className="text-sm font-heading text-brand-muted px-4 text-center">
                {itineraryTimelineImage.caption || "Image placeholder — add your photo here."}
              </p>
            </div>
          )}
        </div>
      )}

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

              {/* Day Card — image + details */}
              <div className="rounded-xl border border-brand-light bg-white shadow-sm transition-all hover:border-citius-orange/20 hover:shadow-md md:rounded-2xl">
                <div className="flex flex-col gap-4 p-4 md:grid md:grid-cols-5 md:gap-6 md:p-6">
                  <div className="md:col-span-2">
                    <DayItineraryImage item={item} dayLabel={item.day || `Day ${idx + 1}`} />
                  </div>
                  <div className="min-w-0 md:col-span-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <span className="rounded-full bg-citius-orange/10 px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-widest text-citius-orange">
                        {item.day}
                      </span>
                      {item.altitude && (
                        <span className="flex items-center gap-1 rounded-full bg-brand-light px-2 py-1 text-xs text-brand-muted">
                          <Mountain className="h-3 w-3" />
                          {item.altitude}
                        </span>
                      )}
                      {item.trek && (
                        <span className="flex items-center gap-1 rounded-full bg-citius-blue/10 px-2 py-1 text-xs text-citius-blue">
                          <MapPin className="h-3 w-3" />
                          {item.trek}
                        </span>
                      )}
                      {item.flight && (
                        <span className="flex items-center gap-1 rounded-full bg-citius-orange/10 px-2 py-1 text-xs text-citius-orange">
                          <Clock className="h-3 w-3" />
                          {item.flight}
                        </span>
                      )}
                    </div>

                    <h4 className="mb-2 font-heading text-base leading-tight text-citius-blue md:text-lg">
                      {item.title}
                    </h4>
                    <p className="mb-3 font-sans text-sm leading-relaxed text-brand-muted">
                      {item.desc}
                    </p>

                    {item.highlights && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {item.highlights.map((highlight, hidx) => (
                          <span
                            key={hidx}
                            className="rounded-full bg-citius-blue/5 px-2 py-1 text-[10px] text-citius-blue/80 md:text-xs"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    )}

                    {(item.accommodation || item.meals || item.transport) && (
                      <div className="flex flex-wrap gap-3 border-t border-brand-light pt-3 text-xs text-brand-muted">
                        {item.accommodation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.accommodation}
                          </span>
                        )}
                        {item.meals && (
                          <span className="flex items-center gap-1">
                            <Coffee className="h-3 w-3" />
                            {item.meals}
                          </span>
                        )}
                        {item.transport && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {item.transport}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function RegistrationAndPolicySection({ policy }) {
  if (!policy) return null;
  return (
    <div className="mt-10 md:mt-14 space-y-8 text-left">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6 md:p-8">
        <h4 className="font-heading text-lg text-emerald-900 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-700" />
          Registration
        </h4>
        {policy.bookingFormNote && (
          <p className="text-sm text-brand-muted mb-4 leading-relaxed">{policy.bookingFormNote}</p>
        )}
        {policy.registrationSteps?.length > 0 && (
          <ol className="list-decimal list-inside space-y-2 text-sm text-brand-dark/90">
            {policy.registrationSteps.map((step, i) => (
              <li key={i} className="leading-relaxed pl-1">
                {step}
              </li>
            ))}
          </ol>
        )}
        {policy.fitnessCertificate && (
          <p className="mt-4 text-sm text-brand-muted border-t border-emerald-200/60 pt-4 leading-relaxed">
            <strong className="text-brand-dark">Fitness certificate:</strong> {policy.fitnessCertificate}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 md:p-8">
        <h4 className="font-heading text-lg text-amber-900 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-700" />
          Cancellation &amp; limitations
        </h4>
        {policy.cancellationDisclaimer?.length > 0 && (
          <ul className="space-y-2 text-sm text-brand-muted mb-6">
            {policy.cancellationDisclaimer.map((line, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="text-amber-600 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        {policy.refundTiers?.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-heading uppercase tracking-wider text-brand-dark">Refund policy</p>
            <ul className="space-y-3">
              {policy.refundTiers.map((tier, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm"
                >
                  <span className="font-semibold text-brand-dark">{tier.window}</span>
                  <span className="text-brand-muted"> — {tier.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PricingTab({ trail }) {
  const isTieredPricing = Array.isArray(trail.pricing?.tiers);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Price Display */}
      <div className="text-center mb-8">
        {isTieredPricing ? (
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

        {/* Add-on for tiered (e.g. aerial) packages */}
        {isTieredPricing && trail.pricing.addOn && (
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

      {/* Transport Info (e.g. aerial packages) */}
      {trail.layoutVariant === "aerial" && trail.details.transport && (
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

function InfoTab({ info, layoutVariant }) {
  const isAerialLayout = layoutVariant === "aerial";
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

          {/* Border Info (aerial / border-heavy trips) */}
          {isAerialLayout && info.borderInfo && (
            <div className="bg-citius-orange/5 rounded-xl p-5 border border-citius-orange/10">
              <h4 className="font-heading text-base text-citius-orange mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Border Information
              </h4>
              <p className="text-sm text-brand-muted">{info.borderInfo.title}</p>
              <p className="text-xs text-brand-muted mt-1">{info.borderInfo.documents}</p>
            </div>
          )}

          {/* Meal Info */}
          {isAerialLayout && info.mealPlan && (
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

function DeparturesBlock({ departures }) {
  if (!departures?.batches?.length) return null;
  return (
    <div className="mt-8 rounded-2xl border border-citius-blue/15 bg-citius-blue/5 p-6 md:p-8">
      <h4 className="font-heading text-lg text-citius-blue mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-citius-orange" />
        Departure dates
      </h4>
      <div className="space-y-6">
        {departures.batches.map((batch, i) => (
          <div key={i}>
            <p className="text-sm font-semibold text-brand-dark">{batch.name}</p>
            <ul className="mt-2 space-y-2">
              {batch.dates.map((d, j) => (
                <li key={j} className="text-sm text-brand-muted flex gap-2 items-start">
                  <span className="text-citius-orange shrink-0">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function GalleryTab({ gallery }) {
  if (!gallery?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="columns-2 md:columns-3 gap-4 space-y-4"
    >
      {gallery.map((img, idx) => (
        <div
          key={idx}
          className="break-inside-avoid rounded-xl overflow-hidden border border-brand-light shadow-sm bg-brand-light/30"
        >
          <Image
            src={img.src}
            alt={img.alt || "Yatra photo"}
            width={720}
            height={480}
            className="w-full h-auto object-cover"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
        </div>
      ))}
    </motion.div>
  );
}

function BookingTab({ options }) {
  if (!options?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="grid sm:grid-cols-2 gap-4 md:gap-6"
    >
      {options.map((opt, i) => {
        const isExternal = opt.href.startsWith("http");
        const className =
          "group flex flex-col rounded-2xl border border-brand-light bg-white p-6 shadow-sm transition-all hover:border-citius-orange/40 hover:shadow-md";
        const inner = (
          <>
            <span className="font-heading text-citius-blue text-lg mb-2 flex items-center gap-2">
              {opt.label}
              <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" />
            </span>
            {opt.note && <p className="text-sm text-brand-muted leading-relaxed">{opt.note}</p>}
            <span className="mt-4 text-sm font-medium text-citius-orange">Continue →</span>
          </>
        );
        if (isExternal) {
          return (
            <a key={i} href={opt.href} className={className} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          );
        }
        return (
          <Link key={i} href={opt.href} className={className}>
            {inner}
          </Link>
        );
      })}
    </motion.div>
  );
}

function ReviewsTab({ testimonials }) {
  if (!testimonials?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="grid md:grid-cols-2 gap-6"
    >
      {testimonials.map((t) => (
        <div
          key={t.id}
          className="rounded-2xl border border-brand-light bg-linear-to-br from-white to-brand-light/40 p-6"
        >
          <div className="flex gap-1 mb-3">
            {Array.from({ length: t.rating || 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-citius-orange text-citius-orange" />
            ))}
          </div>
          <p className="text-sm text-brand-dark/90 leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
          <p className="mt-4 text-sm font-heading text-citius-blue">{t.name}</p>
          <p className="text-xs text-brand-muted">
            {t.location}
            {t.journey ? ` · ${t.journey}` : ""}
          </p>
        </div>
      ))}
    </motion.div>
  );
}

function MediaTab({ media }) {
  const embed = media?.videoUrl ? toYoutubeEmbedUrl(media.videoUrl) : null;
  const hasAr = Boolean(media?.arUrl);
  if (!embed && !hasAr) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-8"
    >
      {embed && (
        <div>
          <h4 className="font-heading text-lg text-citius-blue mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-citius-orange" />
            Trip film
          </h4>
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-brand-light bg-brand-dark shadow-lg">
            <iframe
              title="Trail video"
              src={embed}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
      {hasAr && (
        <div className="rounded-2xl border border-citius-orange/20 bg-citius-orange/5 p-6">
          <h4 className="font-heading text-lg text-citius-orange mb-2">AR experience</h4>
          <p className="text-sm text-brand-muted mb-4">
            Open the immersive view on a compatible device (link opens in a new tab).
          </p>
          <a
            href={media.arUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-citius-orange text-white text-sm font-heading tracking-wider hover:brightness-110 transition-all"
          >
            Launch AR
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </motion.div>
  );
}

function BlogsTab({ posts }) {
  if (!posts?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-4"
    >
      <p className="text-sm text-brand-muted mb-4">
        Stories and updates from Citius — hand-picked for this journey.
      </p>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-brand-light bg-white px-5 py-4 hover:border-citius-blue/30 hover:shadow-sm transition-all"
            >
              <span className="font-heading text-citius-blue">{post.title}</span>
              <ArrowRight className="w-4 h-4 text-citius-orange shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export default function TrailSection({
  trail,
  className,
  isAlternate,
  relatedBlogPosts = [],
  embedded = false
}) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!trail) return null;

  const {
    title,
    subtitle,
    tagline,
    positioning,
    overview,
    highlights,
    itinerary,
    details,
    info,
    layoutVariant = "trek",
    status,
    gallery = [],
    bookingOptions = [],
    media
  } = trail;

  const isAerial = layoutVariant === "aerial";
  const isComingSoon = status === "comingSoon";
  const hasGallery = gallery.length > 0;
  const hasHighlights = highlights && highlights.length > 0;
  const hasItinerary = itinerary && itinerary.length > 0;
  const hasPricing = Boolean(details);
  const hasInfo = Boolean(info);
  const hasBooking = bookingOptions.length > 0;
  const reviewsList =
    trail.testimonials?.length > 0 ? trail.testimonials : getTrailTestimonials(trail);
  const hasReviews = reviewsList.length > 0;
  const hasMedia =
    Boolean(media?.videoUrl && toYoutubeEmbedUrl(media.videoUrl)) || Boolean(media?.arUrl);
  const hasBlogs = relatedBlogPosts.length > 0;

  const legacySectionId = isAerial ? "package-aerial" : "package-14day";

  return (
    <section
      id={trail.slug ? `trail-${trail.slug}` : legacySectionId}
      className={cn(
        embedded
          ? "py-6 md:py-12 scroll-mt-20 bg-white"
          : cn(
              "py-16 md:py-32 scroll-mt-20",
              isAlternate ? "bg-[#f8f5f2]" : "bg-white"
            ),
        className
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        {!embedded && (
          <>
            <div className="text-center mb-10 md:mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  {isComingSoon && (
                    <span className="inline-block bg-amber-100 text-amber-900 text-xs font-medium tracking-wider uppercase px-3 py-1.5 rounded-full border border-amber-200">
                      Coming soon
                    </span>
                  )}
                  {tagline && (
                    <span className="inline-block bg-citius-orange/10 text-citius-orange text-xs font-medium tracking-wider uppercase px-3 py-1.5 rounded-full">
                      {tagline}
                    </span>
                  )}
                </div>
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
          </>
        )}

        {embedded && isComingSoon && (
          <p className="text-center text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-full py-2 px-4 mb-8 max-w-xl mx-auto">
            This programme is not yet open for booking — explore the overview and register your interest below.
          </p>
        )}

        {/* Tabs Navigation */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-12">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            label="Overview"
            icon={Star}
          />
          {hasGallery && (
            <TabButton
              active={activeTab === "gallery"}
              onClick={() => setActiveTab("gallery")}
              label="Gallery"
              icon={Camera}
            />
          )}
          {hasHighlights && (
            <TabButton
              active={activeTab === "highlights"}
              onClick={() => setActiveTab("highlights")}
              label="Highlights"
              icon={Sparkles}
            />
          )}
          {hasItinerary && (
            <TabButton
              active={activeTab === "itinerary"}
              onClick={() => setActiveTab("itinerary")}
              label="Itinerary"
              icon={Map}
            />
          )}
          {hasPricing && (
            <TabButton
              active={activeTab === "pricing"}
              onClick={() => setActiveTab("pricing")}
              label="Pricing & Details"
              icon={FileText}
            />
          )}
          {hasInfo && (
            <TabButton
              active={activeTab === "info"}
              onClick={() => setActiveTab("info")}
              label="Important Info"
              icon={Info}
            />
          )}
          {hasBooking && (
            <TabButton
              active={activeTab === "booking"}
              onClick={() => setActiveTab("booking")}
              label="Booking"
              icon={MessageSquare}
            />
          )}
          {hasReviews && (
            <TabButton
              active={activeTab === "reviews"}
              onClick={() => setActiveTab("reviews")}
              label="Reviews"
              icon={Quote}
            />
          )}
          {hasMedia && (
            <TabButton
              active={activeTab === "media"}
              onClick={() => setActiveTab("media")}
              label="Video / AR"
              icon={Video}
            />
          )}
          {hasBlogs && (
            <TabButton
              active={activeTab === "blogs"}
              onClick={() => setActiveTab("blogs")}
              label="Blogs"
              icon={BookOpen}
            />
          )}
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
                <div
                  className={cn(
                    "grid gap-6 md:gap-12 items-start",
                    overview.promise?.length ? "lg:grid-cols-5" : "lg:grid-cols-1"
                  )}
                >
                  <div className={overview.promise?.length ? "lg:col-span-3" : ""}>
                    <h3 className="font-heading text-xl md:text-2xl text-citius-blue mb-4 md:mb-6">
                      {overview.title}
                    </h3>
                    <div className="space-y-3 md:space-y-4 font-sans text-base md:text-lg text-brand-muted leading-relaxed">
                      {(overview.intro || []).map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                      {overview.privateGroupNote && (
                        <div className="rounded-2xl border border-citius-blue/15 bg-citius-blue/5 p-5 md:p-6 my-4 md:my-6">
                          <p className="text-sm md:text-base text-brand-dark leading-relaxed">
                            {overview.privateGroupNote}
                          </p>
                        </div>
                      )}
                      {overview.quote && (
                        <blockquote className="relative p-4 md:p-6 border-l-2 border-citius-orange bg-brand-light/30 italic my-6 md:my-8 text-lg md:text-xl">
                          <span className="absolute -top-3 -left-1 text-4xl md:text-5xl text-citius-orange/20 font-serif">&ldquo;</span>
                          {overview.quote}
                        </blockquote>
                      )}
                    </div>
                    <DeparturesBlock departures={trail.departures} />
                  </div>
                  {overview.promise?.length > 0 && (
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
                  )}
                </div>
                <RegistrationAndPolicySection policy={trail.registrationAndPolicy} />
              </motion.div>
            )}

            {activeTab === "highlights" && highlights && (
              <HighlightsTab highlights={highlights} />
            )}

            {activeTab === "itinerary" && itinerary && (
              <ItineraryTab
                itinerary={itinerary}
                itineraryTimelineImage={trail.itineraryTimelineImage}
              />
            )}

            {activeTab === "pricing" && details && (
              <PricingTab trail={trail} />
            )}

            {activeTab === "info" && info && (
              <InfoTab info={info} layoutVariant={layoutVariant} />
            )}

            {activeTab === "gallery" && hasGallery && (
              <GalleryTab gallery={gallery} />
            )}

            {activeTab === "booking" && hasBooking && (
              <BookingTab options={bookingOptions} />
            )}

            {activeTab === "reviews" && hasReviews && (
              <ReviewsTab testimonials={reviewsList} />
            )}

            {activeTab === "media" && hasMedia && (
              <MediaTab media={media} />
            )}

            {activeTab === "blogs" && hasBlogs && (
              <BlogsTab posts={relatedBlogPosts} />
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
