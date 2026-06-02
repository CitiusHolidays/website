"use client";

import { LogOut, Map as MapIcon, Settings, User } from "lucide-react";
import { m as motion } from "motion/react";
import { NavButton } from "./AccountUi";

export function AccountSidebar({ activeTab, onTabChange, onLogout, isLoggingOut }) {
  return (
    <div className="lg:col-span-3">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl shadow-xl shadow-[#0B1026]/5 p-2 sticky top-24"
      >
        <nav className="flex flex-col gap-1">
          <NavButton
            active={activeTab === "journeys"}
            onClick={() => onTabChange("journeys")}
            icon={<MapIcon size={18} />}
            label="My Journeys"
          />
          <NavButton
            active={activeTab === "profile"}
            onClick={() => onTabChange("profile")}
            icon={<User size={18} />}
            label="Profile Details"
          />
          <NavButton
            active={activeTab === "settings"}
            onClick={() => onTabChange("settings")}
            icon={<Settings size={18} />}
            label="Settings"
          />

          <div className="my-2 border-t border-gray-100"></div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span>{isLoggingOut ? "Signing out…" : "Sign Out"}</span>
          </button>
        </nav>
      </motion.div>
    </div>
  );
}
