"use client";

import { LogIn, Trophy } from "lucide-react";
import Link from "next/link";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function GuestSaveBanner({ className = "" }) {
  const { isAuthenticated, progress } = useSacredBharatContext();

  if (isAuthenticated) return null;

  const loginHref = "/auth/guest?callbackUrl=/sacred-bharat";

  return (
    <div
      className={`rounded-2xl border border-citius-orange/25 bg-linear-to-r from-citius-orange/8 to-citius-blue/8 px-5 py-4 md:px-6 md:py-5 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-sm uppercase tracking-[0.2em] text-citius-orange mb-1">
            Save your pilgrimage
          </p>
          <p className="font-sans text-sm md:text-base text-brand-muted">
            You have {progress.templeCount} sacred site
            {progress.templeCount === 1 ? "" : "s"} logged locally. Sign in to save progress, earn
            your place on the leaderboard, and build your digital legacy.
          </p>
        </div>
        <Link
          href={loginHref}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-citius-blue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-citius-blue/90"
        >
          <LogIn size={16} />
          Sign in to save
          <Trophy size={16} className="text-citius-orange" />
        </Link>
      </div>
    </div>
  );
}
