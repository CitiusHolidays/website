"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  ChevronDown,
  Circle,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth-client";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";
import { api } from "@convex/_generated/api";
import Logo from "@/static/logos/logo.webp";

export default function PortalShell({ access, user, children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const notifications = useQuery(
    api.crm.activity.listNotifications,
    isAuthenticated && access?.allowed ? { limit: 8 } : "skip",
  );
  const markAllNotificationsRead = useMutation(api.crm.activity.markAllNotificationsRead);
  const navGroups = useMemo(() => getAccessibleNavGroups(access), [access]);
  const unreadCount = (notifications || []).filter((item) => !item.readAt).length;

  const toggleNotifications = () => {
    setNotificationsOpen((open) => {
      if (!open) {
        markAllNotificationsRead({}).catch(() => {});
      }
      return !open;
    });
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-brand-light text-brand-dark">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,42,131,0.08),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(245,130,32,0.06),transparent)]"
      />

      <motion.header
        className="sticky top-0 z-40 border-b border-brand-border bg-white/95 shadow-sm backdrop-blur-xl"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-full p-2 text-brand-dark transition hover:bg-brand-light lg:hidden"
              aria-label="Open portal navigation"
            >
              <Menu size={20} />
            </button>
            <Link href="/portal" className="flex items-center gap-3">
              <Image
                src={Logo}
                alt="Citius Holidays"
                width={110}
                height={36}
                className="h-8 w-auto"
                priority
              />
              <span className="hidden h-5 w-px bg-brand-border sm:block" />
              <span className="hidden font-heading text-sm font-semibold tracking-wide text-citius-blue sm:inline">
                Staff Portal
              </span>
            </Link>
            <span className="hidden rounded-full bg-citius-orange px-3 py-1 text-[11px] font-semibold text-white md:inline-flex">
              {access.roles?.join(" / ") || "Staff"}
            </span>
          </div>

          <div className="flex items-center gap-4 lg:gap-5">
            <div className="flex items-center gap-5 rounded-full border border-brand-border bg-brand-light/70 py-1.5 pl-5 pr-1.5 md:gap-6 md:pl-6">
              <div className="hidden min-w-0 md:block">
                <div className="truncate text-sm font-semibold text-brand-dark">
                  {access.name || user?.name}
                </div>
                <div className="truncate text-[11px] text-brand-muted">
                  {access.email || user?.email}
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={toggleNotifications}
                  className="relative grid h-9 w-9 place-items-center rounded-full bg-white text-brand-muted shadow-sm transition hover:text-citius-blue"
                  aria-label="Open notifications"
                >
                  <Bell size={17} />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 min-w-5 rounded-full bg-citius-orange px-1.5 text-center text-[10px] font-bold leading-5 text-white"
                    >
                      {unreadCount}
                    </motion.span>
                  )}
                </button>
                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-brand-border bg-white text-brand-dark shadow-xl"
                    >
                      <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
                        <div className="font-heading text-sm font-semibold text-citius-blue">
                          Notifications
                        </div>
                        <ChevronDown size={16} className="text-brand-muted" />
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {(notifications || []).length === 0 ? (
                          <div className="px-4 py-6 text-sm text-brand-muted">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <div
                              key={item.id}
                              className="border-b border-brand-border px-4 py-3 last:border-b-0"
                            >
                              <div className="flex gap-2">
                                <Circle
                                  size={8}
                                  className={
                                    item.readAt
                                      ? "mt-1.5 text-brand-muted/50"
                                      : "mt-1.5 fill-citius-orange text-citius-orange"
                                  }
                                />
                                <div>
                                  <div className="text-sm font-semibold">{item.title}</div>
                                  <div className="mt-1 text-xs leading-5 text-brand-muted">
                                    {item.body}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <span aria-hidden className="hidden h-8 w-px bg-brand-border md:block" />

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="hidden rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-medium text-brand-muted transition hover:border-citius-blue hover:text-citius-blue md:inline-flex"
              >
                Back to site
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-semibold text-brand-dark transition hover:border-citius-blue hover:text-citius-blue"
              >
                <span className="hidden sm:inline">Sign Out</span>
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex min-h-[calc(100vh-64px)]">
        <aside className="hidden w-64 shrink-0 border-r border-brand-border bg-white/80 backdrop-blur-sm lg:block">
          <PortalNav navGroups={navGroups} pathname={pathname} />
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close portal navigation backdrop"
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-y-0 left-0 z-[60] w-[280px] bg-white shadow-2xl lg:hidden"
              >
                <div className="flex h-16 items-center justify-between border-b border-brand-border px-4">
                  <span className="font-heading text-lg text-citius-blue">Navigation</span>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="rounded-full p-2 text-brand-muted hover:bg-brand-light"
                    aria-label="Close portal navigation"
                  >
                    <X size={20} />
                  </button>
                </div>
                <PortalNav
                  navGroups={navGroups}
                  pathname={pathname}
                  onNavigate={() => setSidebarOpen(false)}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 flex-1 p-4 md:p-8 lg:p-10"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

function PortalNav({ navGroups, pathname, onNavigate }) {
  return (
    <nav className="sticky top-16 h-[calc(100vh-64px)] overflow-y-auto px-3 py-5">
      {navGroups.map((group, groupIndex) => (
        <div key={group.label} className={groupIndex > 0 ? "mt-6" : ""}>
          <div className="px-3 pb-2 font-heading text-xs font-semibold text-citius-blue/70">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/portal"
                  ? pathname === "/portal"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`relative flex items-center rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-citius-blue/10 font-semibold text-citius-blue"
                      : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="portalNavActive"
                      className="absolute inset-y-1 left-0 w-1 rounded-full bg-citius-orange"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="pl-2">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
