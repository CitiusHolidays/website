"use client";

import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  Plane,
  UsersRound,
  XCircle,
} from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useId, useState } from "react";
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
  if (typeof entry.location === "string") {
    return entry.location;
  }
  if (typeof entry.destination === "string") {
    return entry.destination;
  }
  return "";
}

export function AccountMark({ compact = false, inverse = false }) {
  return (
    <div className="flex flex-col items-start gap-0">
      <div className="flex items-center gap-2">
        <Plane
          aria-hidden="true"
          className="text-[var(--account-gold)]"
          size={compact ? 14 : 17}
          strokeWidth={1.5}
        />
        <span
          className={`account-display text-xl tracking-[0.18em] ${inverse ? "text-white" : "text-[var(--account-ink)]"}`}
        >
          CITIUS
        </span>
      </div>
      <span
        className={`font-medium text-[9px] uppercase tracking-[0.35em] ${compact ? "ml-6" : ""} ${inverse ? "text-[var(--account-gold)]" : "text-[var(--account-muted)]"}`}
      >
        Holidays
      </span>
    </div>
  );
}

export function NavButton({ active, onClick, icon, label, mobile = false }) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`account-focus flex items-center transition-colors ${
        mobile
          ? `min-w-16 flex-1 flex-col justify-center gap-1 px-3 py-2 text-[10px] ${active ? "text-[var(--account-gold)]" : "text-white/55"}`
          : `w-full gap-3 rounded-sm px-3 py-3 text-left text-xs tracking-[0.04em] ${active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/7 hover:text-white"}`
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={active ? "text-[var(--account-gold)]" : ""}>{icon}</span>
      <span>{label}</span>
      {!mobile && active && (
        <span className="ml-auto size-1.5 rounded-full bg-[var(--account-gold)]" />
      )}
    </button>
  );
}

