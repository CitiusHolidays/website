"use client";

import { ChevronDown, LogOut, MapIcon, Menu, Settings, UserRound, X } from "lucide-react";
import { useCallback, useState } from "react";
import { AccountMark, NavButton } from "./AccountUi";

const NAV_ITEMS = [
  { icon: <MapIcon size={17} />, id: "journeys", label: "Journeys" },
  { icon: <UserRound size={17} />, id: "profile", label: "Profile" },
  { icon: <Settings size={17} />, id: "settings", label: "Settings" },
];

export function AccountControl({ user, onLogout, isLoggingOut, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const initials = (user?.name || user?.email || "T").slice(0, 1).toUpperCase();
  const toggleMenu = useCallback(() => setIsOpen((value) => !value), []);

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isOpen ? "Close account menu" : "Open account menu"}
        className={`account-focus flex items-center gap-2 rounded-full ${compact ? "p-0.5" : "border border-[var(--account-border)] bg-[var(--account-surface)] px-2 py-1.5"}`}
        onClick={toggleMenu}
        type="button"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--account-night)] font-medium text-sm text-white">
          {initials}
        </span>
        {!compact && (
          <span className="hidden max-w-36 truncate text-[var(--account-ink)] text-xs sm:block">
            {user?.name || user?.email || "Account"}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className="text-[var(--account-muted)]"
          size={14}
          strokeWidth={1.6}
        />
      </button>
      {isOpen ? (
        <div
          className="absolute top-[calc(100%+0.6rem)] right-0 z-50 w-60 rounded-sm border border-[var(--account-border)] bg-[var(--account-surface)] p-3 shadow-xl"
          role="menu"
        >
          <p className="truncate px-2 pb-3 text-[var(--account-muted)] text-xs">{user?.email}</p>
          <button
            className="account-focus flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-[var(--account-ink)] text-xs hover:bg-[var(--account-paper)]"
            disabled={isLoggingOut}
            onClick={onLogout}
            role="menuitem"
            type="button"
          >
            <LogOut size={15} />
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AccountSidebar({ activeTab, onTabChange, onLogout, isLoggingOut, user }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen((value) => !value), []);
  const navHandlers = {
    journeys: () => {
      onTabChange("journeys");
      setIsMobileMenuOpen(false);
    },
    profile: () => {
      onTabChange("profile");
      setIsMobileMenuOpen(false);
    },
    settings: () => {
      onTabChange("settings");
      setIsMobileMenuOpen(false);
    },
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col bg-[var(--account-night)] px-6 py-8 text-white lg:flex">
        <AccountMark />
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
            className="account-focus mb-5 block text-[var(--account-gold-on-night)] text-xs hover:text-white"
            href="mailto:hello@citiusholidays.com"
          >
            Speak with our team <span aria-hidden="true">↗</span>
          </a>
        </div>
      </aside>

      <header className="relative z-50 flex items-center justify-between bg-[var(--account-night)] px-5 py-3.5 text-white lg:hidden">
        <button
          aria-expanded={isMobileMenuOpen}
          aria-label={isMobileMenuOpen ? "Close account menu" : "Open account menu"}
          className="account-focus flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          onClick={toggleMobileMenu}
          type="button"
        >
          {isMobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
        <AccountMark compact />
        <AccountControl compact isLoggingOut={isLoggingOut} onLogout={onLogout} user={user} />
        {isMobileMenuOpen ? (
          <div className="absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-sm border border-white/10 bg-[var(--account-night)] p-4 text-white shadow-xl">
            <p className="text-white/60 text-xs">Need a hand with your journey?</p>
            <a
              className="account-focus mt-2 inline-block text-[var(--account-gold-on-night)] text-xs hover:text-white"
              href="mailto:hello@citiusholidays.com"
            >
              Speak with our team <span aria-hidden="true">↗</span>
            </a>
          </div>
        ) : null}
      </header>

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
        </nav>
      </div>
    </>
  );
}
