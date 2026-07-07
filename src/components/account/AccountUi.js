"use client";

import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Map as MapIcon,
  User,
  XCircle,
} from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";

export const ACCOUNT_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.1,
    },
  },
};

export const ACCOUNT_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: { damping: 10, stiffness: 100, type: "spring" },
    y: 0,
  },
};

export function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300 ${
        active
          ? "bg-[#0B1026] text-white shadow-[#0B1026]/20 shadow-lg"
          : "text-gray-500 hover:bg-gray-50 hover:text-[#0B1026]"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={active ? "text-[#d4af37]" : ""}>{icon}</span>
      <span className={`font-medium text-sm ${active ? "" : "font-light"}`}>{label}</span>
      {active && <ChevronRight className="ml-auto text-white/30" size={14} />}
    </button>
  );
}

export function BookingCard({ booking, type }) {
  const { trip, booking: bookingData } = booking;

  return (
    <m.div
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-500 hover:shadow-[#0B1026]/10 hover:shadow-xl md:h-56 md:flex-row"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
    >
      <div className="relative h-48 w-full overflow-hidden md:h-full md:w-1/3">
        {trip.coverImage ? (
          <Image
            alt={trip.name}
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            src={trip.coverImage}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gray-200">
            <MapIcon className="text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10" />

        <div className="absolute top-4 left-4">
          <span
            className={`rounded-full px-3 py-1 font-medium text-xs backdrop-blur-md ${
              bookingData.status === "confirmed"
                ? "border border-green-500/30 bg-green-500/20 text-white"
                : bookingData.status === "pending"
                  ? "border border-yellow-500/30 bg-yellow-500/20 text-white"
                  : "bg-gray-500/20 text-white"
            }`}
          >
            {bookingData.status.charAt(0).toUpperCase() + bookingData.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col justify-between p-6 md:w-2/3 md:p-8">
        <div>
          <div className="mb-2 flex items-start justify-between">
            <h3 className="font-heading text-2xl text-[#0B1026] transition-colors group-hover:text-[#d4af37]">
              {trip.name}
            </h3>
            <span className="font-heading font-medium text-[#0B1026] text-lg">
              {bookingData.currency} {bookingData.totalAmount.toLocaleString()}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 font-light text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="text-[#d4af37]" size={16} />
              <span>
                {formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="text-[#d4af37]" size={16} />
              <span>
                {bookingData.travelers} Traveler{bookingData.travelers > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-[#d4af37]" size={16} />
              <span>
                {Math.ceil(
                  (new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)
                )}{" "}
                Days
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-gray-100 border-t pt-6">
          <div className="text-gray-400 text-xs">
            Booking ID:{" "}
            <span className="font-mono text-gray-500">{bookingData.id.slice(0, 8)}…</span>
          </div>
          <Link
            className="flex items-center gap-2 font-medium text-[#0B1026] text-sm transition-colors hover:text-[#d4af37]"
            href={`/services/${trip.slug}`}
          >
            View Trip Details <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </m.div>
  );
}

export function ProfileAlert({ type = "success", message }) {
  const isSuccess = type === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div
      className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
        isSuccess
          ? "border-green-100 bg-green-50 text-green-800"
          : "border-red-100 bg-red-50 text-red-700"
      }`}
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
  return (
    <div>
      <label
        className="mb-1 block font-medium text-gray-400 text-xs uppercase tracking-wider"
        htmlFor={fieldId}
      >
        {label}
      </label>
      <input
        className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-[#0B1026] shadow-sm transition focus:border-[#d4af37]/70 focus:outline-none focus:ring-2 focus:ring-[#d4af37] ${
          disabled ? "cursor-not-allowed bg-gray-50 text-gray-500" : "bg-white"
        }`}
        disabled={disabled}
        id={fieldId}
        onChange={(e) => onChange?.(e.target.value)}
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
      <p className="mb-1 block font-medium text-gray-400 text-xs uppercase tracking-wider">
        {label}
      </p>
      <div className="border-gray-100 border-b pb-2 font-medium text-[#0B1026] text-lg">
        {value || "—"}
      </div>
    </div>
  );
}

export function SettingRow({ title, description, action }) {
  return (
    <div className="flex items-center justify-between p-6 transition-colors hover:bg-gray-50">
      <div>
        <h4 className="font-medium text-[#0B1026]">{title}</h4>
        <p className="mt-1 font-light text-gray-500 text-sm">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

export function Toggle() {
  const [isOn, setIsOn] = useState(true);
  return (
    <button
      aria-label={isOn ? "Turn off" : "Turn on"}
      className={`h-6 w-12 rounded-full p-1 transition-colors ${isOn ? "bg-[#0B1026]" : "bg-gray-200"}`}
      onClick={() => setIsOn(!isOn)}
      type="button"
    >
      <m.div
        animate={{ x: isOn ? 24 : 0 }}
        className="size-4 rounded-full bg-white shadow-sm"
        layout
      />
    </button>
  );
}

export function AccountHero({ user, upcomingCount, pastCount }) {
  return (
    <div className="relative flex h-[40vh] min-h-[400px] items-end overflow-hidden bg-[#0B1026] pb-12 text-[#FDFBF7]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 size-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80" />
        <div className="absolute top-[-20%] right-[-10%] size-[600px] rounded-full bg-[#d4af37] opacity-5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] size-[400px] rounded-full bg-[#1e293b] opacity-20 blur-3xl" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="container relative z-10 mx-auto px-6">
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col justify-between gap-8 md:flex-row md:items-end"
          initial={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <div className="mb-4 flex items-center gap-3 text-[#d4af37]/80">
              <Compass className="size-5" />
              <span className="font-medium text-xs uppercase tracking-[0.2em]">
                Traveler Profile
              </span>
            </div>
            <h1 className="mb-2 font-heading font-medium text-3xl leading-none tracking-tight sm:text-5xl md:text-7xl">
              Hello,{" "}
              <span className="text-[#d4af37] italic">
                {user.name?.split(" ")[0] || "Traveler"}
              </span>
            </h1>
            <p className="max-w-lg font-light text-white/60">
              Your journey log and personal preferences.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:min-w-[140px]">
              <span className="block font-heading text-2xl text-white">{upcomingCount}</span>
              <span className="text-white/50 text-xs uppercase tracking-wider">Upcoming</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:min-w-[140px]">
              <span className="block font-heading text-2xl text-white">{pastCount}</span>
              <span className="text-white/50 text-xs uppercase tracking-wider">Past Trips</span>
            </div>
          </div>
        </m.div>
      </div>
    </div>
  );
}