function StatusPill({ status }) {
  const normalized = status === "confirmed" ? "Confirmed" : status || "Pending";
  const isConfirmed = normalized === "Confirmed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-[10px] uppercase tracking-[0.13em] ${
        isConfirmed
          ? "bg-[#e9f1ea] text-[var(--account-success)]"
          : "bg-[var(--account-gold-soft)] text-[var(--account-gold)]"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${isConfirmed ? "bg-[var(--account-success)]" : "bg-[var(--account-gold)]"}`}
      />
      {normalized}
    </span>
  );
}

export function normalizeItinerary(itinerary) {
  if (!Array.isArray(itinerary)) {
    return [];
  }
  return itinerary
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      accommodation: typeof entry.accommodation === "string" ? entry.accommodation : "",
      day: typeof entry.day === "string" ? entry.day : `Day ${index + 1}`,
      desc: typeof entry.desc === "string" ? entry.desc : "",
      key: `${typeof entry.day === "string" ? entry.day : `day-${index + 1}`}-${typeof entry.title === "string" ? entry.title : "highlight"}`,
      location: getEntryLocation(entry),
      meals: typeof entry.meals === "string" ? entry.meals : "",
      title: typeof entry.title === "string" ? entry.title : "Journey highlight",
    }));
}

function CoverImage({ trip, className = "" }) {
  return trip?.coverImage ? (
    <Image
      alt={trip.name || "Journey"}
      className={`object-cover ${className}`}
      fill
      sizes="(max-width: 1024px) 100vw, 38vw"
      src={trip.coverImage}
    />
  ) : (
    <div
      className={`flex size-full items-center justify-center bg-[var(--account-night)] ${className}`}
    >
      <Compass className="text-[var(--account-gold)]" size={28} strokeWidth={1.3} />
    </div>
  );
}

export function JourneyOverviewCard({ booking, onOpen }) {
  const { trip, booking: bookingData } = booking;
  const destination = getTripDestination(trip);
  const nights = getTripNights(trip);
  return (
    <m.article
      className="account-card group grid overflow-hidden rounded-sm lg:grid-cols-[minmax(220px,0.82fr)_1.3fr_minmax(180px,0.68fr)]"
      variants={ACCOUNT_ITEM_VARIANTS}
    >
      <div className="relative min-h-56 overflow-hidden bg-[var(--account-night)] lg:min-h-72">
        <CoverImage
          className="transition-transform duration-700 fine-hover:group-hover:scale-[1.03]"
          trip={trip}
        />
      </div>
      <div className="flex flex-col justify-between p-6 sm:p-8">
        <div>
          <p className="mb-3 flex items-center gap-2 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.16em]">
            <Plane size={14} />
            {getDepartureLabel(trip.startDate)}
          </p>
          <h2 className="account-display text-3xl text-[var(--account-ink)] leading-tight sm:text-4xl">
            {trip.name}
          </h2>
          <p className="mt-2 text-[var(--account-muted)] text-sm">{destination}</p>
          <div className="mt-6 grid gap-3 text-[var(--account-muted)] text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-[var(--account-gold)]" size={16} />
              {formatAccountDateRange(trip.startDate, trip.endDate)}
            </div>
            <div className="flex items-center gap-2">
              <UsersRound className="text-[var(--account-gold)]" size={16} />
              {bookingData.travelers} traveler{bookingData.travelers === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="text-[var(--account-gold)]" size={16} />
              {nights ? `${nights} night${nights === 1 ? "" : "s"}` : "Nights to follow"}
            </div>
          </div>
          <p className="mt-5 max-w-xl text-[var(--account-muted)] text-sm leading-6">
            Your Citius travel desk is preparing the details for this journey. We&apos;ll keep the
            latest itinerary and stay information here as it is confirmed.
          </p>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-[var(--account-border)] border-t pt-5">
          <StatusPill status={bookingData.status} />
          <button
            className="account-focus inline-flex items-center gap-2 font-semibold text-[var(--account-ink)] text-xs uppercase tracking-[0.12em] hover:text-[var(--account-gold)]"
            onClick={onOpen}
            type="button"
          >
            Open itinerary <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <aside className="border-[var(--account-border)] border-t p-6 lg:border-t-0 lg:border-l">
        <p className="mb-4 font-semibold text-[10px] text-[var(--account-muted)] uppercase tracking-[0.15em]">
          Journey summary
        </p>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-[var(--account-muted)] text-xs">Destination</dt>
            <dd className="mt-1 font-medium text-[var(--account-ink)]">{destination}</dd>
          </div>
          <div>
            <dt className="text-[var(--account-muted)] text-xs">Travellers</dt>
            <dd className="mt-1 font-medium text-[var(--account-ink)]">
              {bookingData.travelers} traveler{bookingData.travelers === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--account-muted)] text-xs">Dates</dt>
            <dd className="mt-1 font-medium text-[var(--account-ink)]">
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
            A considered pace
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
    <article className="account-card rounded-sm p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--account-gold-soft)] text-[var(--account-gold)]">
            {icon}
          </span>
          <div>
            <p className="font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.17em]">
              {eyebrow}
            </p>
            <h3 className="account-display mt-1 text-2xl text-[var(--account-ink)]">{title}</h3>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--account-gold-soft)] px-2.5 py-1 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.1em]">
          Planned
        </span>
      </div>
      <div className="mt-5 text-[var(--account-muted)] text-sm leading-6">{children}</div>
    </article>
  );
}

export function TravelInfoPlaceholder({ kind }) {
  const isFlight = kind === "flight";
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
    <div className="space-y-4">
      <dl className="divide-y divide-[var(--account-border)] rounded-sm border border-[var(--account-border)] bg-[var(--account-paper)]">
        {rows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={label}>
            <dt className="font-medium text-[var(--account-ink)] text-xs">{label}</dt>
            <dd className="text-right text-[var(--account-muted)] text-xs">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[var(--account-muted)] text-xs leading-5">
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

export function PastJourneyCard({ booking, bookingId, onOpen }) {
  const { trip, booking: bookingData } = booking;
  const content = (
    <>
      <div className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-[var(--account-night)] sm:size-24">
        <CoverImage trip={trip} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="account-display truncate text-[var(--account-ink)] text-xl">{trip.name}</p>
        <p className="mt-1 text-[var(--account-muted)] text-xs">
          {formatAccountDateRange(trip.startDate, trip.endDate)} · {bookingData.travelers} traveler
          {bookingData.travelers === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-[var(--account-muted)] text-xs">{getTripDestination(trip)}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 font-semibold text-[var(--account-ink)] text-xs uppercase tracking-[0.1em]">
        {onOpen ? "View itinerary" : "View summary"}
        <ChevronRight className="text-[var(--account-gold)]" size={18} />
      </span>
    </>
  );

  if (onOpen) {
    return (
      <button
        className="account-focus account-card group flex w-full items-center gap-4 rounded-sm p-3 text-left transition-transform fine-hover:hover:-translate-y-0.5 sm:gap-5 sm:p-4"
        data-booking-id={bookingId}
        onClick={onOpen}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      className="account-focus account-card group flex items-center gap-4 rounded-sm p-3 transition-transform fine-hover:hover:-translate-y-0.5 sm:gap-5 sm:p-4"
      href={`/services/${trip.slug}`}
    >
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
  const handleChange = useCallback((event) => onChange?.(event.target.value), [onChange]);
  return (
    <div>
      <label
        className="mb-1 block font-semibold text-[10px] text-[var(--account-muted)] uppercase tracking-[0.14em]"
        htmlFor={fieldId}
      >
        {label}
      </label>
      <input
        className={`account-focus w-full rounded-sm border border-[var(--account-border)] px-4 py-3 text-[var(--account-ink)] shadow-sm transition focus:border-[var(--account-gold)] focus:outline-none ${disabled ? "cursor-not-allowed bg-[#f4f1eb] text-[var(--account-muted)]" : "bg-white"}`}
        disabled={disabled}
        id={fieldId}
        onChange={handleChange}
        placeholder={placeholder}
        type={type}
        value={value ?? ""}
      />
    </div>
  );
}

export function ProfileField({ label, value }) {
  return (
    <div>
      <p className="mb-1 block font-semibold text-[10px] text-[var(--account-muted)] uppercase tracking-[0.14em]">
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
    <div className="flex flex-col items-start justify-between gap-4 p-6 transition-colors hover:bg-[#fcfaf6] sm:flex-row sm:items-center">
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
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOn((value) => !value);
    }
  }, [disabled]);
  let toggleClassName = "bg-[#d8d4cc]";
  if (disabled) {
    toggleClassName = "cursor-not-allowed bg-[#d8d4cc] opacity-60";
  } else if (isOn) {
    toggleClassName = "bg-[var(--account-night)]";
  }
  return (
    <button
      aria-checked={isOn}
      aria-label={`${label}: ${isOn ? "On" : "Off"}${disabled ? ". Planned" : ""}`}
      className={`account-focus h-6 w-11 rounded-full p-1 transition-colors ${toggleClassName}`}
      disabled={disabled}
      onClick={handleToggle}
      role="switch"
      type="button"
    >
      <m.div
        animate={{ x: isOn ? 20 : 0 }}
        className="size-4 rounded-full bg-white shadow-sm"
        layout
      />
    </button>
  );
}

export function AccountHero({ user }) {
  return (
    <header className="mb-10">
      <p className="mb-2 flex items-center gap-2 font-semibold text-[10px] text-[var(--account-gold)] uppercase tracking-[0.2em]">
        <Compass size={14} /> Your personal travel desk
      </p>
      <h1 className="account-display text-4xl text-[var(--account-ink)] leading-tight sm:text-6xl">
        Good to see you,{" "}
        <em className="text-[var(--account-gold)]">{user.name?.split(" ")[0] || "traveller"}.</em>
      </h1>
      <p className="mt-3 max-w-xl text-[var(--account-muted)] text-sm leading-6">
        Your journeys, thoughtfully arranged in one quiet place.
      </p>
    </header>
  );
}

export { ACCOUNT_GOLD, ACCOUNT_INK, ACCOUNT_NIGHT };
