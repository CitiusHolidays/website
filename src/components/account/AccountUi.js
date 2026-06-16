"use client";

import { m } from "motion/react";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Map as MapIcon,
  Plane,
  User,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";

export const ACCOUNT_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const ACCOUNT_ITEM_VARIANTS = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 10 },
  },
};

export function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        active
          ? "bg-[#0B1026] text-white shadow-lg shadow-[#0B1026]/20"
          : "text-gray-500 hover:bg-gray-50 hover:text-[#0B1026]"
      }`}
    >
      <span className={active ? "text-[#d4af37]" : ""}>{icon}</span>
      <span className={`text-sm font-medium ${active ? "" : "font-light"}`}>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto text-white/30" />}
    </button>
  );
}

export function BookingCard({ booking, type }) {
  const { trip, booking: bookingData } = booking;

  return (
    <m.div
      variants={{
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 },
      }}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-[#0B1026]/10 transition-all duration-500 border border-gray-100 flex flex-col md:flex-row h-full md:h-56"
    >
      <div className="w-full md:w-1/3 relative overflow-hidden h-48 md:h-full">
        {trip.coverImage ? (
          <Image
            src={trip.coverImage}
            alt={trip.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="size-full bg-gray-200 flex items-center justify-center">
            <MapIcon className="text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10"></div>

        <div className="absolute top-4 left-4">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md ${
              bookingData.status === "confirmed"
                ? "bg-green-500/20 text-white border border-green-500/30"
                : bookingData.status === "pending"
                  ? "bg-yellow-500/20 text-white border border-yellow-500/30"
                  : "bg-gray-500/20 text-white"
            }`}
          >
            {bookingData.status.charAt(0).toUpperCase() + bookingData.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="p-6 md:p-8 flex flex-col justify-between w-full md:w-2/3">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-heading text-2xl text-[#0B1026] group-hover:text-[#d4af37] transition-colors">
              {trip.name}
            </h3>
            <span className="font-heading text-lg font-medium text-[#0B1026]">
              {bookingData.currency} {bookingData.totalAmount.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500 font-light">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#d4af37]" />
              <span>
                {formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User size={16} className="text-[#d4af37]" />
              <span>
                {bookingData.travelers} Traveler{bookingData.travelers > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#d4af37]" />
              <span>
                {Math.ceil(
                  (new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24),
                )}{" "}
                Days
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            Booking ID:{" "}
            <span className="font-mono text-gray-500">{bookingData.id.slice(0, 8)}…</span>
          </div>
          <Link
            href={`/services/${trip.slug}`}
            className="flex items-center gap-2 text-sm font-medium text-[#0B1026] hover:text-[#d4af37] transition-colors"
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
      className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
        isSuccess
          ? "bg-green-50 border-green-100 text-green-800"
          : "bg-red-50 border-red-100 text-red-700"
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
        htmlFor={fieldId}
        className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1"
      >
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-[#0B1026] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37]/70 transition shadow-sm ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"
        }`}
      />
    </div>
  );
}

export function ProfileField({ label, value }) {
  return (
    <div>
      <p className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="text-lg text-[#0B1026] font-medium border-b border-gray-100 pb-2">
        {value || "—"}
      </div>
    </div>
  );
}

export function SettingRow({ title, description, action }) {
  return (
    <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div>
        <h4 className="text-[#0B1026] font-medium">{title}</h4>
        <p className="text-gray-500 text-sm font-light mt-1">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

export function Toggle() {
  const [isOn, setIsOn] = useState(true);
  return (
    <button
      type="button"
      aria-label={isOn ? "Turn off" : "Turn on"}
      onClick={() => setIsOn(!isOn)}
      className={`w-12 h-6 rounded-full p-1 transition-colors ${isOn ? "bg-[#0B1026]" : "bg-gray-200"}`}
    >
      <m.div
        layout
        className="size-4 rounded-full bg-white shadow-sm"
        animate={{ x: isOn ? 24 : 0 }}
      />
    </button>
  );
}

export function AccountHero({ user, upcomingCount, pastCount }) {
  return (
    <div className="relative h-[40vh] min-h-[400px] overflow-hidden bg-[#0B1026] text-[#FDFBF7] flex items-end pb-12">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 size-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a2c4e] via-[#0B1026] to-[#050814] opacity-80"></div>
        <div className="absolute top-[-20%] right-[-10%] size-[600px] rounded-full bg-[#d4af37] opacity-5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[10%] size-[400px] rounded-full bg-[#1e293b] opacity-20 blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('/noise.svg')]"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <m.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-4 text-[#d4af37]/80">
              <Compass className="size-5" />
              <span className="text-xs font-medium uppercase tracking-[0.2em]">
                Traveler Profile
              </span>
            </div>
            <h1 className="font-heading text-3xl sm:text-5xl md:text-7xl font-medium tracking-tight leading-none mb-2">
              Hello,{" "}
              <span className="italic text-[#d4af37]">
                {user.name?.split(" ")[0] || "Traveler"}
              </span>
            </h1>
            <p className="text-white/60 font-light max-w-lg">
              Your journey log and personal preferences.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:min-w-[140px]">
              <span className="block text-2xl font-heading text-white">{upcomingCount}</span>
              <span className="text-xs text-white/50 uppercase tracking-wider">Upcoming</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:min-w-[140px]">
              <span className="block text-2xl font-heading text-white">{pastCount}</span>
              <span className="text-xs text-white/50 uppercase tracking-wider">Past Trips</span>
            </div>
          </div>
        </m.div>
      </div>
    </div>
  );
}
