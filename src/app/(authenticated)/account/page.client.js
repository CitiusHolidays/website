"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AccountJourneysPanel,
  JourneyDetailPanel,
} from "@/components/account/AccountJourneysPanel";
import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { AccountSettingsPanel } from "@/components/account/AccountSettingsPanel";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { AccountHero, AccountLoadingState, AccountStateCard } from "@/components/account/AccountUi";
import { logout } from "@/lib/auth-client";

const EMPTY_BOOKINGS = [];

function bookingEnd(booking) {
  const parsed = Date.parse(booking?.trip?.endDate || booking?.trip?.startDate || "");
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function isCancelled(booking) {
  return booking?.booking?.status === "cancelled";
}

function reloadAccount() {
  window.location.reload();
}

export default function AccountClient({ user, bookings, bookingLoadError = "", referenceNow }) {
  const searchParams = useSearchParams();
  const requestedJourneyId = searchParams.get("journey");
  const [activeTab, setActiveTab] = useState("journeys");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const bookingRows = Array.isArray(bookings) ? bookings : EMPTY_BOOKINGS;
  const bookingsPending = bookings === undefined && !bookingLoadError;
  const effectiveReferenceNow = Number.isFinite(referenceNow) ? referenceNow : 0;
  const cancelledBookings = bookingRows.filter(isCancelled);
  const activeBookings = bookingRows.filter((booking) => !isCancelled(booking));
  const pastBookings = activeBookings.filter(
    (booking) => bookingEnd(booking) < effectiveReferenceNow
  );
  const upcomingBookings = activeBookings.filter(
    (booking) => bookingEnd(booking) >= effectiveReferenceNow
  );

  const selectedBooking = requestedJourneyId
    ? bookingRows.find((booking) => booking.booking?.id === requestedJourneyId)
    : null;
  const hasBookingCounts = !(bookingsPending || bookingLoadError);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
      window.location.href = "/";
    } catch {
      setIsLoggingOut(false);
      setLogoutError("We could not sign you out. Please try again.");
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setLogoutError("");
  };

  const renderContent = () => {
    if (activeTab === "profile") {
      return <AccountProfilePanel user={user} />;
    }
    if (activeTab === "settings") {
      return <AccountSettingsPanel />;
    }
    if (bookingsPending) {
      return <AccountLoadingState />;
    }
    if (selectedBooking) {
      return <JourneyDetailPanel booking={selectedBooking} referenceNow={effectiveReferenceNow} />;
    }
    if (requestedJourneyId) {
      return (
        <AccountStateCard
          action={
            <Link
              className="inline-flex min-h-11 items-center rounded-full bg-brand-dark px-5 py-2.5 font-semibold text-sm text-white transition-[background-color,transform] duration-150 fine-hover:hover:-translate-y-px hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
              href="/account"
            >
              Back to journeys
            </Link>
          }
          description="That journey is no longer available in your Account. Your other bookings remain protected and available here."
          title="Journey not found"
        />
      );
    }
    if (bookingLoadError) {
      return (
        <AccountStateCard
          action={
            <button
              className="inline-flex min-h-11 items-center rounded-full bg-brand-dark px-5 py-2.5 font-semibold text-sm text-white transition-[background-color,transform] duration-150 fine-hover:hover:-translate-y-px hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
              onClick={reloadAccount}
              type="button"
            >
              Try again
            </button>
          }
          description="We could not load your journeys right now. Your account is still signed in; please try again in a moment."
          icon={undefined}
          title="Your journeys could not load"
          tone="danger"
        />
      );
    }
    return (
      <AccountJourneysPanel
        cancelledBookings={cancelledBookings}
        pastBookings={pastBookings}
        upcomingBookings={upcomingBookings}
      />
    );
  };

  return (
    <div className="min-h-dvh bg-brand-light">
      <AccountHero
        pastCount={hasBookingCounts ? pastBookings.length : null}
        upcomingCount={hasBookingCounts ? upcomingBookings.length : null}
        user={user}
      />

      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-12">
        <AccountSidebar
          activeTab={activeTab}
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
          onTabChange={handleTabChange}
        />

        <main className="min-w-0 lg:col-span-9" id="account-main">
          {Boolean(logoutError) && (
            <p
              aria-live="polite"
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm"
              role="alert"
            >
              {logoutError}
            </p>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
