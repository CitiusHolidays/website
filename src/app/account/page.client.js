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
    (b) => b.booking.status !== "cancelled" && new Date(b.trip.startDate) >= new Date(),
  );
  const pastBookings = bookings.filter(
    (b) => b.booking.status !== "cancelled" && new Date(b.trip.startDate) < new Date(),
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans">
      <AccountHero
        user={user}
        upcomingCount={upcomingBookings.length}
        pastCount={pastBookings.length}
      />

      <div className="container mx-auto px-6 py-12 -mt-8 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <AccountSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
          />

          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              {activeTab === "journeys" && (
                <AccountJourneysPanel
                  upcomingBookings={upcomingBookings}
                  pastBookings={pastBookings}
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
