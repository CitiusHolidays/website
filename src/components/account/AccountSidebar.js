"use client";

import { LogOut, MapIcon, Settings, UserRound } from "lucide-react";
import { AccountMark, NavButton } from "./AccountUi";

const NAV_ITEMS = [
  { icon: <MapIcon size={17} />, id: "journeys", label: "Journeys" },
  { icon: <UserRound size={17} />, id: "profile", label: "Profile" },
  { icon: <Settings size={17} />, id: "settings", label: "Settings" },
];

export function AccountSidebar({ activeTab, onTabChange, onLogout, isLoggingOut }) {
  const navHandlers = {
    journeys: () => onTabChange("journeys"),
    profile: () => onTabChange("profile"),
    settings: () => onTabChange("settings"),
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col bg-[var(--account-night)] px-6 py-8 text-white lg:flex">
        <AccountMark inverse />
        <p className="mt-16 font-semibold text-[9px] text-white/35 uppercase tracking-[0.22em]">
          Your account
        </p>
        <nav aria-label="Account navigation" className="mt-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavButton
              active={activeTab === item.id}
              icon={item.icon}
              key={item.id}
              label={item.label}
              onClick={navHandlers[item.id]}
            />
          ))}
        </nav>
        <div className="mt-auto border-white/10 border-t pt-5">
          <p className="mb-4 text-white/45 text-xs leading-5">Need a hand with your journey?</p>
          <a
            className="account-focus mb-5 block text-[var(--account-gold)] text-xs hover:text-white"
            href="mailto:hello@citiusholidays.com"
          >
            Speak with our team <span aria-hidden="true">↗</span>
          </a>
          <button
            className="account-focus flex w-full items-center gap-2 py-2 text-left text-white/55 text-xs transition-colors hover:text-white"
            disabled={isLoggingOut}
            onClick={onLogout}
            type="button"
          >
            <LogOut size={15} />
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-50 flex border-[var(--account-border)] border-t bg-[var(--account-night)] px-3 pt-2 pb-[calc(0.45rem+var(--safe-area-inset-bottom))] lg:hidden">
        <nav aria-label="Account navigation" className="flex w-full items-stretch justify-around">
          {NAV_ITEMS.map((item) => (
            <NavButton
              active={activeTab === item.id}
              icon={item.icon}
              key={item.id}
              label={item.label}
              mobile
              onClick={navHandlers[item.id]}
            />
          ))}
          <button
            aria-label="Sign out"
            className="account-focus flex min-w-16 flex-1 flex-col items-center justify-center gap-1 px-3 py-2 text-[10px] text-white/55"
            disabled={isLoggingOut}
            onClick={onLogout}
            type="button"
          >
            <LogOut size={17} />
            {isLoggingOut ? "Signing out" : "Sign out"}
          </button>
        </nav>
      </div>
    </>
  );
}
