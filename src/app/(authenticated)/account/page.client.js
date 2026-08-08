"use client";

import { AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import { AccountJourneysPanel } from "@/components/account/AccountJourneysPanel";
import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { AccountSettingsPanel } from "@/components/account/AccountSettingsPanel";
import { AccountHeader } from "@/components/account/AccountSidebar";
import { AccountHero } from "@/components/account/AccountUi";
import { logout } from "@/lib/auth-client";

const EMPTY_JOURNEYS = Object.freeze({ referenceNow: 0, summaries: [] });

function splitJourneys(summaries) {
  return summaries.reduce(
    (groups, item) => {
      if (item.category === "cancelled") {
        groups.cancelled.push(item);
      } else if (item.category === "past") {
        groups.past.push(item);
      } else {
        groups.upcoming.push(item);
      }
      return groups;
    },
    { cancelled: [], past: [], upcoming: [] }
  );
}

export default function AccountClient({ user, journeys = EMPTY_JOURNEYS, confirmedTrips = [] }) {
  const [activeTab, setActiveTab] = useState("journeys");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const groups = useMemo(() => splitJourneys(journeys.summaries), [journeys.summaries]);

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
          <AnimatePresence initial={false} mode="sync">
            {activeTab === "journeys" && (
              <AccountJourneysPanel
                cancelledBookings={groups.cancelled}
                confirmedTrips={confirmedTrips}
                key="journeys"
                pastBookings={groups.past}
                referenceNow={journeys.referenceNow}
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
