"use client";

import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Compass,
  Plane,
  UsersRound,
  XCircle,
} from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Field, Input } from "@/components/ui/application-field";
import { Status } from "@/components/ui/application-status";
import { Switch } from "@/components/ui/application-switch";
import { formatCount } from "@/lib/countMessage";
import Logo from "@/static/logos/logo.webp";
import { isRuntimeObject, isRuntimeString } from "../../lib/runtimeValues";
import {
  formatAccountDateRange,
  getDepartureLabel,
  getTripDestination,
  getTripNights,
} from "./accountPresentation";

export const ACCOUNT_CONTAINER_VARIANTS = {
  // Keep the first paint visible even if Motion is deferred by the server
  // boundary or a reduced-motion preference. The account must never look
  // empty while hydration is settling.
  hidden: { opacity: 1, y: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.05, staggerChildren: 0.06 },
    y: 0,
  },
};

export const ACCOUNT_ITEM_VARIANTS = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 }, y: 0 },
};

const ACCOUNT_INK = "var(--account-ink)";
const ACCOUNT_NIGHT = "var(--account-night)";
const ACCOUNT_GOLD = "var(--account-gold)";
const ITINERARY_FLIGHT_RE = /flight|airport|arrival|departure/i;

function getEntryLocation(entry) {
  if (isRuntimeString(entry.location)) {
    return entry.location;
  }
  if (isRuntimeString(entry.destination)) {
    return entry.destination;
  }
  return "";
}

export function AccountMark({ compact = false }) {
  return (
    <Link
      aria-label="Back to Citius Holidays home"
      className={`account-focus inline-flex min-h-11 items-center rounded-sm transition-opacity hover:opacity-80 ${compact ? "p-1" : "py-1"}`}
      href="/"
    >
      <Image
        alt="Citius Holidays"
        className="object-contain"
        src={Logo}
        style={{ height: "auto", width: compact ? 80 : 120 }}
      />
    </Link>
  );
}

export function NavButton({ active, onClick, icon, label, mobile = false, header = false }) {
  let className = `min-h-11 min-w-16 flex-1 flex-col justify-center gap-1 px-3 py-2 text-xs ${
    active ? "text-[var(--account-gold-on-night)]" : "text-white/55"
  }`;
  if (header) {
    className = `relative min-w-28 justify-center gap-2 px-5 text-sm ${
      active
        ? "text-[var(--account-ink)] after:absolute after:inset-x-5 after:bottom-0 after:h-0.5 after:bg-[var(--account-gold)]"
        : "text-[var(--account-muted)] hover:text-[var(--account-ink)]"
    }`;
  } else if (!mobile) {
    className = `w-full gap-3 rounded-sm px-3 py-3 text-left text-xs tracking-[0.04em] ${
      active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/7 hover:text-white"
    }`;
  }

  return (
    <Button
      aria-current={active ? "page" : undefined}
      className={`flex items-center transition-colors ${className}`}
      onClick={onClick}
      surface="account"
      type="button"
    >
      <span
        className={
          active && !header ? "text-[var(--account-gold-on-night)]" : "text-[var(--account-gold)]"
        }
      >
        {icon}
      </span>
      <span>{label}</span>
      {!(mobile || header) && active && (
        <span className="ml-auto size-1.5 rounded-full bg-[var(--account-gold-on-night)]" />
      )}
    </Button>
  );
}

function StatusPill({ status }) {
  const normalized = status === "confirmed" ? "Confirmed" : status || "Pending";
  const isConfirmed = normalized === "Confirmed";
  return (
    <Status surface="account" tone={isConfirmed ? "success" : "neutral"}>
      {normalized}
    </Status>
  );
}

export function normalizeItinerary(itinerary) {
  if (!Array.isArray(itinerary)) {
    return [];
  }
  const normalized = [];
  for (const [index, entry] of itinerary.entries()) {
    if (!(entry && isRuntimeObject(entry))) {
      continue;
    }
    normalized.push({
      accommodation: isRuntimeString(entry.accommodation) ? entry.accommodation : "",
      day: isRuntimeString(entry.day) ? entry.day : `Day ${index + 1}`,
      desc: isRuntimeString(entry.desc) ? entry.desc : "",
      key: `${isRuntimeString(entry.day) ? entry.day : `day-${index + 1}`}-${isRuntimeString(entry.title) ? entry.title : "highlight"}`,
      location: getEntryLocation(entry),
      meals: isRuntimeString(entry.meals) ? entry.meals : "",
      title: isRuntimeString(entry.title) ? entry.title : "Journey highlight",
    });
  }
  return normalized;
}

