"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  Info,
  MapPin,
  Plane,
  UserRound,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";

const STATUS_COPY = {
  cancelled: { label: "Cancelled", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "positive" },
  failed: { label: "Payment needs attention", tone: "danger" },
  pending: { label: "Awaiting confirmation", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
};

const STATUS_TONE_CLASSES = {
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};
const NAME_PARTS_PATTERN = /\s+/;

export function getBookingPresentation(bookingData, { isPast = false } = {}) {
  const status = bookingData?.status;
  if (status === "confirmed" && isPast) {
    return { label: "Completed", tone: "positive" };
  }
  return STATUS_COPY[status] || { label: "Booking update", tone: "neutral" };
}

export function formatBookingAmount(currency, amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "Amount on file";
  }

  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      currency: currency || "USD",
      maximumFractionDigits: 0,
      style: "currency",
    }).format(amount);
  } catch {
    return `${currency || ""} ${amount.toLocaleString()}`.trim();
  }
}

export function getTripDuration(startDate, endDate) {
  const start = Date.parse(startDate || "");
  const end = Date.parse(endDate || "");
  if (!(Number.isFinite(start) && Number.isFinite(end)) || end < start) {
    return null;
  }
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

export function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-sm transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2",
        active
          ? "bg-brand-dark text-white shadow-md shadow-slate-900/10"
          : "text-slate-600 hover:bg-slate-50 hover:text-brand-dark"
      )}
      onClick={onClick}
      type="button"
    >
      <span className={cn("shrink-0", active ? "text-citius-orange" : "text-slate-400")}>
        {icon}
      </span>
      <span>{label}</span>
      {Boolean(active) && (
        <ChevronRight aria-hidden="true" className="ml-auto text-white/50" size={15} />
      )}
    </button>
  );
}

export function StatusPill({ bookingData, isPast = false }) {
  const presentation = getBookingPresentation(bookingData, { isPast });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold text-xs",
        STATUS_TONE_CLASSES[presentation.tone]
      )}
    >
      {presentation.tone === "positive" ? (
        <CheckCircle2 aria-hidden="true" size={13} />
      ) : presentation.tone === "danger" ? (
        <XCircle aria-hidden="true" size={13} />
      ) : (
        <Clock3 aria-hidden="true" size={13} />
      )}
      {presentation.label}
    </span>
  );
}

export function BookingCard({ booking, type = "upcoming" }) {
  const trip = booking?.trip || {};
  const bookingData = booking?.booking || {};
  const isPast = type === "past" || type === "cancelled";
  const duration = getTripDuration(trip.startDate, trip.endDate);
  const travelers = Number(bookingData.travelers) || 0;
  const journeyHref = `/account?journey=${encodeURIComponent(bookingData.id || "")}`;

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-[box-shadow,transform] duration-150 fine-hover:hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10">
      <Link
        aria-label={`Open journey ${trip.name || "booking"}`}
        className="grid min-w-0 gap-0 md:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.5fr)]"
        href={journeyHref}
      >
        <div className="relative aspect-[16/10] min-h-48 overflow-hidden bg-slate-100 md:aspect-auto md:min-h-64">
          {trip.coverImage ? (
            <Image
              alt={trip.name ? `${trip.name} destination` : "Journey destination"}
              className="object-cover transition-transform duration-150 fine-hover:group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 768px) 100vw, 36vw"
              src={trip.coverImage}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-slate-400">
              <Compass aria-hidden="true" size={32} />
            </div>
          )}
          <div className="absolute top-4 left-4">
            <StatusPill bookingData={bookingData} isPast={isPast} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between p-5 sm:p-7">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-2 font-semibold text-citius-orange text-xs uppercase tracking-[0.12em]">
                  {type === "upcoming"
                    ? "Upcoming journey"
                    : type === "cancelled"
                      ? "Cancelled journey"
                      : "Past journey"}
                </p>
                <h3 className="text-balance font-heading text-2xl text-brand-dark sm:text-3xl">
                  {trip.name || "Unnamed journey"}
                </h3>
              </div>
              <span className="shrink-0 font-semibold text-brand-dark text-sm tabular-nums">
                {formatBookingAmount(bookingData.currency, bookingData.totalAmount)}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-slate-600 text-sm">
              <span className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="text-citius-orange" size={16} />
                {formatDisplayDate(trip.startDate)} – {formatDisplayDate(trip.endDate)}
              </span>
              {travelers > 0 && (
                <span className="inline-flex items-center gap-2">
                  <UserRound aria-hidden="true" className="text-citius-orange" size={16} />
                  {travelers} {travelers === 1 ? "traveler" : "travelers"}
                </span>
              )}
              {duration && (
                <span className="inline-flex items-center gap-2">
                  <Clock3 aria-hidden="true" className="text-citius-orange" size={16} />
                  {duration} {duration === 1 ? "day" : "days"}
                </span>
              )}
            </div>

            <p className="mt-5 line-clamp-2 max-w-2xl text-pretty text-slate-600 text-sm leading-relaxed">
              {trip.description || "Your Citius travel team will share the next details here."}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-slate-100 border-t pt-5">
            <span className="font-mono text-slate-500 text-xs">
              Booking reference {bookingData.id ? `${bookingData.id.slice(0, 8)}…` : "pending"}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold text-brand-dark text-sm transition-colors group-hover:text-citius-orange">
              Open journey <ChevronRight aria-hidden="true" size={16} />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function ProfileAlert({ type = "success", message }) {
  const isSuccess = type === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"
      )}
      role={isSuccess ? "status" : "alert"}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
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
  return (
    <div className="space-y-2">
      <label className="block font-semibold text-slate-600 text-sm" htmlFor={fieldId}>
        {label}
      </label>
      <input
        className={cn(
          "min-h-11 w-full rounded-xl border px-4 py-3 text-brand-dark shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-citius-orange focus:outline-none focus:ring-2 focus:ring-citius-orange/25",
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
            : "border-slate-300 bg-white"
        )}
        disabled={disabled}
        id={fieldId}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value ?? ""}
      />
    </div>
  );
}

