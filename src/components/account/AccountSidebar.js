"use client";

import { LogOut, Map as MapIcon, Settings, User } from "lucide-react";
import { m } from "motion/react";
import { NavButton } from "./AccountUi";

export function AccountSidebar({ activeTab, onTabChange, onLogout, isLoggingOut }) {
  return (
    <div className="lg:col-span-3">
      <m.div
        animate={{ opacity: 1, x: 0 }}
        className="sticky top-24 rounded-2xl bg-white p-2 shadow-[#0B1026]/5 shadow-xl"
        initial={{ opacity: 0, x: -20 }}
        transition={{ delay: 0.4 }}
      >
        <nav className="flex flex-col gap-1">
          <NavButton
            active={activeTab === "journeys"}
            icon={<MapIcon size={18} />}
            label="My Journeys"
            onClick={() => onTabChange("journeys")}
          />
          <NavButton
            active={activeTab === "profile"}
            icon={<User size={18} />}
            label="Profile Details"
            onClick={() => onTabChange("profile")}
          />
          <NavButton
            active={activeTab === "settings"}
            icon={<Settings size={18} />}
            label="Settings"
            onClick={() => onTabChange("settings")}
          />

          <div className="my-2 border-gray-100 border-t" />

          <button
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-red-500 text-sm transition-colors hover:bg-red-50"
            onClick={onLogout}
            type="button"
          >
            <LogOut size={18} />
            <span>{isLoggingOut ? "Signing out…" : "Sign Out"}</span>
          </button>
        </nav>
      </m.div>
    </div>
  );
}
