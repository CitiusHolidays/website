"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bell, ChevronDown, ChevronRight, Circle, LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useReducer, useState } from "react";
import { PortalChromeProvider, usePortalChrome } from "@/components/portal/PortalChromeContext";
import { PortalConfirmProvider } from "@/components/portal/PortalConfirmDialog";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import SaveViewDialog from "@/components/portal/SaveViewDialog";
import { logout } from "@/lib/auth-client";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";
import { useModShortcutLabel } from "@/lib/portal/shortcutLabels";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import ConnectLogo from "@/static/logos/citiusconnect.png";

const NAV_EXPANDED_STORAGE_KEY = "portal-nav-expanded-groups";
const NAV_SHORTCUTS_STORAGE_KEY = "portal-nav-expanded-shortcuts";
const NAV_COLLAPSED_SHORTCUTS_STORAGE_KEY = "portal-nav-collapsed-shortcuts";

function readStoredSet(key) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function writeStoredSet(key, valueSet) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...valueSet]));
  } catch {
    // ignore storage errors
  }
}

function createPortalNavState() {
  return {
    saveDialogOpen: false,
    savingView: false,
    expandedGroups: readStoredSet(NAV_EXPANDED_STORAGE_KEY),
    expandedShortcuts: readStoredSet(NAV_SHORTCUTS_STORAGE_KEY),
    collapsedShortcuts: readStoredSet(NAV_COLLAPSED_SHORTCUTS_STORAGE_KEY),
  };
}

function portalNavReducer(state, action) {
  switch (action.type) {
    case "saveDialogOpen":
      return { ...state, saveDialogOpen: action.open };
    case "savingView":
      return { ...state, savingView: action.saving };
    case "expandedGroups":
      return { ...state, expandedGroups: action.value };
    case "expandedShortcuts":
      return { ...state, expandedShortcuts: action.value };
    case "collapsedShortcuts":
      return { ...state, collapsedShortcuts: action.value };
    case "shortcutSets":
      return {
        ...state,
        expandedShortcuts: action.expandedShortcuts,
        collapsedShortcuts: action.collapsedShortcuts,
      };
    default:
      return state;
  }
}

const handleLogout = async () => {
  await logout();
  window.location.href = "/";
};

function NotificationListItem({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="w-full border-b border-brand-border px-4 py-3 text-left transition-[background-color,transform] duration-150 ease-out last:border-b-0 hover:bg-brand-light active:scale-[0.96]"
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
          <div className="mt-1 text-xs leading-5 text-brand-muted">{item.body}</div>
        </div>
      </div>
    </button>
  );
}