export function ProfileField({ label, value }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-slate-600 text-sm">{label}</p>
      <div className="min-h-11 border-slate-200 border-b pb-3 font-medium text-base text-brand-dark">
        {value || "—"}
      </div>
    </div>
  );
}

export function SettingRow({ title, description, action }) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <h4 className="font-semibold text-brand-dark">{title}</h4>
        <p className="mt-1 max-w-2xl text-pretty text-slate-600 text-sm leading-relaxed">
          {description}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function Toggle({ label = "Toggle setting", defaultOn = true, onChange }) {
  const [isOn, setIsOn] = useState(defaultOn);
  const toggle = () => {
    const next = !isOn;
    setIsOn(next);
    onChange?.(next);
  };

  return (
    <button
      aria-label={`${label}: ${isOn ? "on" : "off"}`}
      aria-pressed={isOn}
      className={cn(
        "relative h-7 w-12 rounded-full p-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2",
        isOn ? "bg-brand-dark" : "bg-slate-300"
      )}
      onClick={toggle}
      type="button"
    >
      <span
        className={cn(
          "block size-5 rounded-full bg-white shadow-sm transition-transform duration-150",
          isOn ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function AccountStateCard({
  title,
  description,
  action,
  tone = "neutral",
  icon: Icon = Info,
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-3xl border bg-white p-8 text-center shadow-sm sm:p-12",
        tone === "danger" ? "border-red-200" : "border-slate-200"
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div
        className={cn(
          "mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl",
          tone === "danger" ? "bg-red-50 text-red-600" : "bg-slate-100 text-brand-dark"
        )}
      >
        <Icon aria-hidden="true" size={24} />
      </div>
      <h2 className="text-balance font-heading text-2xl text-brand-dark">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-pretty text-slate-600 text-sm leading-relaxed">
        {description}
      </p>
      {Boolean(action) && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function AccountLoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading journeys" className="space-y-5" role="status">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.5fr)] sm:p-0">
        <div className="aspect-[16/10] animate-pulse rounded-2xl bg-slate-200 sm:rounded-none" />
        <div className="space-y-4 p-2 sm:p-7">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function AccountHero({ user, upcomingCount, pastCount }) {
  const firstName = user?.name?.trim().split(NAME_PARTS_PATTERN)[0] || "Traveler";
  const initials = firstName.slice(0, 1).toUpperCase();

  return (
    <section className="relative overflow-hidden bg-brand-dark pt-28 pb-16 text-white sm:pt-32 sm:pb-20">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.035]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 font-semibold text-citius-orange text-xs uppercase tracking-[0.12em]">
            <Compass aria-hidden="true" size={16} />
            Customer account
          </div>
          <h1 className="max-w-3xl text-balance font-heading text-4xl leading-tight sm:text-5xl">
            Welcome back, <span className="text-citius-orange">{firstName}</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-slate-300 leading-relaxed">
            Keep your journeys close, review the details we have ready, and stay in touch with your
            Citius travel team.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="min-w-32 rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="block font-heading text-3xl tabular-nums">{upcomingCount ?? "—"}</span>
            <span className="mt-1 block text-slate-300 text-xs uppercase tracking-[0.12em]">
              Upcoming
            </span>
          </div>
          <div className="min-w-32 rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="block font-heading text-3xl tabular-nums">{pastCount ?? "—"}</span>
            <span className="mt-1 block text-slate-300 text-xs uppercase tracking-[0.12em]">
              Past journeys
            </span>
          </div>
          <div className="col-span-2 flex items-center gap-3 border-white/10 border-t pt-4 text-slate-300 text-sm">
            <span className="flex size-9 items-center justify-center rounded-full bg-citius-orange font-semibold text-white">
              {initials}
            </span>
            <span className="truncate">{user?.email || "Your Citius account"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function InfoLink({ href, children, icon: Icon = MapPin }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-brand-dark text-sm transition-[background-color,border-color,color] duration-150 hover:border-brand-dark hover:bg-brand-dark hover:text-white focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
      href={href}
    >
      <Icon aria-hidden="true" size={16} />
      {children}
    </Link>
  );
}

export function TravelSummary({ icon: Icon = CalendarDays, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-citius-orange" size={17} />
      <div className="min-w-0">
        <dt className="font-semibold text-slate-500 text-xs uppercase tracking-[0.1em]">{label}</dt>
        <dd className="mt-1 text-brand-dark text-sm">{value || "Not available yet"}</dd>
      </div>
    </div>
  );
}

export function FlightIcon() {
  return <Plane aria-hidden="true" size={18} />;
}