function getItineraryIcon(entry) {
  if (entry.accommodation) {
    return BedDouble;
  }
  if (ITINERARY_FLIGHT_RE.test(`${entry.title} ${entry.desc}`)) {
    return Plane;
  }
  return Compass;
}

function getJourneyAccessLabel(entitlement) {
  if (entitlement?.role === "organizer") {
    return "Organizer access";
  }
  if (entitlement?.role === "traveller") {
    return "Traveller access";
  }
  return "Booked by you";
}

function normalizeGalleryImage(image, tripName) {
  if (isRuntimeString(image) && image.trim()) {
    return { alt: `${tripName || "Journey"} highlight`, src: image.trim() };
  }
  if (image && isRuntimeObject(image) && isRuntimeString(image.src) && image.src.trim()) {
    return {
      alt:
        isRuntimeString(image.alt) && image.alt.trim()
          ? image.alt.trim()
          : `${tripName || "Journey"} highlight`,
      src: image.src.trim(),
    };
  }
  return null;
}

export function getJourneyImages(trip) {
  const images = [];
  if (isRuntimeString(trip?.coverImage) && trip.coverImage.trim()) {
    images.push({ alt: trip.name || "Journey", src: trip.coverImage.trim() });
  }
  if (Array.isArray(trip?.gallery)) {
    for (const image of trip.gallery) {
      const normalized = normalizeGalleryImage(image, trip?.name);
      if (normalized && !images.some((candidate) => candidate.src === normalized.src)) {
        images.push(normalized);
      }
    }
  }
  return images;
}

export function CoverImage({ trip, image, className = "", sizes = "100vw", eager = false }) {
  const source = image ?? getJourneyImages(trip)[0];
  return source?.src ? (
    <Image
      alt={source.alt || trip?.name || "Journey"}
      className={`object-cover ${className}`}
      fill
      loading={eager ? "eager" : undefined}
      sizes={sizes}
      src={source.src}
    />
  ) : (
    <div
      className={`flex size-full items-center justify-center bg-[var(--account-night)] ${className}`}
    >
      <Compass className="text-[var(--account-gold)]" size={28} strokeWidth={1.3} />
    </div>
  );
}