export default function PortalShell({ access, user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const notifications = useQuery(
    api.crm.activity.listNotifications,
    isAuthenticated && access?.allowed ? { limit: 8 } : "skip",
  );
  const notificationSummary = useQuery(
    api.crm.activity.notificationSummary,
    isAuthenticated && access?.allowed ? {} : "skip",
  );
  const navShortcuts = useQuery(
    api.crm.navShortcuts.list,
    isAuthenticated && access?.allowed ? {} : "skip",
  );
  const markNotificationRead = useMutation(api.crm.activity.markNotificationRead);
  const navGroups = getAccessibleNavGroups(access);
  const unreadCount =
    notificationSummary?.unreadCount ?? (notifications || []).filter((item) => !item.readAt).length;

  const toggleNotifications = () => {
    setNotificationsOpen((open) => !open);
  };

  const handleNotificationClick = async (item) => {
    markNotificationRead({ notificationId: item.id }).catch(() => {});
    setNotificationsOpen(false);
    if (item.entityType && item.entityId) {
      router.push(
        getNotificationHref({
          entityType: item.entityType,
          entityId: item.entityId,
          title: item.title,
        }),
      );
    }
  };

  return (
    <PortalToastProvider>
      <PortalConfirmProvider>
        <PortalChromeProvider navShortcuts={navShortcuts}>
          <div className="relative min-h-screen overflow-x-hidden bg-brand-light text-brand-dark">
            <a
              href="#portal-main"
              className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 ${PORTAL_Z.skipLinkFocus} focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-citius-blue focus:shadow-lg`}
            >
              Skip to main content
            </a>
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,42,131,0.08),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(245,130,32,0.06),transparent)]"
            />

            <m.header
              className={`sticky top-0 ${PORTAL_Z.chrome} border-b border-brand-border bg-white/95 shadow-sm backdrop-blur-xl`}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex h-16 items-center justify-between px-4 lg:px-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="rounded-full p-2 text-brand-dark transition-[background-color,transform] duration-150 ease-out hover:bg-brand-light active:scale-[0.96] lg:hidden"
                    aria-label="Open portal navigation"
                  >
                    <Menu size={20} />
                  </button>
                  <Link href="/portal" className="flex items-center gap-3">
                    <Image
                      src={ConnectLogo}
                      alt="Citius Connect"
                      width={CITIUS_CONNECT_LOGO_WIDTH}
                      height={CITIUS_CONNECT_LOGO_HEIGHT}
                      className="h-9 w-auto sm:h-10"
                      priority
                    />
                  </Link>
                  <span className="inline-flex max-w-[120px] truncate rounded-full bg-citius-orange px-2 py-1 text-[10px] font-semibold text-white sm:max-w-none sm:px-3 sm:text-[11px] md:inline-flex">
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
                        className="relative grid size-9 place-items-center rounded-full bg-white text-brand-muted shadow-sm transition-[color,transform] duration-150 ease-out hover:text-citius-blue active:scale-[0.96]"
                        aria-label="Open notifications"
                      >
                        <Bell size={17} />
                        {unreadCount > 0 && (
                          <m.span
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute -right-1 -top-1 min-w-5 rounded-full bg-citius-orange px-1.5 text-center text-[10px] font-bold leading-5 text-white tabular-nums shadow-sm"
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </m.span>
                        )}
                      </button>
                      <AnimatePresence>
                        {notificationsOpen && (
                          <>
                            <button
                              type="button"
                              className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                              aria-label="Close notifications"
                              onClick={() => setNotificationsOpen(false)}
                            />
                            <m.div
                              initial={{ opacity: 0, y: 8, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.96 }}
                              transition={{ duration: 0.15 }}
                              className={`absolute right-0 ${PORTAL_Z.dropdown} mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-brand-border bg-white text-brand-dark shadow-xl`}
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
                                    <NotificationListItem
                                      key={item.id}
                                      item={item}
                                      onClick={handleNotificationClick}
                                    />
                                  ))
                                )}
                              </div>
                              <div className="border-t border-brand-border px-4 py-3">
                                <Link
                                  href="/portal/activity"
                                  onClick={() => setNotificationsOpen(false)}
                                  className="text-xs font-semibold text-citius-blue transition-colors duration-150 ease-out hover:text-citius-orange"
                                >
                                  View all notifications
                                </Link>
                              </div>
                            </m.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <span aria-hidden className="hidden h-8 w-px bg-brand-border md:block" />

                  <div className="flex items-center gap-3">
                    <Link
                      href="/"
                      className="hidden rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-medium text-brand-muted transition-[border-color,color,transform] duration-150 ease-out hover:border-citius-blue hover:text-citius-blue active:scale-[0.96] md:inline-flex"
                    >
                      Back to site
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-white px-4 py-2 text-xs font-semibold text-brand-dark transition-[border-color,color,transform] duration-150 ease-out hover:border-citius-blue hover:text-citius-blue active:scale-[0.96]"
                    >
                      <span className="hidden sm:inline">Sign Out</span>
                      <LogOut size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </m.header>

            <div className="flex min-h-[calc(100vh-64px)]">
              <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-64 shrink-0 flex-col overflow-hidden border-r border-brand-border bg-white/80 backdrop-blur-sm lg:flex">
                <PortalNav navGroups={navGroups} pathname={pathname} navShortcuts={navShortcuts} />
              </aside>

              <AnimatePresence>
                {sidebarOpen && (
                  <>
                    <m.button
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`fixed inset-0 ${PORTAL_Z.mobileBackdrop} bg-slate-950/60 backdrop-blur-sm lg:hidden`}
                      onClick={() => setSidebarOpen(false)}
                      aria-label="Close portal navigation backdrop"
                    />
                    <m.aside
                      initial={{ x: -280 }}
                      animate={{ x: 0 }}
                      exit={{ x: -280 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={`fixed inset-y-0 left-0 ${PORTAL_Z.mobileDrawer} flex w-[280px] flex-col bg-white shadow-2xl lg:hidden`}
                    >
                      <div className="flex h-16 items-center justify-between border-b border-brand-border px-4">
                        <span className="font-heading text-lg text-citius-blue">Navigation</span>
                        <button
                          type="button"
                          onClick={() => setSidebarOpen(false)}
                          className="rounded-full p-2 text-brand-muted transition-[background-color,transform] duration-150 ease-out hover:bg-brand-light active:scale-[0.96]"
                          aria-label="Close portal navigation"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <PortalNav
                        navGroups={navGroups}
                        pathname={pathname}
                        navShortcuts={navShortcuts}
                        onNavigate={() => setSidebarOpen(false)}
                      />
                    </m.aside>
                  </>
                )}
              </AnimatePresence>

              <m.main
                id="portal-main"
                key={pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="min-w-0 flex-1 p-4 md:p-8 lg:p-10"
              >
                {children}
              </m.main>
            </div>
          </div>
        </PortalChromeProvider>
      </PortalConfirmProvider>
    </PortalToastProvider>
  );
}

function PortalNav({ navGroups, pathname, navShortcuts, onNavigate }) {
  const modShortcutLabel = useModShortcutLabel();
  const { savedViewActions } = usePortalChrome();
  const [navState, dispatchNavState] = useReducer(portalNavReducer, null, createPortalNavState);
  const {
    saveDialogOpen,
    savingView,
    expandedGroups,
    expandedShortcuts,
    collapsedShortcuts,
  } = navState;

  const isGroupActive = (group) => {
    return group.items.some((item) =>
      item.href === "/portal" ? pathname === "/portal" : pathname?.startsWith(item.href),
    );
  };

  const isGroupExpanded = (group) => {
    if (group.items.length <= 1) return true;
    return expandedGroups.has(group.label) || isGroupActive(group);
  };

  const isShortcutsExpanded = (itemHref, active) => {
    if (collapsedShortcuts.has(itemHref)) {
      return false;
    }
    return expandedShortcuts.has(itemHref) || active;
  };

  const toggleGroup = (label) => {
    const next = new Set(expandedGroups);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    writeStoredSet(NAV_EXPANDED_STORAGE_KEY, next);
    dispatchNavState({ type: "expandedGroups", value: next });
  };

  const toggleShortcuts = (href, currentlyExpanded) => {
    const nextCollapsed = new Set(collapsedShortcuts);
    const nextExpanded = new Set(expandedShortcuts);
    if (currentlyExpanded) {
      nextCollapsed.add(href);
      nextExpanded.delete(href);
    } else {
      nextCollapsed.delete(href);
      nextExpanded.add(href);
    }
    writeStoredSet(NAV_COLLAPSED_SHORTCUTS_STORAGE_KEY, nextCollapsed);
    writeStoredSet(NAV_SHORTCUTS_STORAGE_KEY, nextExpanded);
    dispatchNavState({
      type: "shortcutSets",
      collapsedShortcuts: nextCollapsed,
      expandedShortcuts: nextExpanded,
    });
  };

  const pinnedViews = (savedViewActions?.savedViews ?? [])
    .filter((view) => view.isFavorite)
    .slice(0, 5);
  const favoriteOverflow =
    (savedViewActions?.savedViews ?? []).filter((view) => view.isFavorite).length -
    pinnedViews.length;

  const handleSaveView = async (name, options) => {
    if (!savedViewActions?.saveCurrentView) return;
    dispatchNavState({ type: "savingView", saving: true });
    try {
      await savedViewActions.saveCurrentView(name, options);
      dispatchNavState({ type: "savingView", saving: false });
    } catch (error) {
      dispatchNavState({ type: "savingView", saving: false });
      throw error;
    }
  };

  return (
    <nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
      <div className="min-h-0 flex-1 scroll-pb-4 overflow-y-auto overscroll-contain pb-4 pr-0.5">
        {navGroups.map((group, groupIndex) => {
          const collapsible = group.items.length > 1;
          const groupExpanded = isGroupExpanded(group);

          return (
            <div key={group.label} className={groupIndex > 0 ? "mt-6" : ""}>
              {collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 pb-2 text-left font-heading text-xs font-semibold text-citius-blue/70 transition-[color,transform] duration-150 ease-out hover:text-citius-blue active:scale-[0.96]"
                  aria-expanded={groupExpanded}
                >
                  <span>{group.label}</span>
                  <ChevronRight
                    size={14}
                    className={`transition-transform duration-150 ease-out ${groupExpanded ? "rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <div className="px-3 pb-2 font-heading text-xs font-semibold text-citius-blue/70">
                  {group.label}
                </div>
              )}

              {groupExpanded && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      item.href === "/portal"
                        ? pathname === "/portal"
                        : pathname?.startsWith(item.href);
                    const shortcuts = item.shortcutKey
                      ? (navShortcuts?.[item.shortcutKey] ?? [])
                      : [];
                    const visibleShortcuts = shortcuts.slice(0, 3);
                    const hiddenShortcutCount = Math.max(
                      0,
                      shortcuts.length - visibleShortcuts.length,
                    );
                    const hasShortcuts = shortcuts.length > 0;
                    const shortcutsExpanded = isShortcutsExpanded(item.href, active);

                    return (
                      <div key={item.href}>
                        <div className="flex items-stretch gap-0.5">
                          <Link
                            href={item.href}
                            onClick={onNavigate}
                            className={`relative flex min-h-11 flex-1 items-center rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,transform] duration-150 ease-out ${
                              active
                                ? "bg-citius-blue/10 font-semibold text-citius-blue"
                                : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
                            } active:scale-[0.96]`}
                          >
                            {active && (
                              <m.span
                                layoutId="portalNavActive"
                                className="absolute inset-y-1 left-0 w-1 rounded-full bg-citius-orange"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}
                            <span className="pl-2">{item.label}</span>
                          </Link>
                          {hasShortcuts && (
                            <button
                              type="button"
                              onClick={() => toggleShortcuts(item.href, shortcutsExpanded)}
                              className={`grid min-h-11 min-w-11 place-items-center rounded-xl text-brand-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-light hover:text-citius-blue active:scale-[0.96] ${
                                shortcutsExpanded ? "bg-brand-light text-citius-blue" : ""
                              }`}
                              aria-expanded={shortcutsExpanded}
                              aria-label={
                                shortcutsExpanded
                                  ? `Hide latest ${item.label}`
                                  : `Show latest ${item.label}`
                              }
                            >
                              <ChevronDown
                                size={16}
                                className={`transition-transform duration-150 ease-out ${shortcutsExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                        </div>

                        {hasShortcuts && shortcutsExpanded && (
                          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-brand-border pl-2">
                            {visibleShortcuts.map((shortcut) => (
                              <Link
                                key={shortcut.id}
                                href={shortcut.href}
                                onClick={onNavigate}
                                className="block min-h-9 rounded-lg p-2 text-xs leading-snug text-brand-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
                                title={shortcut.label}
                              >
                                <span className="line-clamp-2">{shortcut.label}</span>
                              </Link>
                            ))}
                            {hiddenShortcutCount > 0 ? (
                              <Link
                                href={item.href}
                                onClick={onNavigate}
                                className="block min-h-9 rounded-lg p-2 text-xs font-semibold text-citius-blue transition-[color,transform] duration-150 ease-out hover:text-citius-orange active:scale-[0.96]"
                              >
                                Show all ({shortcuts.length})
                              </Link>
                            ) : (
                              <Link
                                href={item.href}
                                onClick={onNavigate}
                                className="block min-h-9 rounded-lg p-2 text-xs font-semibold text-citius-blue transition-[color,transform] duration-150 ease-out hover:text-citius-orange active:scale-[0.96]"
                              >
                                View all
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {pinnedViews.length > 0 ? (
          <div className="mt-6 border-t border-brand-border pt-4">
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="font-heading text-xs font-semibold text-citius-blue/70">Pinned</span>
              {savedViewActions?.saveCurrentView ? (
                <button
                  type="button"
                  onClick={() => dispatchNavState({ type: "saveDialogOpen", open: true })}
                  className="text-[11px] font-semibold text-citius-blue transition-colors duration-150 ease-out hover:text-citius-orange"
                >
                  Save view
                </button>
              ) : null}
            </div>
            <div className="space-y-0.5">
              {pinnedViews.map((view) => (
                <div key={view.id} className="flex items-center gap-1 rounded-lg px-2 py-1">
                  <button
                    type="button"
                    onClick={() => savedViewActions?.applySavedView?.(view)}
                    className="min-h-9 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs text-brand-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
                    title={view.name}
                  >
                    {view.name}
                  </button>
                </div>
              ))}
              {favoriteOverflow > 0 ? (
                <p className="px-3 pt-1 text-[11px] text-brand-muted">
                  +{favoriteOverflow} more in {modShortcutLabel} palette
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-brand-border bg-white/80 pt-3 backdrop-blur-sm">
        <p className="px-3 pb-1 text-[11px] text-brand-muted">
          Press{" "}
          <kbd className="rounded border border-brand-border/80 bg-brand-light/80 px-1 font-sans text-[10px]">
            {modShortcutLabel}
          </kbd>{" "}
          for commands
        </p>
      </div>

      <SaveViewDialog
        open={saveDialogOpen}
        onClose={() => dispatchNavState({ type: "saveDialogOpen", open: false })}
        onSave={handleSaveView}
        saving={savingView}
      />
    </nav>
  );
}
