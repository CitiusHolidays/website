"use client";

import { AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import { AccountJourneysPanel } from "@/components/account/AccountJourneysPanel";
import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { AccountSettingsPanel } from "@/components/account/AccountSettingsPanel";
import { AccountHeader } from "@/components/account/AccountSidebar";
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
    <div className="account-shell min-h-screen pb-24 md:pb-0">
      <AccountHeader
        activeTab={activeTab}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
        onTabChange={setActiveTab}
        user={user}
      />
      <div className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <main>
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
