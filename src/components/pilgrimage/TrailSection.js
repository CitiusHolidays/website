"use client";

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  Coffee,
  ExternalLink,
  FileText,
  Heart,
  Info,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Mountain,
  Quote,
  Shield,
  Sparkles,
  Star,
  Users,
  Video,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getTrailTestimonials, toYoutubeEmbedUrl } from "../../data/trails";
import { cn } from "../../utils/cn";

const EMPTY_RELATED_BLOG_POSTS = [];

const TabButton = ({ active, onClick, label, icon: Icon }) => (
  <button
    className={cn(
      "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 font-heading text-xs uppercase tracking-wider transition-all md:px-6 md:py-3 md:text-sm",
      active
        ? "scale-105 border-citius-blue bg-citius-blue text-white shadow-lg"
        : "border-gray-200 bg-white text-brand-muted hover:border-citius-blue/30 hover:text-citius-blue"
    )}
    onClick={onClick}
    type="button"
  >
    {Icon && <Icon className="size-3.5 md:h-4 md:w-4" />}
    {label}
  </button>
);

function HighlightsTab({ highlights }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
    >
      <h3 className="mb-8 text-center font-heading text-citius-blue text-xl md:text-2xl">
        Sacred Sites Along the Journey
      </h3>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {highlights.map((site, idx) => (
          <m.div
            animate={{ opacity: 1, scale: 1 }}
            className="group rounded-2xl border border-brand-light bg-linear-to-br from-white to-brand-light/50 p-5 transition-all duration-300 hover:border-citius-orange/30 hover:shadow-lg md:p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            key={site.title}
            transition={{ delay: idx * 0.1 }}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-citius-orange/10">
                <Sparkles className="size-4 text-citius-orange md:h-5 md:w-5" />
              </div>
              <div>
                <span className="font-medium text-[10px] text-citius-orange uppercase tracking-wider md:text-xs">
                  {site.significance}
                </span>
                <h4 className="font-heading text-base text-citius-blue leading-tight md:text-lg">
                  {site.title}
                </h4>
              </div>
            </div>
            <p className="mb-2 flex items-center gap-1 text-brand-muted text-xs md:text-sm">
              <MapPin className="size-3" />
              {site.location}
            </p>
            <p className="text-brand-dark/80 text-sm leading-relaxed">{site.description}</p>
          </m.div>
        ))}
      </div>
    </m.div>
  );
}

/** Per-day image: use `image.src` or a dashed placeholder (`image.caption` optional). */
function DayItineraryImage({ item, dayLabel }) {
  const image = item.image;
  if (image?.src) {
    const intrinsic =
      typeof image.width === "number" &&
      typeof image.height === "number" &&
      image.width > 0 &&
      image.height > 0;

    if (intrinsic) {
      return (
        <div className="relative w-full overflow-hidden rounded-xl border border-brand-light bg-brand-light/20 shadow-inner">
          <Image
            alt={image.alt || `${dayLabel} — ${item.title || "Itinerary"}`}
            className="h-auto w-full"
            height={image.height}
            sizes="(max-width: 768px) 100vw, 360px"
            src={image.src}
            width={image.width}
          />
        </div>
      );
    }

    return (
      <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl border border-brand-light bg-brand-light/20 shadow-inner">
        <Image
          alt={image.alt || `${dayLabel} — ${item.title || "Itinerary"}`}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 360px"
          src={image.src}
          style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
        />
      </div>
    );
  }

  const caption = image?.caption || `Add a photo for ${dayLabel}`;

  return (
    <div className="relative flex aspect-16/10 w-full flex-col items-center justify-center rounded-xl border-2 border-citius-orange/25 border-dashed bg-linear-to-br from-brand-light/80 to-brand-light/40 px-3 text-center shadow-inner">
      <Camera aria-hidden className="mb-2 size-8 text-citius-orange/45" />
      <p className="font-heading text-brand-muted text-xs leading-snug">{caption}</p>
    </div>
  );
}

