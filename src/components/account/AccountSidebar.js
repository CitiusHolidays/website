"use client";

import { ChevronDown, House, LogOut, MapIcon, Settings, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { PortalActionMenu, PortalActionMenuItem } from "@/components/portal/PortalActionMenu";
import { Button } from "@/components/ui/application-button";
import { AccountMark, NavButton } from "./AccountUi";

const NAV_ITEMS = [
  { icon: <MapIcon size={17} />, id: "journeys", label: "Journeys" },
  { icon: <UserRound size={17} />, id: "profile", label: "Profile" },
  { icon: <Settings size={17} />, id: "settings", label: "Settings" },
];

const ACCOUNT_MENU_STYLE = {
  "--account-border": "var(--color-brand-border)",
  "--account-gold": "var(--color-public-orange-ink)",
  "--account-ink": "var(--color-public-ink)",
  "--account-muted": "var(--color-public-muted)",
  "--account-paper": "var(--color-public-paper)",
  "--account-surface": "var(--color-public-surface)",
};

export function AccountControl({ user, onLogout, isLoggingOut, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const initials = (user?.name || user?.email || "T").slice(0, 1).toUpperCase();
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const renderTrigger = useCallback(
    (props) => (
      <Button
        {...props}
        aria-label={props["aria-expanded"] ? "Close account menu" : "Open account menu"}
        className={`flex min-h-0 items-center gap-2 rounded-full ${compact ? "p-0.5" : "border border-[var(--account-border)] bg-[var(--account-surface)] px-2 py-1.5"}`}
        surface="account"
        type="button"
      >
        {user?.image ? (
          <Image
            alt={`${user.name || "Account"} profile photo`}
            className="size-8 rounded-full object-cover"
            height={32}
            src={user.image}
            width={32}
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--account-night)] font-medium text-sm text-white">
            {initials}
          </span>
        )}
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
      </Button>
    ),
    [compact, initials, user]
  );

  return (
    <PortalActionMenu
      aria-label="Account menu"
      contentClassName=""
      header={
        <>
          <p className="truncate font-medium text-[var(--account-ink)] text-sm">
            {user?.name || "Your account"}
          </p>
          <p className="mt-0.5 truncate text-[var(--account-muted)] text-xs">{user?.email}</p>
        </>
      }
      headerClassName="border-[var(--account-border)] border-b px-2 pb-3"
      menuClassName="w-60 rounded-xl border-[var(--account-border)] bg-[var(--account-surface)] p-3 shadow-xl"
      menuStyle={ACCOUNT_MENU_STYLE}
      motionEasing="cubic-bezier(0.16, 1, 0.3, 1)"
      onOpenChange={setIsOpen}
      open={isOpen}
      sideOffset={9.6}
      trigger={renderTrigger}
    >
      <Link
        className="account-focus mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-[var(--account-ink)] text-xs hover:bg-[var(--account-paper)]"
        href="/"
        onClick={closeMenu}
        role="menuitem"
      >
        <House size={15} />
        Back to main site
      </Link>
      <PortalActionMenuItem
        closeOnClick={false}
        disabled={isLoggingOut}
        label={isLoggingOut ? "Signing out…" : "Sign out"}
      >
        <Button
          className="flex min-h-0 w-full items-center justify-start gap-2 rounded-lg px-2 py-2 text-left text-[var(--account-ink)] text-xs hover:bg-[var(--account-paper)] disabled:opacity-100"
          loading={isLoggingOut}
          onClick={onLogout}
          role="menuitem"
          surface="account"
          type="button"
        >
          <LogOut size={15} />
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </Button>
      </PortalActionMenuItem>
    </PortalActionMenu>
  );
}

export function AccountHeader({ activeTab, onTabChange, onLogout, isLoggingOut, user }) {
  const navHandlers = {
    journeys: () => onTabChange("journeys"),
    profile: () => onTabChange("profile"),
    settings: () => onTabChange("settings"),
  };

  return (
    <>
      <header className="material-structural sticky top-0 z-40 border-[var(--account-border)] border-b bg-[color-mix(in_srgb,var(--account-surface)_94%,transparent)] backdrop-blur-xl">
        <div className="mx-auto grid min-h-20 max-w-[1440px] grid-cols-[1fr_auto] items-center px-5 sm:px-8 md:grid-cols-[1fr_auto_1fr] lg:px-12">
          <AccountMark />
          <nav aria-label="Account navigation" className="hidden h-20 items-stretch md:flex">
            {NAV_ITEMS.map((item) => (
              <NavButton
                active={activeTab === item.id}
                header
                icon={item.icon}
                key={item.id}
                label={item.label}
                onClick={navHandlers[item.id]}
              />
            ))}
          </nav>
          <div className="justify-self-end">
            <AccountControl compact isLoggingOut={isLoggingOut} onLogout={onLogout} user={user} />
          </div>
        </div>
      </header>

      <div className="fixed inset-x-0 bottom-0 z-50 flex border-[var(--account-border)] border-t bg-[var(--account-night)] px-3 pt-2 pb-[calc(0.45rem+var(--safe-area-inset-bottom))] md:hidden">
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

// Preserve the old export for focused consumers while the component is now a header.
export const AccountSidebar = AccountHeader;
