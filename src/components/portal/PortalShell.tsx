"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Bell, ChevronDown, ChevronRight, Circle, LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useReducer, useState } from "react";
import {
  PortalChromeProvider,
  type PortalNavShortcuts,
  usePortalChrome,
} from "@/components/portal/PortalChromeContext";
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

const ignoreAsyncError = (): void => undefined;

interface PortalAccess {
  allowed?: boolean;
  email?: string;
  name?: string;
  permissions?: string[];
  roles?: string[];
}

interface PortalUser {
  email?: string | null;
  name?: string | null;
}

interface NotificationItem {
  body?: string;
  entityId?: string;
  entityType?: string;
  id: string;
  readAt?: string | number | null;
  title?: string;
}

interface PortalNavItem {
  href: string;
  label: string;
  shortcutKey?: string;
}

interface PortalNavGroup {
  items: PortalNavItem[];
  label: string;
}

interface PortalNavState {
  collapsedShortcuts: Set<string>;
  expandedGroups: Set<string>;
  expandedShortcuts: Set<string>;
  saveDialogOpen: boolean;
  savingView: boolean;
}

type PortalNavAction =
  | { open: boolean; type: "saveDialogOpen" }
  | { saving: boolean; type: "savingView" }
  | { type: "expandedGroups"; value: Set<string> }
  | { type: "expandedShortcuts"; value: Set<string> }
  | { type: "collapsedShortcuts"; value: Set<string> }
  | {
      collapsedShortcuts: Set<string>;
      expandedShortcuts: Set<string>;
      type: "shortcutSets";
    };

interface NotificationListItemProps {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
}

interface PortalShellProps {
  access: PortalAccess;
  children: ReactNode;
  user?: PortalUser | null;
}

interface PortalNavProps {
  navGroups: PortalNavGroup[];
  navShortcuts?: PortalNavShortcuts;
  onNavigate?: () => void;
  pathname: string | null;
}

function readStoredSet(key: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value) => typeof value === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeStoredSet(key: string, valueSet: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify([...valueSet]));
  } catch {
    // ignore storage errors
  }
}

function createPortalNavState(): PortalNavState {
  return {
    collapsedShortcuts: readStoredSet(NAV_COLLAPSED_SHORTCUTS_STORAGE_KEY),
    expandedGroups: readStoredSet(NAV_EXPANDED_STORAGE_KEY),
    expandedShortcuts: readStoredSet(NAV_SHORTCUTS_STORAGE_KEY),
    saveDialogOpen: false,
    savingView: false,
  };
}

function portalNavReducer(state: PortalNavState, action: PortalNavAction): PortalNavState {
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
        collapsedShortcuts: action.collapsedShortcuts,
        expandedShortcuts: action.expandedShortcuts,
      };
    default:
      return state;
  }
}

const handleLogout = async () => {
  await logout();
  window.location.href = "/";
};

function NotificationListItem({ item, onClick }: NotificationListItemProps) {
  return (
    <button
      className="w-full border-brand-border border-b px-4 py-3 text-left transition-[background-color,transform] duration-150 ease-out last:border-b-0 hover:bg-brand-light active:scale-[0.96]"
      onClick={() => onClick(item)}
      type="button"
    >
      <div className="flex gap-2">
        <Circle
          className={
            item.readAt
              ? "mt-1.5 text-brand-muted/50"
              : "mt-1.5 fill-citius-orange text-citius-orange"
          }
          size={8}
        />
        <div>
          <div className="font-semibold text-sm">{item.title}</div>
          <div className="mt-1 text-brand-muted text-xs leading-5">{item.body}</div>
        </div>
      </div>
    </button>
  );
}