function ItineraryTab({ itinerary, itineraryTimelineImage }) {
  const hasImage = itineraryTimelineImage?.src;
  const showPlaceholder = itineraryTimelineImage?.placeholder && !hasImage;

  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
      exit={{ opacity: 0, scale: 1.05 }}
      initial={{ opacity: 0, scale: 0.95 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-heading text-citius-blue text-xl md:text-2xl">
          {itinerary.length}-Day Journey
        </h3>
        <span className="rounded-full bg-brand-light px-3 py-1.5 text-brand-muted text-xs md:text-sm">
          Scroll to explore each day
        </span>
      </div>

      {(hasImage || showPlaceholder) && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-brand-light bg-brand-light/30 shadow-inner">
          {hasImage ? (
            <div className="relative aspect-21/9 w-full md:aspect-2.4/1">
              <Image
                alt={itineraryTimelineImage.alt || "Journey visual"}
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 72rem"
                src={itineraryTimelineImage.src}
              />
            </div>
          ) : (
            <div className="relative flex aspect-21/9 w-full flex-col items-center justify-center border-2 border-citius-orange/25 border-dashed bg-linear-to-br from-brand-light/80 to-brand-light/40 md:aspect-2.4/1">
              <Camera className="mb-2 size-10 text-citius-orange/50" />
              <p className="px-4 text-center font-heading text-brand-muted text-sm">
                {itineraryTimelineImage.caption || "Image placeholder — add your photo here."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute top-0 bottom-0 left-4 w-px bg-linear-to-b from-citius-orange via-citius-blue to-citius-orange/30 md:left-6" />

        {/* Day Cards */}
        <div className="space-y-4 md:space-y-6">
          {itinerary.map((item, idx) => (
            <m.div
              animate={{ opacity: 1, x: 0 }}
              className="relative pl-12 md:pl-16"
              initial={{ opacity: 0, x: -20 }}
              key={item.day || item.title}
              transition={{ delay: idx * 0.05 }}
            >
              {/* Timeline Dot */}
              <div className="absolute top-4 left-2 z-10 flex size-4 items-center justify-center rounded-full border-2 border-citius-orange bg-white shadow-md md:left-4 md:h-5 md:w-5">
                <div className="size-1.5 rounded-full bg-citius-orange" />
              </div>

              {/* Day Card — image + details */}
              <div className="rounded-xl border border-brand-light bg-white shadow-sm transition-all hover:border-citius-orange/20 hover:shadow-md md:rounded-2xl">
                <div className="flex flex-col gap-4 p-4 md:grid md:grid-cols-5 md:gap-6 md:p-6">
                  <div className="md:col-span-2">
                    <DayItineraryImage dayLabel={item.day || `Day ${idx + 1}`} item={item} />
                  </div>
                  <div className="min-w-0 md:col-span-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <span className="rounded-full bg-citius-orange/10 px-2.5 py-1 font-bold font-heading text-citius-orange text-xs uppercase tracking-widest">
                        {item.day}
                      </span>
                      {item.altitude && (
                        <span className="flex items-center gap-1 rounded-full bg-brand-light px-2 py-1 text-brand-muted text-xs">
                          <Mountain className="size-3" />
                          {item.altitude}
                        </span>
                      )}
                      {item.trek && (
                        <span className="flex items-center gap-1 rounded-full bg-citius-blue/10 px-2 py-1 text-citius-blue text-xs">
                          <MapPin className="size-3" />
                          {item.trek}
                        </span>
                      )}
                      {item.flight && (
                        <span className="flex items-center gap-1 rounded-full bg-citius-orange/10 px-2 py-1 text-citius-orange text-xs">
                          <Clock className="size-3" />
                          {item.flight}
                        </span>
                      )}
                    </div>

                    <h4 className="mb-2 font-heading text-base text-citius-blue leading-tight md:text-lg">
                      {item.title}
                    </h4>
                    <p className="mb-3 font-sans text-brand-muted text-sm leading-relaxed">
                      {item.desc}
                    </p>

                    {item.highlights && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {item.highlights.map((highlight) => (
                          <span
                            className="rounded-full bg-citius-blue/5 px-2 py-1 text-[10px] text-citius-blue/80 md:text-xs"
                            key={highlight}
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    )}

                    {(item.accommodation || item.meals || item.transport) && (
                      <div className="flex flex-wrap gap-3 border-brand-light border-t pt-3 text-brand-muted text-xs">
                        {item.accommodation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {item.accommodation}
                          </span>
                        )}
                        {item.meals && (
                          <span className="flex items-center gap-1">
                            <Coffee className="size-3" />
                            {item.meals}
                          </span>
                        )}
                        {item.transport && (
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {item.transport}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </m.div>
  );
}

function RegistrationAndPolicySection({ policy }) {
  if (!policy) {
    return null;
  }
  return (
    <div className="mt-10 space-y-8 text-left md:mt-14">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6 md:p-8">
        <h4 className="mb-3 flex items-center gap-2 font-heading text-emerald-900 text-lg">
          <FileText className="size-5 text-emerald-700" />
          Registration
        </h4>
        {policy.bookingFormNote && (
          <p className="mb-4 text-brand-muted text-sm leading-relaxed">{policy.bookingFormNote}</p>
        )}
        {policy.registrationSteps?.length > 0 && (
          <ol className="list-inside list-decimal space-y-2 text-brand-dark/90 text-sm">
            {policy.registrationSteps.map((step) => (
              <li className="pl-1 leading-relaxed" key={step}>
                {step}
              </li>
            ))}
          </ol>
        )}
        {policy.fitnessCertificate && (
          <p className="mt-4 border-emerald-200/60 border-t pt-4 text-brand-muted text-sm leading-relaxed">
            <strong className="text-brand-dark">Fitness certificate:</strong>{" "}
            {policy.fitnessCertificate}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6 md:p-8">
        <h4 className="mb-3 flex items-center gap-2 font-heading text-amber-900 text-lg">
          <AlertCircle className="size-5 text-amber-700" />
          Cancellation &amp; limitations
        </h4>
        {policy.cancellationDisclaimer?.length > 0 && (
          <ul className="mb-6 space-y-2 text-brand-muted text-sm">
            {policy.cancellationDisclaimer.map((line) => (
              <li className="flex gap-2 leading-relaxed" key={line}>
                <span className="shrink-0 text-amber-600">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        {policy.refundTiers?.length > 0 && (
          <div className="space-y-3">
            <p className="font-heading text-brand-dark text-xs uppercase tracking-wider">
              Refund policy
            </p>
            <ul className="space-y-3">
              {policy.refundTiers.map((tier) => (
                <li
                  className="rounded-xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm"
                  key={tier.window}
                >
                  <span className="font-semibold text-brand-dark">{tier.window}</span>
                  <span className="text-brand-muted">: {tier.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PackageDetailsTab({ trail }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
    >
      {/* Inclusions & Exclusions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inclusions */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6">
          <h4 className="mb-5 flex items-center gap-2 font-heading text-emerald-800 text-lg">
            <CheckCircle className="size-5 text-emerald-600" />
            What&apos;s Included
          </h4>
          <ul className="space-y-3">
            {trail.details.inclusions.map((item) => (
              <li className="flex items-start gap-3 text-gray-700 text-sm" key={item}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Exclusions */}
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6">
          <h4 className="mb-5 flex items-center gap-2 font-heading text-lg text-red-800">
            <AlertCircle className="size-5 text-red-600" />
            Not Included
          </h4>
          <ul className="space-y-3">
            {trail.details.exclusions.map((item) => (
              <li className="flex items-start gap-3 text-gray-700 text-sm" key={item}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Accommodation */}
      <div className="rounded-2xl border border-brand-light bg-brand-light/50 p-6">
        <h4 className="mb-5 flex items-center gap-2 font-heading text-citius-blue text-lg">
          <Mountain className="size-5 text-citius-orange" />
          Accommodation Details
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          {trail.details.accommodation.map((item) => (
            <div
              className="rounded-xl border border-brand-light bg-white p-4 shadow-sm"
              key={item.type}
            >
              <p className="mb-1 font-bold text-[10px] text-citius-orange uppercase tracking-wider">
                {item.type}
              </p>
              <p className="text-brand-dark text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transport Info (e.g. aerial packages) */}
      {trail.layoutVariant === "aerial" && trail.details.transport && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
          <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
            <Users className="size-5 text-citius-orange" />
            Transport Details
          </h4>
          <div className="space-y-2 text-brand-muted text-sm">
            <p>
              <strong className="text-brand-dark">Surface:</strong>{" "}
              {trail.details.transport.surface}
            </p>
            <p>
              <strong className="text-brand-dark">Flight:</strong> {trail.details.transport.flight}
            </p>
            <p>
              <strong className="text-brand-dark">Border:</strong> {trail.details.transport.border}
            </p>
          </div>
        </div>
      )}

      {/* Medical Info */}
      {trail.details.medical && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-6">
          <h4 className="mb-4 flex items-center gap-2 font-heading text-amber-800 text-lg">
            <Shield className="size-5 text-amber-600" />
            Medical Support
          </h4>
          <div className="space-y-2 text-brand-muted text-sm">
            <p>
              <strong className="text-brand-dark">Support:</strong> {trail.details.medical.support}
            </p>
            <p>
              <strong className="text-brand-dark">Checkup:</strong> {trail.details.medical.checkup}
            </p>
            <p>
              <strong className="text-brand-dark">Emergency:</strong>{" "}
              {trail.details.medical.emergency}
            </p>
          </div>
        </div>
      )}
    </m.div>
  );
}

function InfoTab({ info, layoutVariant }) {
  const isAerialLayout = layoutVariant === "aerial";
  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
      exit={{ opacity: 0, scale: 0.98 }}
      initial={{ opacity: 0, scale: 1.02 }}
    >
      <div className="grid gap-6 md:gap-8 lg:grid-cols-2">
        {/* Eligibility */}
        <div className="space-y-6">
          <div>
            <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
              <Heart className="size-5 text-citius-orange" />
              Eligibility & Health
            </h4>
            <ul className="space-y-2">
              {info.eligibility.map((item) => (
                <li
                  className="flex items-start gap-3 rounded-lg bg-brand-light/50 p-3 text-brand-muted text-sm"
                  key={item}
                >
                  <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {info.medicalRequirements && (
            <div>
              <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
                <Shield className="size-5 text-citius-orange" />
                Medical Requirements
              </h4>
              <ul className="space-y-2">
                {info.medicalRequirements.map((item) => (
                  <li
                    className="flex items-start gap-3 rounded-lg bg-blue-50/50 p-3 text-brand-muted text-sm"
                    key={item}
                  >
                    <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-citius-blue" />
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
              <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
                <FileText className="size-5 text-citius-orange" />
                What to Pack
              </h4>
              <ul className="space-y-2">
                {info.whatToPack.map((item) => (
                  <li
                    className="flex items-start gap-3 rounded-lg bg-orange-50/50 p-3 text-brand-muted text-sm"
                    key={item}
                  >
                    <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Best Time */}
          <div className="rounded-xl border border-citius-blue/10 bg-citius-blue/5 p-5">
            <h4 className="mb-2 flex items-center gap-2 font-heading text-base text-citius-blue">
              <Calendar className="size-4 text-citius-orange" />
              Best Time to Visit
            </h4>
            <p className="text-brand-muted text-sm">{info.bestTime}</p>
          </div>

          {/* Border Info (aerial / border-heavy trips) */}
          {isAerialLayout && info.borderInfo && (
            <div className="rounded-xl border border-citius-orange/10 bg-citius-orange/5 p-5">
              <h4 className="mb-2 flex items-center gap-2 font-heading text-base text-citius-orange">
                <Info className="size-4" />
                Border Information
              </h4>
              <p className="text-brand-muted text-sm">{info.borderInfo.title}</p>
              <p className="mt-1 text-brand-muted text-xs">{info.borderInfo.documents}</p>
            </div>
          )}

          {/* Meal Info */}
          {isAerialLayout && info.mealPlan && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
              <h4 className="mb-2 flex items-center gap-2 font-heading text-base text-emerald-700">
                <Coffee className="size-4" />
                Meal Plan
              </h4>
              <p className="text-brand-muted text-sm">{info.mealPlan}</p>
            </div>
          )}
        </div>
      </div>

      {/* Safety Notes */}
      {info.safetyNotes && (
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6">
          <h4 className="mb-4 flex items-center gap-2 font-heading text-lg text-red-800">
            <AlertCircle className="size-5 text-red-600" />
            Important Safety Notes
          </h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {info.safetyNotes.map((note) => (
              <li className="flex items-start gap-2 text-brand-muted text-sm" key={note}>
                <span className="mt-0.5 text-red-500">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Visa & Connectivity */}
      {info.visa && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-brand-dark p-5 text-white">
            <p className="mb-2 text-citius-orange text-xs uppercase tracking-wider">
              Travel Documents
            </p>
            <p className="text-sm text-white/80">{info.visa.title}</p>
          </div>
          <div className="rounded-xl border border-brand-light bg-white p-5">
            <p className="mb-2 text-[10px] text-brand-muted uppercase tracking-wider">
              Digital Connection
            </p>
            <p className="text-brand-dark text-sm">{info.visa.connectivity}</p>
          </div>
        </div>
      )}
    </m.div>
  );
}

function DeparturesBlock({ departures }) {
  if (!departures?.batches?.length) {
    return null;
  }
  return (
    <div className="mt-8 rounded-2xl border border-citius-blue/15 bg-citius-blue/5 p-6 md:p-8">
      <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
        <Calendar className="size-5 text-citius-orange" />
        Departure dates
      </h4>
      <div className="space-y-6">
        {departures.batches.map((batch) => (
          <div key={batch.name}>
            <p className="font-semibold text-brand-dark text-sm">{batch.name}</p>
            <ul className="mt-2 space-y-2">
              {batch.dates.map((d) => (
                <li className="flex items-start gap-2 text-brand-muted text-sm" key={d}>
                  <span className="shrink-0 text-citius-orange">•</span>
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
  if (!gallery?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="columns-2 gap-4 space-y-4 md:columns-3"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {gallery.map((img) => (
        <div
          className="break-inside-avoid overflow-hidden rounded-xl border border-brand-light bg-brand-light/30 shadow-sm"
          key={img.src}
        >
          <Image
            alt={img.alt || "Yatra photo"}
            className="h-auto w-full object-cover"
            height={480}
            sizes="(max-width: 768px) 50vw, 33vw"
            src={img.src}
            width={720}
          />
        </div>
      ))}
    </m.div>
  );
}

function BookingTab({ options }) {
  if (!options?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-4 sm:grid-cols-2 md:gap-6"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {options.map((opt) => {
        const isExternal = opt.href.startsWith("http");
        const className =
          "group flex flex-col rounded-2xl border border-brand-light bg-white p-6 shadow-sm transition-all hover:border-citius-orange/40 hover:shadow-md";
        const inner = (
          <>
            <span className="mb-2 flex items-center gap-2 font-heading text-citius-blue text-lg">
              {opt.label}
              <ExternalLink className="size-4 opacity-0 transition-opacity group-hover:opacity-60" />
            </span>
            {opt.note && <p className="text-brand-muted text-sm leading-relaxed">{opt.note}</p>}
            <span className="mt-4 font-medium text-citius-orange text-sm">Continue →</span>
          </>
        );
        if (isExternal) {
          return (
            <a
              className={className}
              href={opt.href}
              key={opt.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {inner}
            </a>
          );
        }
        return (
          <Link className={className} href={opt.href} key={opt.href}>
            {inner}
          </Link>
        );
      })}
    </m.div>
  );
}

function ReviewsTab({ testimonials }) {
  if (!testimonials?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-6 md:grid-cols-2"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {testimonials.map((t) => (
        <div
          className="rounded-2xl border border-brand-light bg-linear-to-br from-white to-brand-light/40 p-6"
          key={t.id}
        >
          <div className="mb-3 flex gap-1">
            {Array.from({ length: t.rating || 5 }, (_, i) => `${t.id}-star-${i + 1}`).map(
              (starKey) => (
                <Star className="size-4 fill-citius-orange text-citius-orange" key={starKey} />
              )
            )}
          </div>
          <p className="text-brand-dark/90 text-sm italic leading-relaxed">
            &ldquo;{t.quote}&rdquo;
          </p>
          <p className="mt-4 font-heading text-citius-blue text-sm">{t.name}</p>
          <p className="text-brand-muted text-xs">
            {t.location}
            {t.journey ? ` · ${t.journey}` : ""}
          </p>
        </div>
      ))}
    </m.div>
  );
}

function MediaTab({ media }) {
  const embed = media?.videoUrl ? toYoutubeEmbedUrl(media.videoUrl) : null;
  const hasAr = Boolean(media?.arUrl);
  if (!(embed || hasAr)) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {embed && (
        <div>
          <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-blue text-lg">
            <Video className="size-5 text-citius-orange" />
            Trip film
          </h4>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-brand-light bg-brand-dark shadow-lg">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 size-full"
              sandbox="allow-scripts allow-popups allow-presentation"
              src={embed}
              title="Trail video"
            />
          </div>
        </div>
      )}
      {hasAr && (
        <div className="rounded-2xl border border-citius-orange/20 bg-citius-orange/5 p-6">
          <h4 className="mb-2 font-heading text-citius-orange text-lg">AR experience</h4>
          <p className="mb-4 text-brand-muted text-sm">
            Open the immersive view on a compatible device (link opens in a new tab).
          </p>
          <a
            className="inline-flex items-center gap-2 rounded-full bg-citius-orange px-6 py-3 font-heading text-sm text-white tracking-wider transition-all hover:brightness-110"
            href={media.arUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Launch AR
            <ExternalLink className="size-4" />
          </a>
        </div>
      )}
    </m.div>
  );
}

function BlogsTab({ posts }) {
  if (!posts?.length) {
    return null;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      exit={{ opacity: 0, y: -12 }}
      initial={{ opacity: 0, y: 12 }}
    >
      <p className="mb-4 text-brand-muted text-sm">
        Stories and updates from Citius , hand-picked for this journey.
      </p>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              className="flex items-center justify-between gap-4 rounded-xl border border-brand-light bg-white px-5 py-4 transition-all hover:border-citius-blue/30 hover:shadow-sm"
              href={`/blog/${post.slug}`}
            >
              <span className="font-heading text-citius-blue">{post.title}</span>
              <ArrowRight className="size-4 shrink-0 text-citius-orange" />
            </Link>
          </li>
        ))}
      </ul>
    </m.div>
  );
}

function TrailHeader({ trail, title, subtitle, tagline, positioning, isComingSoon }) {
  return (
    <>
      <div className="mb-10 text-center md:mb-16">
        <m.div
          initial={{ opacity: 0, y: 30 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            {isComingSoon && (
              <span className="inline-block rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 font-medium text-amber-900 text-xs uppercase tracking-wider">
                Coming soon
              </span>
            )}
            {tagline && (
              <span className="inline-block rounded-full bg-citius-orange/10 px-3 py-1.5 font-medium text-citius-orange text-xs uppercase tracking-wider">
                {tagline}
              </span>
            )}
          </div>
          <h2 className="mb-3 font-heading text-2xl text-citius-blue leading-tight md:mb-4 md:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="mx-auto max-w-2xl font-sans text-brand-muted text-lg italic leading-relaxed md:text-xl">
            {subtitle}
          </p>
          {positioning && (
            <p className="mx-auto mt-3 max-w-xl font-sans text-brand-muted/80 text-sm md:text-base">
              {positioning}
            </p>
          )}
          <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-citius-orange md:mt-8 md:w-16" />
        </m.div>
      </div>

      {trail.quickFacts && (
        <m.div
          className="mb-10 flex flex-wrap justify-center gap-3 md:mb-14 md:gap-6"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {Object.entries(trail.quickFacts).map(([key, value]) => (
            <div
              className="rounded-xl border border-brand-light bg-white px-4 py-2.5 shadow-sm"
              key={key}
            >
              <span className="block text-[10px] text-brand-muted uppercase tracking-wider md:text-xs">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="font-heading font-medium text-citius-blue text-sm md:text-base">
                {value}
              </span>
            </div>
          ))}
        </m.div>
      )}
    </>
  );
}

function TrailTabs({ activeTab, setActiveTab, flags }) {
  const tabs = [
    { icon: Star, id: "overview", label: "Overview", show: true },
    { icon: Camera, id: "gallery", label: "Gallery", show: flags.hasGallery },
    { icon: Sparkles, id: "highlights", label: "Highlights", show: flags.hasHighlights },
    { icon: MapIcon, id: "itinerary", label: "Itinerary", show: flags.hasItinerary },
    { icon: FileText, id: "details", label: "Package details", show: flags.hasPackageDetails },
    { icon: Info, id: "info", label: "Important Info", show: flags.hasInfo },
    { icon: MessageSquare, id: "booking", label: "Booking", show: flags.hasBooking },
    { icon: Quote, id: "reviews", label: "Reviews", show: flags.hasReviews },
    { icon: Video, id: "media", label: "Video / AR", show: flags.hasMedia },
    { icon: BookOpen, id: "blogs", label: "Blogs", show: flags.hasBlogs },
  ];

  return (
    <div className="mb-8 flex flex-wrap justify-center gap-2 md:mb-12 md:gap-3">
      {tabs.reduce((items, tab) => {
        if (!tab.show) {
          return items;
        }
        items.push(
          <TabButton
            active={activeTab === tab.id}
            icon={tab.icon}
            key={tab.id}
            label={tab.label}
            onClick={() => setActiveTab(tab.id)}
          />
        );
        return items;
      }, [])}
    </div>
  );
}

function OverviewTab({ overview, trail }) {
  if (!overview) {
    return null;
  }

  return (
    <m.div
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 md:space-y-8"
      exit={{ opacity: 0, x: 20 }}
      initial={{ opacity: 0, x: -20 }}
      key="overview"
    >
      <div
        className={cn(
          "grid items-start gap-6 md:gap-12",
          overview.promise?.length ? "lg:grid-cols-5" : "lg:grid-cols-1"
        )}
      >
        <div className={overview.promise?.length ? "lg:col-span-3" : ""}>
          <h3 className="mb-4 font-heading text-citius-blue text-xl md:mb-6 md:text-2xl">
            {overview.title}
          </h3>
          <div className="space-y-3 font-sans text-base text-brand-muted leading-relaxed md:space-y-4 md:text-lg">
            {(overview.intro || []).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {overview.privateGroupNote && (
              <div className="my-4 rounded-2xl border border-citius-blue/15 bg-citius-blue/5 p-5 md:my-6 md:p-6">
                <p className="text-brand-dark text-sm leading-relaxed md:text-base">
                  {overview.privateGroupNote}
                </p>
              </div>
            )}
            {overview.quote && (
              <blockquote className="relative my-6 border-citius-orange border-l-2 bg-brand-light/30 p-4 text-lg italic md:my-8 md:p-6 md:text-xl">
                <span className="absolute -top-3 -left-1 font-serif text-4xl text-citius-orange/20 md:text-5xl">
                  &ldquo;
                </span>
                {overview.quote}
              </blockquote>
            )}
          </div>
          <DeparturesBlock departures={trail.departures} />
        </div>

        {overview.promise?.length > 0 && (
          <div className="rounded-2xl bg-brand-dark p-6 text-white shadow-xl md:p-8 lg:col-span-2">
            <h4 className="mb-4 flex items-center gap-2 font-heading text-citius-orange text-lg md:mb-6 md:text-xl">
              <Users className="size-5" />
              The Citius Promise
            </h4>
            <ul className="space-y-3 md:space-y-4">
              {overview.promise.map((item) => (
                <li className="group flex items-start gap-3" key={item}>
                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-citius-orange/20">
                    <CheckCircle className="size-3 text-citius-orange" />
                  </div>
                  <span className="font-sans text-sm text-white/80 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            {overview.closing && (
              <div className="mt-6 border-white/10 border-t pt-6 text-center md:mt-8">
                <p className="whitespace-pre-line font-sans text-citius-orange text-lg italic md:text-xl">
                  {overview.closing}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <RegistrationAndPolicySection policy={trail.registrationAndPolicy} />
    </m.div>
  );
}

function TrailTabContent({ activeTab, trail, relatedBlogPosts, flags, reviewsList }) {
  const {
    overview,
    highlights,
    itinerary,
    details,
    info,
    layoutVariant = "trek",
    gallery = [],
    bookingOptions = [],
    media,
  } = trail;

  return (
    <div className="relative min-h-[400px] overflow-hidden rounded-2xl border border-brand-light bg-white p-5 shadow-brand-dark/5 shadow-xl md:rounded-3xl md:p-10 lg:p-14">
      <div className="pointer-events-none absolute top-0 right-0 h-48 w-48 translate-x-1/2 -translate-y-1/2 rounded-full bg-citius-orange/5 blur-3xl md:h-64 md:w-64" />

      <AnimatePresence mode="wait">
        {activeTab === "overview" && <OverviewTab overview={overview} trail={trail} />}
        {activeTab === "highlights" && highlights && <HighlightsTab highlights={highlights} />}
        {activeTab === "itinerary" && itinerary && (
          <ItineraryTab
            itinerary={itinerary}
            itineraryTimelineImage={trail.itineraryTimelineImage}
          />
        )}
        {activeTab === "details" && details && <PackageDetailsTab trail={trail} />}
        {activeTab === "info" && info && <InfoTab info={info} layoutVariant={layoutVariant} />}
        {activeTab === "gallery" && flags.hasGallery && <GalleryTab gallery={gallery} />}
        {activeTab === "booking" && flags.hasBooking && <BookingTab options={bookingOptions} />}
        {activeTab === "reviews" && flags.hasReviews && <ReviewsTab testimonials={reviewsList} />}
        {activeTab === "media" && flags.hasMedia && <MediaTab media={media} />}
        {activeTab === "blogs" && flags.hasBlogs && <BlogsTab posts={relatedBlogPosts} />}
      </AnimatePresence>
    </div>
  );
}

function TrailCta({ isAerial }) {
  return (
    <m.div
      className="mt-12 text-center md:mt-16"
      initial={{ opacity: 0, y: 30 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-dark to-citius-blue p-6 shadow-2xl md:rounded-3xl md:p-10">
        <div className="absolute -top-20 -right-20 size-40 rounded-full bg-citius-orange/10 blur-2xl transition-transform duration-1000 group-hover:scale-150" />
        <div className="absolute -bottom-20 -left-20 size-40 rounded-full bg-citius-blue/20 blur-2xl transition-transform duration-1000 group-hover:scale-150" />

        <div className="relative z-10">
          <h3 className="mb-3 font-heading text-2xl text-white italic md:text-3xl">
            Ready for <span className="text-citius-orange">Transformation?</span>
          </h3>
          <p className="mx-auto mb-6 max-w-xl font-sans text-base text-white/60 md:text-lg">
            {isAerial
              ? "Limited seats per charter. Book early for preferred dates."
              : "Multiple departure batches June–September 2026. Early registration recommended."}
          </p>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-citius-orange px-8 py-3.5 font-heading text-sm text-white tracking-wider shadow-citius-orange/20 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-citius-orange/40 hover:brightness-110 active:translate-y-0 md:px-10 md:py-4"
            href="/contact"
          >
            Request Detailed Brochure
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </m.div>
  );
}

export default function TrailSection({
  trail,
  className,
  isAlternate,
  relatedBlogPosts = EMPTY_RELATED_BLOG_POSTS,
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!trail) {
    return null;
  }

  const {
    title,
    subtitle,
    tagline,
    positioning,
    highlights,
    itinerary,
    details,
    info,
    layoutVariant = "trek",
    status,
    gallery = [],
    bookingOptions = [],
    media,
  } = trail;
  const isAerial = layoutVariant === "aerial";
  const isComingSoon = status === "comingSoon";
  const reviewsList =
    trail.testimonials?.length > 0 ? trail.testimonials : getTrailTestimonials(trail);
  const flags = {
    hasBlogs: relatedBlogPosts.length > 0,
    hasBooking: bookingOptions.length > 0,
    hasGallery: gallery.length > 0,
    hasHighlights: highlights && highlights.length > 0,
    hasInfo: Boolean(info),
    hasItinerary: itinerary && itinerary.length > 0,
    hasMedia:
      Boolean(media?.videoUrl && toYoutubeEmbedUrl(media.videoUrl)) || Boolean(media?.arUrl),
    hasPackageDetails: Boolean(details),
    hasReviews: reviewsList.length > 0,
  };
  const legacySectionId = isAerial ? "package-aerial" : "package-14day";

  return (
    <section
      className={cn(
        embedded
          ? "scroll-mt-20 bg-white py-6 md:py-12"
          : cn("scroll-mt-20 py-16 md:py-32", isAlternate ? "bg-[#f8f5f2]" : "bg-white"),
        className
      )}
      id={trail.slug ? `trail-${trail.slug}` : legacySectionId}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {!embedded && (
          <TrailHeader
            isComingSoon={isComingSoon}
            positioning={positioning}
            subtitle={subtitle}
            tagline={tagline}
            title={title}
            trail={trail}
          />
        )}

        {embedded && isComingSoon && (
          <p className="mx-auto mb-8 max-w-xl rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-center text-amber-800 text-sm">
            This programme is not yet open for booking , explore the overview and register your
            interest below.
          </p>
        )}

        <TrailTabs activeTab={activeTab} flags={flags} setActiveTab={setActiveTab} />
        <TrailTabContent
          activeTab={activeTab}
          flags={flags}
          relatedBlogPosts={relatedBlogPosts}
          reviewsList={reviewsList}
          trail={trail}
        />
        <TrailCta isAerial={isAerial} />
      </div>
    </section>
  );
}
