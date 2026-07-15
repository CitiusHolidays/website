"use client";

import { CloudCheck, LoaderCircle, LogIn, RotateCcw, Trophy } from "lucide-react";
import Link from "next/link";
import { useSacredBharatContext } from "./SacredBharatProvider";

export function GuestMergeStatus({ className = "", hasGuestDraft, mergeStatus, retryGuestMerge }) {
  if (mergeStatus === "idle") {
    return null;
  }
  const failed = mergeStatus === "error";
  return (
    <div
      aria-busy={mergeStatus === "syncing"}
      aria-live="polite"
      className={`rounded-2xl border px-5 py-4 font-sans text-sm ${
        failed
          ? "border-red-300 bg-red-50 text-red-900"
          : "border-citius-blue/20 bg-citius-blue/5 text-brand-dark"
      } ${className}`}
      role={failed ? "alert" : "status"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {mergeStatus === "syncing" ? (
            <LoaderCircle aria-hidden="true" className="animate-spin text-citius-blue" size={18} />
          ) : (
            <CloudCheck aria-hidden="true" className="text-citius-blue" size={18} />
          )}
          <p>
            {mergeStatus === "syncing" && "Saving your local pilgrimage to your account…"}
            {mergeStatus === "success" && "Your local pilgrimage is saved to your account."}
            {failed &&
              "We could not save your local pilgrimage. Your local copy is safe; try again when you are connected."}
          </p>
        </div>
        {failed && hasGuestDraft ? (
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-citius-blue px-5 py-2.5 font-medium text-sm text-white hover:bg-citius-blue/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
            onClick={retryGuestMerge}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
            Retry saving
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function GuestSaveBanner({ className = "" }) {
  const { hasGuestDraft, isAuthenticated, mergeStatus, progress, retryGuestMerge } =
    useSacredBharatContext();

  if (isAuthenticated) {
    return (
      <GuestMergeStatus
        className={className}
        hasGuestDraft={hasGuestDraft}
        mergeStatus={mergeStatus}
        retryGuestMerge={retryGuestMerge}
      />
    );
  }

  const loginHref = "/auth/guest?callbackUrl=/sacred-bharat";

  return (
    <div
      className={`rounded-2xl border border-citius-orange/25 bg-linear-to-r from-citius-orange/8 to-citius-blue/8 px-5 py-4 md:px-6 md:py-5 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 font-heading text-citius-orange text-sm uppercase tracking-[0.2em]">
            Save your pilgrimage
          </p>
          <p className="font-sans text-brand-muted text-sm md:text-base">
            You have {progress.templeCount} sacred site
            {progress.templeCount === 1 ? "" : "s"} logged locally. Sign in to save progress, earn
            your place on the leaderboard, and build your digital legacy.
          </p>
        </div>
        <Link
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-citius-blue px-5 py-2.5 font-medium text-sm text-white transition-colors hover:bg-citius-blue/90"
          href={loginHref}
        >
          <LogIn aria-hidden="true" size={16} />
          Sign in to save
          <Trophy aria-hidden="true" className="text-citius-orange" size={16} />
        </Link>
      </div>
    </div>
  );
}