export default function PortalShell({ access, user, children }: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const notifications = useQuery(
    api.crm.activity.listNotifications,
    isAuthenticated && access.allowed ? { limit: 8 } : "skip"
  );
  const notificationSummary = useQuery(
    api.crm.activity.notificationSummary,
    isAuthenticated && access.allowed ? {} : "skip"
  );
  const navShortcuts = useQuery(
    api.crm.navShortcuts.list,
    isAuthenticated && access.allowed ? {} : "skip"
  ) as PortalNavShortcuts | undefined;
  const markNotificationRead = useMutation(api.crm.activity.markNotificationRead);
  const navGroups = getAccessibleNavGroups(access) as PortalNavGroup[];
  const notificationRows = (notifications ?? []) as NotificationItem[];
  const unreadCount =
    notificationSummary?.unreadCount ?? notificationRows.filter((item) => !item.readAt).length;

  const toggleNotifications = () => {
    setNotificationsOpen((open) => !open);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markNotificationRead({ notificationId: item.id }).catch(ignoreAsyncError);
    setNotificationsOpen(false);
    if (item.entityType && item.entityId) {
      router.push(
        getNotificationHref({
          entityId: item.entityId,
          entityType: item.entityType,
          title: item.title,
        })
      );
    }
  };

  return (
    <PortalToastProvider>
      <PortalConfirmProvider>
        <PortalChromeProvider navShortcuts={navShortcuts}>
          <div className="relative min-h-screen overflow-x-hidden bg-brand-light text-brand-dark">
            <a
              className={`sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 ${PORTAL_Z.skipLinkFocus} focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-citius-blue focus:text-sm focus:shadow-lg`}
              href="#portal-main"
            >
              Skip to main content
            </a>
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,42,131,0.08),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(245,130,32,0.06),transparent)]"
            />

            <m.header
              animate={{ opacity: 1, y: 0 }}
              className={`sticky top-0 ${PORTAL_Z.chrome} border-brand-border border-b bg-white/95 shadow-sm backdrop-blur-xl`}
              initial={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex h-16 items-center justify-between px-4 lg:px-6">
                <div className="flex items-center gap-3">
                  <button
                    aria-label="Open portal navigation"
                    className="rounded-full p-2 text-brand-dark transition-[background-color,transform] duration-150 ease-out hover:bg-brand-light active:scale-[0.96] lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                    type="button"
                  >
                    <Menu size={20} />
                  </button>
                  <Link className="flex items-center gap-3" href="/portal">
                    <Image
                      alt="Citius Connect"
                      className="h-9 w-auto sm:h-10"
                      height={CITIUS_CONNECT_LOGO_HEIGHT}
                      priority
                      src={ConnectLogo}
                      width={CITIUS_CONNECT_LOGO_WIDTH}
                    />
                  </Link>
                  <span className="inline-flex max-w-[120px] truncate rounded-full bg-citius-orange px-2 py-1 font-semibold text-[10px] text-white sm:max-w-none sm:px-3 sm:text-[11px] md:inline-flex">
                    {access.roles?.join(" / ") || "Staff"}
                  </span>
                </div>

                <div className="flex items-center gap-4 lg:gap-5">
                  <div className="flex items-center gap-5 rounded-full border border-brand-border bg-brand-light/70 py-1.5 pr-1.5 pl-5 md:gap-6 md:pl-6">
                    <div className="hidden min-w-0 md:block">
                      <div className="truncate font-semibold text-brand-dark text-sm">
                        {access.name || user?.name}
                      </div>
                      <div className="truncate text-[11px] text-brand-muted">
                        {access.email || user?.email}
                      </div>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        aria-label="Open notifications"
                        className="relative grid size-9 place-items-center rounded-full bg-white text-brand-muted shadow-sm transition-[color,transform] duration-150 ease-out hover:text-citius-blue active:scale-[0.96]"
                        onClick={toggleNotifications}
                        type="button"
                      >
                        <Bell size={17} />
                        {unreadCount > 0 && (
                          <m.span
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -top-1 -right-1 min-w-5 rounded-full bg-citius-orange px-1.5 text-center font-bold text-[10px] text-white tabular-nums leading-5 shadow-sm"
                            initial={{ opacity: 0, scale: 0.95 }}
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </m.span>
                        )}
                      </button>
                      <AnimatePresence>
                        {notificationsOpen && (
                          <>
                            <button
                              aria-label="Close notifications"
                              className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                              onClick={() => setNotificationsOpen(false)}
                              type="button"
                            />
                            <m.div
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              className={`absolute right-0 ${PORTAL_Z.dropdown} mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-brand-border bg-white text-brand-dark shadow-xl`}
                              exit={{ opacity: 0, scale: 0.96, y: 8 }}
                              initial={{ opacity: 0, scale: 0.96, y: 8 }}
                              transition={{ duration: 0.15 }}
                            >
                              <div className="flex items-center justify-between border-brand-border border-b px-4 py-3">
                                <div className="font-heading font-semibold text-citius-blue text-sm">
                                  Notifications
                                </div>
                                <ChevronDown className="text-brand-muted" size={16} />
                              </div>
                              <div className="max-h-80 overflow-y-auto">
                                {notificationRows.length === 0 ? (
                                  <div className="px-4 py-6 text-brand-muted text-sm">
                                    No notifications yet.
                                  </div>
                                ) : (
                                  notificationRows.map((item) => (
                                    <NotificationListItem
                                      item={item}
                                      key={item.id}
                                      onClick={handleNotificationClick}
                                    />
                                  ))
                                )}
                              </div>
                              <div className="border-brand-border border-t px-4 py-3">
                                <Link
                                  className="font-semibold text-citius-blue text-xs transition-colors duration-150 ease-out hover:text-citius-orange"
                                  href="/portal/activity"
                                  onClick={() => setNotificationsOpen(false)}
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
                      className="hidden rounded-full border border-brand-border bg-white px-4 py-2 font-medium text-brand-muted text-xs transition-[border-color,color,transform] duration-150 ease-out hover:border-citius-blue hover:text-citius-blue active:scale-[0.96] md:inline-flex"
                      href="/"
                    >
                      Back to site
                    </Link>
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-white px-4 py-2 font-semibold text-brand-dark text-xs transition-[border-color,color,transform] duration-150 ease-out hover:border-citius-blue hover:text-citius-blue active:scale-[0.96]"
                      onClick={handleLogout}
                      type="button"
                    >
                      <span className="hidden sm:inline">Sign Out</span>
                      <LogOut size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </m.header>

            <div className="flex min-h-[calc(100vh-64px)]">
              <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-64 shrink-0 flex-col overflow-hidden border-brand-border border-r bg-white/80 backdrop-blur-sm lg:flex">
                <PortalNav navGroups={navGroups} navShortcuts={navShortcuts} pathname={pathname} />
              </aside>

              <AnimatePresence>
                {sidebarOpen && (
                  <>
                    <m.button
                      animate={{ opacity: 1 }}
                      aria-label="Close portal navigation backdrop"
                      className={`fixed inset-0 ${PORTAL_Z.mobileBackdrop} bg-slate-950/60 backdrop-blur-sm lg:hidden`}
                      exit={{ opacity: 0 }}
                      initial={{ opacity: 0 }}
                      onClick={() => setSidebarOpen(false)}
                      type="button"
                    />
                    <m.aside
                      animate={{ x: 0 }}
                      className={`fixed inset-y-0 left-0 ${PORTAL_Z.mobileDrawer} flex w-[280px] flex-col bg-white shadow-2xl lg:hidden`}
                      exit={{ x: -280 }}
                      initial={{ x: -280 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="flex h-16 items-center justify-between border-brand-border border-b px-4">
                        <span className="font-heading text-citius-blue text-lg">Navigation</span>
                        <button
                          aria-label="Close portal navigation"
                          className="rounded-full p-2 text-brand-muted transition-[background-color,transform] duration-150 ease-out hover:bg-brand-light active:scale-[0.96]"
                          onClick={() => setSidebarOpen(false)}
                          type="button"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <PortalNav
                        navGroups={navGroups}
                        navShortcuts={navShortcuts}
                        onNavigate={() => setSidebarOpen(false)}
                        pathname={pathname}
                      />
                    </m.aside>
                  </>
                )}
              </AnimatePresence>

              <m.main
                animate={{ opacity: 1, y: 0 }}
                className="min-w-0 flex-1 p-4 md:p-8 lg:p-10"
                id="portal-main"
                initial={{ opacity: 0, y: 12 }}
                key={pathname}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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

function PortalNav({ navGroups, pathname, navShortcuts, onNavigate }: PortalNavProps) {
  const modShortcutLabel = useModShortcutLabel();
  const { savedViewActions } = usePortalChrome();
  const [navState, dispatchNavState] = useReducer(portalNavReducer, null, createPortalNavState);
  const { saveDialogOpen, savingView, expandedGroups, expandedShortcuts, collapsedShortcuts } =
    navState;

  const isGroupActive = (group: PortalNavGroup) =>
    group.items.some((item) =>
      item.href === "/portal" ? pathname === "/portal" : pathname?.startsWith(item.href)
    );

  const isGroupExpanded = (group: PortalNavGroup) => {
    if (group.items.length <= 1) {
      return true;
    }
    return expandedGroups.has(group.label) || isGroupActive(group);
  };

  const isShortcutsExpanded = (itemHref: string, active: boolean | undefined) => {
    if (collapsedShortcuts.has(itemHref)) {
      return false;
    }
    return expandedShortcuts.has(itemHref) || active;
  };

  const toggleGroup = (label: string) => {
    const next = new Set(expandedGroups);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    writeStoredSet(NAV_EXPANDED_STORAGE_KEY, next);
    dispatchNavState({ type: "expandedGroups", value: next });
  };

  const toggleShortcuts = (href: string, currentlyExpanded: boolean | undefined) => {
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
      collapsedShortcuts: nextCollapsed,
      expandedShortcuts: nextExpanded,
      type: "shortcutSets",
    });
  };

  const pinnedViews = (savedViewActions?.savedViews ?? [])
    .filter((view) => view.isFavorite)
    .slice(0, 5);
  const favoriteOverflow =
    (savedViewActions?.savedViews ?? []).filter((view) => view.isFavorite).length -
    pinnedViews.length;

  const handleSaveView = async (name: string, options?: Record<string, unknown>) => {
    if (!savedViewActions?.saveCurrentView) {
      return;
    }
    dispatchNavState({ saving: true, type: "savingView" });
    try {
      await savedViewActions.saveCurrentView(name, options);
      dispatchNavState({ saving: false, type: "savingView" });
    } catch (error) {
      dispatchNavState({ saving: false, type: "savingView" });
      throw error;
    }
  };

  return (
    <nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
      <div className="min-h-0 flex-1 scroll-pb-4 overflow-y-auto overscroll-contain pr-0.5 pb-4">
        {navGroups.map((group, groupIndex) => {
          const collapsible = group.items.length > 1;
          const groupExpanded = isGroupExpanded(group);

          return (
            <div className={groupIndex > 0 ? "mt-6" : ""} key={group.label}>
              {collapsible ? (
                <button
                  aria-expanded={groupExpanded}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 pb-2 text-left font-heading font-semibold text-citius-blue/70 text-xs transition-[color,transform] duration-150 ease-out hover:text-citius-blue active:scale-[0.96]"
                  onClick={() => toggleGroup(group.label)}
                  type="button"
                >
                  <span>{group.label}</span>
                  <ChevronRight
                    className={`transition-transform duration-150 ease-out ${groupExpanded ? "rotate-90" : ""}`}
                    size={14}
                  />
                </button>
              ) : (
                <div className="px-3 pb-2 font-heading font-semibold text-citius-blue/70 text-xs">
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
                      shortcuts.length - visibleShortcuts.length
                    );
                    const hasShortcuts = shortcuts.length > 0;
                    const shortcutsExpanded = isShortcutsExpanded(item.href, active);

                    return (
                      <div key={item.href}>
                        <div className="flex items-stretch gap-0.5">
                          <Link
                            className={`relative flex min-h-11 flex-1 items-center rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,transform] duration-150 ease-out ${
                              active
                                ? "bg-citius-blue/10 font-semibold text-citius-blue"
                                : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
                            } active:scale-[0.96]`}
                            href={item.href}
                            onClick={onNavigate}
                          >
                            {active && (
                              <m.span
                                className="absolute inset-y-1 left-0 w-1 rounded-full bg-citius-orange"
                                layoutId="portalNavActive"
                                transition={{ damping: 30, stiffness: 380, type: "spring" }}
                              />
                            )}
                            <span className="pl-2">{item.label}</span>
                          </Link>
                          {hasShortcuts && (
                            <button
                              aria-expanded={shortcutsExpanded}
                              aria-label={
                                shortcutsExpanded
                                  ? `Hide latest ${item.label}`
                                  : `Show latest ${item.label}`
                              }
                              className={`grid min-h-11 min-w-11 place-items-center rounded-xl text-brand-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-light hover:text-citius-blue active:scale-[0.96] ${
                                shortcutsExpanded ? "bg-brand-light text-citius-blue" : ""
                              }`}
                              onClick={() => toggleShortcuts(item.href, shortcutsExpanded)}
                              type="button"
                            >
                              <ChevronDown
                                className={`transition-transform duration-150 ease-out ${shortcutsExpanded ? "rotate-180" : ""}`}
                                size={16}
                              />
                            </button>
                          )}
                        </div>

                        {hasShortcuts && shortcutsExpanded && (
                          <div className="mt-0.5 ml-3 space-y-0.5 border-brand-border border-l pl-2">
                            {visibleShortcuts.map((shortcut) => (
                              <Link
                                className="block min-h-9 rounded-lg p-2 text-brand-muted text-xs leading-snug transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
                                href={shortcut.href}
                                key={shortcut.id}
                                onClick={onNavigate}
                                title={shortcut.label}
                              >
                                <span className="line-clamp-2">{shortcut.label}</span>
                              </Link>
                            ))}
                            {hiddenShortcutCount > 0 ? (
                              <Link
                                className="block min-h-9 rounded-lg p-2 font-semibold text-citius-blue text-xs transition-[color,transform] duration-150 ease-out hover:text-citius-orange active:scale-[0.96]"
                                href={item.href}
                                onClick={onNavigate}
                              >
                                Show all ({shortcuts.length})
                              </Link>
                            ) : (
                              <Link
                                className="block min-h-9 rounded-lg p-2 font-semibold text-citius-blue text-xs transition-[color,transform] duration-150 ease-out hover:text-citius-orange active:scale-[0.96]"
                                href={item.href}
                                onClick={onNavigate}
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
          <div className="mt-6 border-brand-border border-t pt-4">
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="font-heading font-semibold text-citius-blue/70 text-xs">Pinned</span>
              {savedViewActions?.saveCurrentView ? (
                <button
                  className="font-semibold text-[11px] text-citius-blue transition-colors duration-150 ease-out hover:text-citius-orange"
                  onClick={() => dispatchNavState({ open: true, type: "saveDialogOpen" })}
                  type="button"
                >
                  Save view
                </button>
              ) : null}
            </div>
            <div className="space-y-0.5">
              {pinnedViews.map((view) => (
                <div className="flex items-center gap-1 rounded-lg px-2 py-1" key={view.id}>
                  <button
                    className="min-h-9 flex-1 truncate rounded-md px-2 py-1.5 text-left text-brand-muted text-xs transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
                    onClick={() => savedViewActions?.applySavedView?.(view)}
                    title={view.name}
                    type="button"
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

      <div className="shrink-0 border-brand-border border-t bg-white/80 pt-3 backdrop-blur-sm">
        <p className="px-3 pb-1 text-[11px] text-brand-muted">
          Press{" "}
          <kbd className="rounded border border-brand-border/80 bg-brand-light/80 px-1 font-sans text-[10px]">
            {modShortcutLabel}
          </kbd>{" "}
          for commands
        </p>
      </div>

      <SaveViewDialog
        onClose={() => dispatchNavState({ open: false, type: "saveDialogOpen" })}
        onSave={handleSaveView}
        open={saveDialogOpen}
        saving={savingView}
      />
    </nav>
  );
}
