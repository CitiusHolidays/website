"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  LogOut,
  Menu,
  Plus,
  X,
} from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PortalAccountAvatar } from "@/components/portal/PortalAccountAvatar";
import { PortalChromeProvider } from "@/components/portal/PortalChromeContext";
import { PortalConfirmProvider } from "@/components/portal/PortalConfirmDialog";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import { type PortalNavShortcuts, usePortalChrome } from "@/components/portal/portalChromeState";
import SaveViewDialog from "@/components/portal/SaveViewDialog";
import { logout } from "@/lib/auth-client";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";
import {
  getPortalNavPreferencesSnapshot,
  getPortalNavServerSnapshot,
  subscribePortalNavPreferences,
  updatePortalNavPreference,
} from "@/lib/portal/portalNavPersistence";
import { getCompactRoleLabel, getMobileQuickNavigation } from "@/lib/portal/portalNavPresentation";
import { useModShortcutLabel } from "@/lib/portal/shortcutLabels";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import ConnectLogo from "@/static/logos/citiusconnect.png";

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
  image?: string | null;
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
  saveDialogOpen: boolean;
  savingView: boolean;
}

type PortalNavAction =
  | { open: boolean; type: "saveDialogOpen" }
  | { saving: boolean; type: "savingView" };

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
  mobile?: boolean;
  navGroups: PortalNavGroup[];
  navShortcuts?: PortalNavShortcuts;
  onNavigate?: () => void;
  pathname: string | null;
}

