"use client";

import { LifeBuoy, LogOut, Map as MapIcon, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { NavButton } from "./AccountUi";

const NAV_ITEMS = [
  { icon: <MapIcon aria-hidden="true" size={18} />, id: "journeys", label: "My journeys" },
  { icon: <UserRound aria-hidden="true" size={18} />, id: "profile", label: "Profile" },
  { icon: <Settings aria-hidden="true" size={18} />, id: "settings", label: "Settings" },
];

export function AccountSidebar({ activeTab, onTabChange, onLogout, isLoggingOut }) {
  return (
    <aside className="lg:col-span-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-2 shadow-sm lg:sticky lg:top-24">
        <p className="px-4 pt-3 pb-2 font-semibold text-slate-400 text-xs uppercase tracking-[0.12em]">
          Account
        </p>
        <nav aria-label="Account sections" className="grid grid-cols-3 gap-1 lg:flex lg:flex-col">
          {NAV_ITEMS.map((item) => (
            <NavButton
              active={activeTab === item.id}
              icon={item.icon}
              key={item.id}
              label={item.label}
              onClick={() => onTabChange(item.id)}
            />
          ))}
        </nav>

        <div className="my-2 border-slate-100 border-t" />

        <Link
          className="flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-600 text-sm transition-colors duration-150 hover:bg-slate-50 hover:text-brand-dark focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
          href="/contact"
        >
          <LifeBuoy aria-hidden="true" className="shrink-0 text-citius-orange" size={18} />
          <span>Need help?</span>
        </Link>
        <button
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-red-600 text-sm transition-colors duration-150 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500 focus-visible:outline-offset-2"
          disabled={isLoggingOut}
          onClick={onLogout}
          type="button"
        >
          <LogOut aria-hidden="true" className="shrink-0" size={18} />
          <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}
