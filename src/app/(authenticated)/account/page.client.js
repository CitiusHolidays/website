"use client";

import { AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import { AccountJourneysPanel } from "@/components/account/AccountJourneysPanel";
import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { AccountSettingsPanel } from "@/components/account/AccountSettingsPanel";
import { AccountControl, AccountSidebar } from "@/components/account/AccountSidebar";
import { AccountHero } from "@/components/account/AccountUi";
import { logout } from "@/lib/auth-client";

const EMPTY_BOOKINGS = [];

function splitBookings(bookings) {
  const now = Date.now();
  return bookings.reduce(
    (groups, item) => {
      const start = Date.parse(item.trip?.startDate || "");
      if (item.booking?.status === "cancelled") {
        groups.cancelled.push(item);
      } else if (Number.isFinite(start) && start >= now) {
        groups.upcoming.push(item);
      } else {
        groups.past.push(item);
      }
      return groups;
    },
    { cancelled: [], past: [], upcoming: [] }
  );
}

export default function AccountClient({ user, bookings = EMPTY_BOOKINGS }) {
  const [activeTab, setActiveTab] = useState("journeys");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const groups = useMemo(() => splitBookings(bookings), [bookings]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = "/";
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="account-shell min-h-screen pb-24 lg:pb-0 lg:pl-[236px]">
      <AccountSidebar
        activeTab={activeTab}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
        onTabChange={setActiveTab}
        user={user}
      />
      <div className="mx-auto min-h-screen max-w-[1240px] px-5 py-5 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        <div className="hidden items-center justify-between border-[var(--account-border)] border-b pb-5 lg:flex">
          <p className="font-semibold text-[10px] text-[var(--account-muted)] uppercase tracking-[0.2em]">
            Citius Holidays · Private account
          </p>
          <AccountControl isLoggingOut={isLoggingOut} onLogout={handleLogout} user={user} />
        </div>
        <main className="pt-7 lg:pt-12">
          {activeTab === "journeys" && <AccountHero user={user} />}
          <AnimatePresence mode="wait">
            {activeTab === "journeys" && (
              <AccountJourneysPanel
                cancelledBookings={groups.cancelled}
                key="journeys"
                pastBookings={groups.past}
                upcomingBookings={groups.upcoming}
              />
            )}
            {activeTab === "profile" && <AccountProfilePanel key="profile" user={user} />}
            {activeTab === "settings" && <AccountSettingsPanel key="settings" />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