export function JourneyOverviewCard({ booking, journeyKey, onOpen }) {
  const { trip, booking: bookingData } = booking;
  const destination = getTripDestination(trip);
  const nights = getTripNights(trip);
  const itinerary = normalizeItinerary(trip?.itinerary).slice(0, 4);

  return (
    <m.article
      className="grid gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]"
      variants={ACCOUNT_ITEM_VARIANTS}
    >
      <div className="group relative min-h-[360px] overflow-hidden rounded-2xl bg-[var(--account-night)] sm:min-h-[430px] lg:min-h-[500px]">
        <CoverImage
          className="transition-transform duration-200 fine-hover:group-hover:scale-[1.025]"
          eager
          sizes="(max-width: 1024px) 100vw, 58vw"
          trip={trip}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--account-night)_92%,transparent)] via-[color-mix(in_srgb,var(--account-night)_18%,transparent)] to-black/10" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5 sm:p-7">
          <span className="material-decorative-glass inline-flex items-center gap-2 rounded-full bg-[var(--account-surface)]/95 px-3 py-2 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.13em] shadow-sm backdrop-blur">
            <Plane size={14} /> {getDepartureLabel(trip.startDate)}
          </span>
          <StatusPill status={bookingData.status} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
          <p className="text-sm text-white/72">{destination}</p>
          <h2 className="account-display mt-2 max-w-2xl text-3xl leading-tight sm:text-5xl">
            {trip.name}
          </h2>
          <p className="mt-3 text-sm text-white/78">
            {formatAccountDateRange(trip.startDate, trip.endDate)}
            {nights ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
          </p>
          <Button
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--account-night)] px-5 font-semibold text-sm text-white shadow-lg transition-colors hover:bg-[var(--account-ink)]"
            data-account-journey-key={journeyKey}
            onClick={onOpen}
            surface="account"
            type="button"
          >
            View itinerary <ChevronRight size={17} />
          </Button>
        </div>
      </div>

      <aside className="account-card flex flex-col rounded-2xl p-6 sm:p-8">
        <div>
          <p className="font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.16em]">
            Your route
          </p>
          <h3 className="account-display mt-2 text-2xl text-[var(--account-ink)]">
            Itinerary preview
          </h3>
          <p className="mt-2 text-[var(--account-muted)] text-xs">
            {getJourneyAccessLabel(booking.entitlement)}
          </p>
        </div>

        {itinerary.length ? (
          <ol className="mt-7 flex-1 space-y-0">
            {itinerary.map((entry, index) => {
              const EntryIcon = getItineraryIcon(entry);
              return (
                <li
                  className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0"
                  key={entry.key}
                >
                  {index < itinerary.length - 1 ? (
                    <span className="absolute top-8 bottom-0 left-[0.95rem] w-px bg-[var(--account-border)]" />
                  ) : null}
                  <span className="relative z-10 flex size-8 items-center justify-center rounded-full border border-[var(--account-gold)] bg-[var(--account-surface)] text-[var(--account-gold)]">
                    <EntryIcon size={14} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.12em]">
                      {entry.day}
                    </p>
                    <p className="mt-1 font-medium text-[var(--account-ink)] text-sm">
                      {entry.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[var(--account-muted)] text-xs leading-5">
                      {entry.desc || entry.accommodation || entry.location || "Details to follow"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="my-8 flex flex-1 items-center border-[var(--account-border)] border-y py-6">
            <p className="text-[var(--account-muted)] text-sm leading-6">
              Your Citius travel desk is preparing the day-by-day route. Confirmed details will
              appear here.
            </p>
          </div>
        )}

        <dl className="mt-7 grid grid-cols-2 gap-4 border-[var(--account-border)] border-t pt-5 text-sm">
          <div>
            <dt className="flex items-center gap-2 text-[var(--account-muted)] text-xs">
              <UsersRound size={14} /> Travellers
            </dt>
            <dd className="mt-1.5 font-medium text-[var(--account-ink)]">
              {bookingData.travelers} traveler{bookingData.travelers === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-[var(--account-muted)] text-xs">
              <CalendarDays size={14} /> Dates
            </dt>
            <dd className="mt-1.5 font-medium text-[var(--account-ink)]">
              {formatAccountDateRange(trip.startDate, trip.endDate)}
            </dd>
          </div>
        </dl>
      </aside>
    </m.article>
  );
}

export function ItinerarySnapshot({ trip }) {
  const entries = normalizeItinerary(trip?.itinerary).slice(0, 4);

  const getEntryIcon = (entry) => {
    if (entry.accommodation) {
      return <BedDouble aria-hidden="true" size={15} strokeWidth={1.6} />;
    }
    if (ITINERARY_FLIGHT_RE.test(`${entry.title} ${entry.desc}`)) {
      return <Plane aria-hidden="true" size={15} strokeWidth={1.6} />;
    }
    return <Compass aria-hidden="true" size={15} strokeWidth={1.6} />;
  };

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.2em]">
            Daily highlights
          </p>
          <h3 className="account-display text-3xl text-[var(--account-ink)]">Itinerary snapshot</h3>
        </div>
        <span className="text-[var(--account-muted)] text-xs">
          {entries.length ? `${entries.length} highlights` : "Being prepared"}
        </span>
      </div>
      {entries.length ? (
        <div className="account-card rounded-sm p-5 sm:p-6">
          <ol className="account-timeline">
            {entries.map((entry) => (
              <li className="account-timeline-item" key={entry.key}>
                <span className="account-timeline-marker flex size-8 items-center justify-center rounded-full border border-[var(--account-gold)] bg-[var(--account-surface)] text-[var(--account-gold)]">
                  {getEntryIcon(entry)}
                </span>
                <div className="min-w-0 pt-1 md:pt-3">
                  <p className="font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.13em]">
                    {entry.day}
                  </p>
                  <p className="mt-1 font-medium text-[var(--account-ink)]">{entry.title}</p>
                  <p className="mt-1 text-[var(--account-muted)] text-sm leading-6">
                    {entry.desc || entry.accommodation || "Details will be shared shortly."}
                  </p>
                  {!!(entry.location || entry.accommodation || entry.meals) && (
                    <p className="mt-2 text-[var(--account-muted)] text-xs">
                      {[entry.location, entry.accommodation, entry.meals]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <EmptyInfoCard
          icon={<Compass size={21} />}
          text="Confirmed day-by-day details will appear here."
          title="Your itinerary is taking shape"
        />
      )}
    </section>
  );
}

export function TravelInfoCard({ icon, eyebrow, title, children }) {
  return (
    <article className="account-card overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 border-[var(--account-border)] border-b px-5 py-4 sm:px-6">
        <span className="text-[var(--account-gold)]">{icon}</span>
        <div>
          <p className="text-[10px] text-[var(--account-muted)] uppercase tracking-[0.14em]">
            {eyebrow}
          </p>
          <h3 className="account-display mt-0.5 text-[var(--account-ink)] text-xl">{title}</h3>
        </div>
      </div>
      <div className="text-[var(--account-muted)] text-sm leading-6">{children}</div>
    </article>
  );
}

export function TravelInfoPlaceholder({ kind, trip }) {
  const isFlight = kind === "flight";
  const itinerary = normalizeItinerary(trip?.itinerary);
  const matchingEntries = itinerary
    .filter((entry) =>
      isFlight
        ? ITINERARY_FLIGHT_RE.test(`${entry.title} ${entry.desc}`)
        : Boolean(entry.accommodation)
    )
    .slice(0, 2);
  const journeyImages = getJourneyImages(trip).slice(1);

  if (matchingEntries.length) {
    return (
      <div className="divide-y divide-[var(--account-border)]">
        {matchingEntries.map((entry, index) => {
          const image = isFlight ? null : journeyImages[index];
          return (
            <div
              className={`grid gap-4 p-4 sm:p-5 ${image ? "grid-cols-[7rem_minmax(0,1fr)]" : "grid-cols-[5rem_minmax(0,1fr)]"}`}
              key={entry.key}
            >
              {image ? (
                <div className="relative min-h-20 overflow-hidden rounded-xl bg-[var(--account-night)]">
                  <CoverImage image={image} sizes="112px" trip={trip} />
                </div>
              ) : (
                <div className="border-[var(--account-border)] border-r pr-4">
                  <p className="font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.12em]">
                    {entry.day}
                  </p>
                  <span className="mt-3 flex size-8 items-center justify-center rounded-full bg-[var(--account-gold-soft)] text-[var(--account-gold)]">
                    <Plane size={15} />
                  </span>
                </div>
              )}
              <div className="min-w-0 self-center">
                {image ? (
                  <p className="font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.12em]">
                    {entry.day}
                  </p>
                ) : null}
                <p className="mt-1 font-medium text-[var(--account-ink)]">
                  {isFlight ? entry.title : entry.accommodation || entry.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[var(--account-muted)] text-xs">
                  {entry.location || entry.desc || "Confirmed details will appear here."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const rows = isFlight
    ? [
        ["Departure", "To be confirmed"],
        ["Arrival", "To be confirmed"],
        ["PNR", "Added after ticketing"],
      ]
    : [
        ["Property", "To be confirmed"],
        ["Check-in", "Added with stay details"],
        ["Room", "Added after confirmation"],
      ];

  return (
    <div>
      <dl className="divide-y divide-[var(--account-border)]">
        {rows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={label}>
            <dt className="font-medium text-[var(--account-ink)] text-xs">{label}</dt>
            <dd className="text-right text-[var(--account-muted)] text-xs">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-[var(--account-border)] border-t px-4 py-3 text-[var(--account-muted)] text-xs leading-5">
        {isFlight
          ? "Flight and PNR details will appear here after the travel desk confirms your tickets."
          : "Room and check-in details will appear here once your stays are confirmed."}
      </p>
    </div>
  );
}

export function EmptyInfoCard({ icon, title, text }) {
  return (
    <div className="account-card rounded-sm border-dashed p-8 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--account-gold-soft)] text-[var(--account-gold)]">
        {icon}
      </div>
      <h3 className="account-display mt-4 text-2xl text-[var(--account-ink)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[var(--account-muted)] text-sm leading-6">{text}</p>
    </div>
  );
}

export function PastJourneyCard({ booking, journeyKey, onOpen }) {
  const { trip } = booking;
  const nights = getTripNights(trip);
  const content = (
    <>
      <CoverImage
        className="transition-transform duration-200 fine-hover:group-hover:scale-[1.035]"
        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
        trip={trip}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--account-night)_92%,transparent)] via-[color-mix(in_srgb,var(--account-night)_14%,transparent)] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-left text-white">
        <div className="min-w-0">
          <p className="account-display truncate text-xl sm:text-2xl">{trip.name}</p>
          <p className="mt-1 text-white/75 text-xs">
            {formatAccountDateRange(trip.startDate, trip.endDate)}
            {nights ? ` · ${formatCount(nights, "night")}` : ""}
          </p>
          <p className="mt-1 truncate text-white/62 text-xs">{getTripDestination(trip)}</p>
        </div>
        <span className="material-decorative-glass flex size-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition-colors group-hover:bg-white group-hover:text-[var(--account-night)]">
          <ChevronRight size={18} />
        </span>
      </div>
    </>
  );

  const className =
    "account-focus group relative block aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[var(--account-night)] text-left shadow-sm";

  if (onOpen) {
    return (
      <Button
        aria-label={`Open itinerary for ${trip.name}`}
        className={`min-h-0 ${className}`}
        data-account-journey-key={journeyKey}
        onClick={onOpen}
        surface="account"
        type="button"
      >
        {content}
      </Button>
    );
  }

  return (
    <Link aria-label={`View ${trip.name}`} className={className} href={`/services/${trip.slug}`}>
      {content}
    </Link>
  );
}

export function BookingCard({ booking }) {
  return <PastJourneyCard booking={booking} />;
}

export function ProfileAlert({ type = "success", message }) {
  const isSuccess = type === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={`mt-4 flex items-center gap-3 rounded-sm border px-4 py-3 text-sm ${isSuccess ? "border-[#c7ddcf] bg-[#eff7f1] text-[#2d6349]" : "border-[#e7c8c3] bg-[#fff2f0] text-[#9b3d32]"}`}
      role={isSuccess ? "status" : "alert"}
    >
      <Icon size={18} />
      <span className="font-medium">{message}</span>
    </div>
  );
}

export function ProfileInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}) {
  const fieldId = useId();
  const handleChange = (event) => onChange?.(event.target.value);
  return (
    <Field label={label} surface="account">
      <Input
        className={disabled ? undefined : "bg-white"}
        disabled={disabled}
        id={fieldId}
        onChange={handleChange}
        placeholder={placeholder}
        surface="account"
        type={type}
        value={value ?? ""}
      />
    </Field>
  );
}

export function ProfileField({ label, value }) {
  return (
    <div>
      <p className="mb-1 block font-semibold text-[var(--account-muted)] text-xs uppercase tracking-[0.1em]">
        {label}
      </p>
      <div className="border-[var(--account-border)] border-b pb-2 font-medium text-[var(--account-ink)]">
        {value || "—"}
      </div>
    </div>
  );
}

export function SettingRow({ title, description, action }) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 p-6 transition-colors hover:bg-[var(--account-paper)] sm:flex-row sm:items-center">
      <div>
        <h4 className="font-medium text-[var(--account-ink)]">{title}</h4>
        <p className="mt-1 text-[var(--account-muted)] text-sm leading-5">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

export function Toggle({ disabled = false, label = "Account notifications" }) {
  const [isOn, setIsOn] = useState(true);
  return (
    <Switch
      aria-label={`${label}: ${isOn ? "On" : "Off"}${disabled ? ". Planned" : ""}`}
      checked={isOn}
      className="account-focus relative h-6 w-11 rounded-full bg-[var(--account-border)] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] before:absolute before:-inset-y-2.5 before:content-[''] data-[disabled]:cursor-not-allowed data-[checked]:bg-[var(--account-night)] data-[disabled]:opacity-60 motion-reduce:transition-none"
      disabled={disabled}
      onCheckedChange={setIsOn}
      surface="account"
      thumbClassName="absolute top-1 left-1 duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
    />
  );
}

export function AccountHero({ user }) {
  return (
    <header className="mb-8 flex flex-col gap-2 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div>
        <h1 className="account-display text-3xl text-[var(--account-ink)] leading-tight sm:text-4xl">
          Good to see you, {user.name?.split(" ")[0] || "traveller"}.
        </h1>
      </div>
      <p className="max-w-md text-[var(--account-muted)] text-sm leading-6 sm:text-right">
        Upcoming and past trips, plus itinerary, flights, and stays.
      </p>
    </header>
  );
}

export { ACCOUNT_GOLD, ACCOUNT_INK, ACCOUNT_NIGHT };
