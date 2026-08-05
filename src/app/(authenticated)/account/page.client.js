"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { AccountJourneysPanel } from "@/components/account/AccountJourneysPanel";
import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { AccountSettingsPanel } from "@/components/account/AccountSettingsPanel";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { AccountHero } from "@/components/account/AccountUi";
import { logout } from "@/lib/auth-client";

const EMPTY_BOOKINGS = [];

export default function AccountClient({ user, bookings = EMPTY_BOOKINGS }) {
  const [activeTab, setActiveTab] = useState("journeys");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    window.location.href = "/";
  };

  const upcomingBookings = bookings.filter(
    (b) => b.booking.status !== "cancelled" && new Date(b.trip.startDate) >= new Date()
  );
  const pastBookings = bookings.filter(
    (b) => b.booking.status !== "cancelled" && new Date(b.trip.startDate) < new Date()
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans">
      <AccountHero
        pastCount={pastBookings.length}
        upcomingCount={upcomingBookings.length}
        user={user}
      />

      <div className="container relative z-20 mx-auto -mt-8 px-6 py-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <AccountSidebar
            activeTab={activeTab}
            isLoggingOut={isLoggingOut}
            onLogout={handleLogout}
            onTabChange={setActiveTab}
          />

          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              {activeTab === "journeys" && (
                <AccountJourneysPanel
                  pastBookings={pastBookings}
                  upcomingBookings={upcomingBookings}
                />
              )}
              {activeTab === "profile" && <AccountProfilePanel user={user} />}
              {activeTab === "settings" && <AccountSettingsPanel />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