function createPortalNavState(): PortalNavState {
  return {
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
      className="w-full border-brand-border border-b px-4 py-3 text-left transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] last:border-b-0 hover:bg-brand-light active:scale-[0.96]"
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

interface MobileQuickAccessProps {
  action?: {
    label: string;
    run: () => void;
  } | null;
  items: PortalNavItem[];
  onNavigate?: () => void;
  pathname: string | null;
}

function MobileQuickAccess({ action, items, onNavigate, pathname }: MobileQuickAccessProps) {
  if (items.length === 0 && !action) {
    return null;
  }

  return (
    <div className="mb-5 border-brand-border border-b pb-4">
      <p className="px-3 pb-2 font-heading font-semibold text-citius-blue/70 text-xs">
        Quick access
      </p>
      {action ? (
        <button
          className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--portal-control-radius)] bg-citius-blue px-3 py-2 font-semibold text-sm text-white shadow-sm transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-citius-blue/90 active:scale-[0.96]"
          onClick={() => {
            action.run();
            onNavigate?.();
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          {action.label}
        </button>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <Link
            className={`flex min-h-11 items-center rounded-[var(--portal-control-radius)] border px-3 py-2 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] active:scale-[0.96] ${
              item.href === pathname
                ? "border-citius-blue/20 bg-citius-blue/10 font-semibold text-citius-blue"
                : "border-brand-border bg-white text-brand-muted hover:border-citius-blue/25 hover:text-brand-dark"
            }`}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <span className="line-clamp-2">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

interface AccountMenuProps {
  email?: string | null;
  image?: string | null;
  name: string;
  onClose: () => void;
  onToggle: () => void;
  open: boolean;
}

function AccountMenu({ email, image, name, onClose, onToggle, open }: AccountMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeOnEscape = useEffectEvent(() => {
    onClose();
    buttonRef.current?.focus();
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOnEscape();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const closeAndRestoreFocus = () => {
    onClose();
    buttonRef.current?.focus();
  };

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Open account menu for ${name}`}
        className="flex min-h-11 items-center gap-2 rounded-full border border-brand-border/80 bg-white p-1.5 pr-2.5 text-left shadow-sm transition-[border-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:border-citius-blue/40 active:scale-[0.96]"
        onClick={onToggle}
        ref={buttonRef}
        type="button"
      >
        <PortalAccountAvatar image={image} name={name} />
        <span className="hidden min-w-0 lg:block">
          <span className="block max-w-40 truncate font-semibold text-brand-dark text-sm">
            {name}
          </span>
          <span className="block max-w-40 truncate text-[length:var(--portal-label-size)] text-brand-muted">
            {email}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`hidden text-brand-muted transition-transform sm:block ${open ? "rotate-180" : ""}`}
          size={15}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <button
              aria-label="Close account menu"
              className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
              onClick={closeAndRestoreFocus}
              tabIndex={-1}
              type="button"
            />
            <m.div
              animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
              aria-label="Account"
              className={`portal-shell-surface absolute right-0 ${PORTAL_Z.dropdown} mt-3 w-64 origin-top-right overflow-hidden border border-brand-border bg-white text-brand-dark shadow-xl`}
              exit={{
                opacity: 0,
                transform: shouldReduceMotion ? "none" : "translateY(6px) scale(0.98)",
                transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] },
              }}
              initial={{
                opacity: 0,
                transform: shouldReduceMotion ? "none" : "translateY(6px) scale(0.98)",
              }}
              ref={menuRef}
              role="menu"
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="border-brand-border border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <PortalAccountAvatar image={image} name={name} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-brand-dark text-sm">{name}</div>
                    <div className="mt-0.5 truncate text-[length:var(--portal-label-size)] text-brand-muted">
                      {email}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <Link
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-brand-muted text-sm transition-colors hover:bg-brand-light hover:text-citius-blue"
                  href="/"
                  onClick={onClose}
                  role="menuitem"
                >
                  <ExternalLink aria-hidden="true" size={16} />
                  <span>Back to site</span>
                </Link>
                <button
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-semibold text-brand-muted text-sm transition-colors hover:bg-brand-light hover:text-citius-blue"
                  onClick={handleLogout}
                  role="menuitem"
                  type="button"
                >
                  <LogOut aria-hidden="true" size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            </m.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function PortalShell({ access, user, children }: PortalShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
  const roles = access.roles ? access.roles.filter(Boolean) : [];
  const roleLabel = roles.join(" / ") || "Staff";
  const compactRoleLabel = getCompactRoleLabel(roles);
  const accountName = access.name || user?.name || "Staff";
  const accountEmail = access.email || user?.email;
  const accountImage = user?.image;
  const unreadCount =
    notificationSummary?.unreadCount ?? notificationRows.filter((item) => !item.readAt).length;

  const closeAccountMenu = () => setAccountMenuOpen(false);

  const toggleNotifications = () => {
    setAccountMenuOpen(false);
    setNotificationsOpen((open) => !open);
  };

  const toggleAccountMenu = () => {
    setNotificationsOpen(false);
    setAccountMenuOpen((open) => !open);
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
          <div className="portal-shell relative min-h-screen overflow-x-hidden bg-brand-light text-brand-dark">
            <a
              className={`sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 ${PORTAL_Z.skipLinkFocus} focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-citius-blue focus:text-sm focus:shadow-lg`}
              href="#portal-main"
            >
              Skip to main content
            </a>
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 -z-10 bg-[url('/gallery/bgfooter.webp')] bg-brand-light bg-center bg-cover opacity-[0.06]"
            />

            <header
              className={`sticky top-0 ${PORTAL_Z.chrome} border-brand-border/80 border-b bg-white/90 shadow-brand-dark/[0.03] shadow-sm backdrop-blur-xl`}
            >
              <div className="flex h-[4.25rem] items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
                <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
                  <button
                    aria-label="Open portal navigation"
                    className="grid min-h-11 min-w-11 place-items-center rounded-full text-brand-dark transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light active:scale-[0.96] lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                    type="button"
                  >
                    <Menu size={20} />
                  </button>
                  <Link className="flex shrink-0 items-center" href="/portal">
                    <Image
                      alt="Citius Connect"
                      className="h-7 w-auto sm:h-9"
                      height={CITIUS_CONNECT_LOGO_HEIGHT}
                      priority
                      src={ConnectLogo}
                      width={CITIUS_CONNECT_LOGO_WIDTH}
                    />
                  </Link>
                  <span
                    className="inline-flex min-h-8 max-w-[8rem] shrink-0 items-center rounded-full border border-citius-orange/20 bg-citius-orange/10 px-2.5 text-center font-semibold text-[length:var(--portal-label-size)] text-citius-orange-ink leading-tight sm:max-w-none sm:px-3"
                    title={roleLabel}
                  >
                    <span className="sr-only">Roles: {roleLabel}</span>
                    <span aria-hidden className="min-w-0 whitespace-normal">
                      {compactRoleLabel}
                    </span>
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-5">
                  <div className="flex items-center rounded-full border border-brand-border/80 bg-brand-light/70 p-1.5">
                    <div className="relative shrink-0">
                      <button
                        aria-label="Open notifications"
                        className="relative grid size-11 place-items-center rounded-full bg-white text-brand-muted shadow-sm transition-[color,transform] duration-150 ease-[var(--portal-ease-out)] hover:text-citius-blue active:scale-[0.96] lg:size-9"
                        onClick={toggleNotifications}
                        type="button"
                      >
                        <Bell size={17} />
                        {unreadCount > 0 && (
                          <m.span
                            animate={
                              shouldReduceMotion
                                ? { opacity: 1 }
                                : { opacity: 1, transform: "scale(1)" }
                            }
                            className="absolute -top-1 -right-1 min-w-5 rounded-full bg-citius-blue px-1.5 text-center font-bold text-[10px] text-white tabular-nums leading-5 shadow-sm"
                            initial={
                              shouldReduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, transform: "scale(0.95)" }
                            }
                            transition={
                              shouldReduceMotion
                                ? { duration: 0 }
                                : { duration: 0.15, ease: [0.23, 1, 0.32, 1] }
                            }
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
                              animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
                              className={`portal-shell-surface absolute right-0 ${PORTAL_Z.dropdown} mt-3 w-[min(20rem,calc(100vw-2rem))] origin-top-right overflow-hidden border border-brand-border bg-white text-brand-dark shadow-xl`}
                              exit={{
                                opacity: 0,
                                transform: shouldReduceMotion
                                  ? "none"
                                  : "translateY(6px) scale(0.98)",
                                transition: {
                                  duration: 0.12,
                                  ease: [0.23, 1, 0.32, 1],
                                },
                              }}
                              initial={{
                                opacity: 0,
                                transform: shouldReduceMotion
                                  ? "none"
                                  : "translateY(6px) scale(0.98)",
                              }}
                              transition={{
                                duration: 0.15,
                                ease: [0.23, 1, 0.32, 1],
                              }}
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
                                  className="font-semibold text-citius-blue text-xs transition-colors duration-150 ease-[var(--portal-ease-out)] hover:text-citius-orange-ink"
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

                  <AccountMenu
                    email={accountEmail}
                    image={accountImage}
                    name={accountName}
                    onClose={closeAccountMenu}
                    onToggle={toggleAccountMenu}
                    open={accountMenuOpen}
                  />
                </div>
              </div>
            </header>

            <div className="flex min-h-[calc(100vh-68px)]">
              <aside className="sticky top-[4.25rem] hidden h-[calc(100vh-68px)] w-64 shrink-0 flex-col overflow-hidden border-brand-border/80 border-r bg-white/80 backdrop-blur-sm lg:flex">
                <PortalNav navGroups={navGroups} navShortcuts={navShortcuts} pathname={pathname} />
              </aside>

              <AnimatePresence>
                {sidebarOpen && (
                  <>
                    <m.button
                      animate={{ opacity: 1 }}
                      aria-label="Close portal navigation backdrop"
                      className={`fixed inset-0 ${PORTAL_Z.mobileBackdrop} bg-slate-950/70 lg:hidden`}
                      exit={{ opacity: 0 }}
                      initial={{ opacity: 0 }}
                      onClick={() => setSidebarOpen(false)}
                      type="button"
                    />
                    <m.aside
                      animate={{ transform: "translateX(0)" }}
                      className={`portal-mobile-drawer fixed inset-y-0 left-0 ${PORTAL_Z.mobileDrawer} flex w-[min(20rem,calc(100vw-1.5rem))] flex-col bg-white shadow-2xl lg:hidden`}
                      exit={{ transform: "translateX(-100%)" }}
                      initial={{ transform: "translateX(-100%)" }}
                      transition={{ bounce: 0, duration: 0.3, type: "spring" }}
                    >
                      <div className="flex h-16 items-center justify-between border-brand-border border-b px-4">
                        <span className="font-heading text-citius-blue text-lg">Navigation</span>
                        <button
                          aria-label="Close portal navigation"
                          className="grid min-h-11 min-w-11 place-items-center rounded-full text-brand-muted transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light active:scale-[0.96]"
                          onClick={() => setSidebarOpen(false)}
                          type="button"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <PortalNav
                        mobile
                        navGroups={navGroups}
                        navShortcuts={navShortcuts}
                        onNavigate={() => setSidebarOpen(false)}
                        pathname={pathname}
                      />
                    </m.aside>
                  </>
                )}
              </AnimatePresence>

              <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-8 lg:p-10" id="portal-main">
                {children}
              </main>
            </div>
          </div>
        </PortalChromeProvider>
      </PortalConfirmProvider>
    </PortalToastProvider>
  );
}

function PortalNav({
  mobile = false,
  navGroups,
  pathname,
  navShortcuts,
  onNavigate,
}: PortalNavProps) {
  const modShortcutLabel = useModShortcutLabel();
  const { quickAction, savedViewActions } = usePortalChrome();
  const [navState, dispatchNavState] = useReducer(portalNavReducer, null, createPortalNavState);
  const { saveDialogOpen, savingView } = navState;
  const { collapsedShortcuts, expandedGroups, expandedShortcuts } = useSyncExternalStore(
    subscribePortalNavPreferences,
    getPortalNavPreferencesSnapshot,
    getPortalNavServerSnapshot
  );
  const quickNavigation = mobile ? getMobileQuickNavigation(navGroups) : [];

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
    updatePortalNavPreference("expandedGroups", next);
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
    updatePortalNavPreference("collapsedShortcuts", nextCollapsed);
    updatePortalNavPreference("expandedShortcuts", nextExpanded);
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
        {mobile ? (
          <MobileQuickAccess
            action={quickAction}
            items={quickNavigation}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        ) : null}
        {navGroups.map((group, groupIndex) => {
          const collapsible = group.items.length > 1;
          const groupExpanded = isGroupExpanded(group);

          return (
            <div className={groupIndex > 0 ? "mt-6" : ""} key={group.label}>
              {collapsible ? (
                <button
                  aria-expanded={groupExpanded}
                  className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 pb-2 text-left font-heading font-semibold text-citius-blue/70 text-xs transition-[color,transform] duration-150 ease-[var(--portal-ease-out)] hover:text-citius-blue active:scale-[0.96]"
                  onClick={() => toggleGroup(group.label)}
                  type="button"
                >
                  <span>{group.label}</span>
                  <ChevronRight
                    className={`transition-transform duration-150 ease-[var(--portal-ease-out)] ${groupExpanded ? "rotate-90" : ""}`}
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
                            className={`relative flex min-h-11 flex-1 items-center rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] ${
                              active
                                ? "bg-citius-blue/10 font-semibold text-citius-blue"
                                : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
                            } active:scale-[0.96]`}
                            href={item.href}
                            onClick={onNavigate}
                          >
                            {active && (
                              <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-citius-orange" />
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
                              className={`grid min-h-11 min-w-11 place-items-center rounded-xl text-brand-muted transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light hover:text-citius-blue active:scale-[0.96] ${
                                shortcutsExpanded ? "bg-brand-light text-citius-blue" : ""
                              }`}
                              onClick={() => toggleShortcuts(item.href, shortcutsExpanded)}
                              type="button"
                            >
                              <ChevronDown
                                className={`transition-transform duration-150 ease-[var(--portal-ease-out)] ${shortcutsExpanded ? "rotate-180" : ""}`}
                                size={16}
                              />
                            </button>
                          )}
                        </div>

                        {hasShortcuts && shortcutsExpanded && (
                          <div className="mt-0.5 ml-3 space-y-0.5 border-brand-border border-l pl-2">
                            {visibleShortcuts.map((shortcut) => (
                              <Link
                                className="block min-h-9 rounded-lg p-2 text-brand-muted text-xs leading-snug transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
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
                                className="block min-h-9 rounded-lg p-2 font-semibold text-citius-blue text-xs transition-[color,transform] duration-150 ease-[var(--portal-ease-out)] hover:text-citius-orange-ink active:scale-[0.96]"
                                href={item.href}
                                onClick={onNavigate}
                              >
                                Show all ({shortcuts.length})
                              </Link>
                            ) : (
                              <Link
                                className="block min-h-9 rounded-lg p-2 font-semibold text-citius-blue text-xs transition-[color,transform] duration-150 ease-[var(--portal-ease-out)] hover:text-citius-orange-ink active:scale-[0.96]"
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
                  className="font-semibold text-[length:var(--portal-label-size)] text-citius-blue transition-colors duration-150 ease-[var(--portal-ease-out)] hover:text-citius-orange-ink"
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
                    className="min-h-9 flex-1 truncate rounded-md px-2 py-1.5 text-left text-brand-muted text-xs transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
                    onClick={() => savedViewActions?.applySavedView?.(view)}
                    title={view.name}
                    type="button"
                  >
                    {view.name}
                  </button>
                </div>
              ))}
              {favoriteOverflow > 0 ? (
                <p className="px-3 pt-1 text-[length:var(--portal-label-size)] text-brand-muted">
                  +{favoriteOverflow} more in {modShortcutLabel} palette
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-brand-border border-t bg-white/80 pt-3 backdrop-blur-sm">
        <p className="px-3 pb-1 text-[length:var(--portal-label-size)] text-brand-muted">
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
