"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation } from "convex/react";
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
import { m, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PortalAccessProvider } from "@/components/portal/PortalAccessContext";
import { PortalAccountAvatar } from "@/components/portal/PortalAccountAvatar";
import { PortalActionMenu } from "@/components/portal/PortalActionMenu";
import { PortalChromeProvider } from "@/components/portal/PortalChromeContext";
import { PortalConfirmProvider } from "@/components/portal/PortalConfirmDialog";
import { PortalLoadingAnnouncement } from "@/components/portal/PortalLoadingAnnouncement";
import PortalNavIcon from "@/components/portal/PortalNavIcon";
import PortalNavLinkPending from "@/components/portal/PortalNavLinkPending";
import { PortalPopover } from "@/components/portal/PortalPopover";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import {
  type PortalNavShortcut,
  type PortalNavShortcuts,
  type PortalSavedView,
  usePortalChrome,
} from "@/components/portal/portalChromeState";
import SaveViewDialog from "@/components/portal/SaveViewDialog";
import { preloadPerformanceView } from "@/components/portal/workspace/portalLazyViews";
import { Button } from "@/components/ui/application-button";
import { buttonVariants } from "@/components/ui/application-button-variants";
import { Dialog as BaseDialog } from "@/components/ui/foundation/base";
import { logout } from "@/lib/auth-client";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";
import type { JsonObject } from "@/lib/jsonValue";
import {
  getPortalPerformanceTarget,
  markPortalNavigationRouteReady,
  markPortalNavigationStart,
  trackPortalNavigationPreload,
} from "@/lib/portal/navigationPerformance";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";
import { portalOverlayMotion } from "@/lib/portal/portalMotion";
import {
  getPortalNavPreferencesSnapshot,
  getPortalNavServerSnapshot,
  subscribePortalNavPreferences,
  updatePortalNavPreference,
} from "@/lib/portal/portalNavPersistence";
import { getCompactRoleLabel, getMobileQuickNavigation } from "@/lib/portal/portalNavPresentation";
import { useModShortcutLabel } from "@/lib/portal/shortcutLabels";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import ConnectLogo from "@/static/logos/citiusconnect.png";

const ignoreAsyncError = (): void => undefined;

function preloadPortalNavigationHref(href: string, prefetchRoute?: (href: string) => void) {
  const target = getPortalPerformanceTarget(href);
  if (!target) {
    return;
  }
  prefetchRoute?.(href);
  const preload = preloadPerformanceView(target);
  trackPortalNavigationPreload(target, preload);
  preload.catch(ignoreAsyncError);
}

function preloadPortalNavigationTarget(event: SyntheticEvent<HTMLAnchorElement>) {
  preloadPortalNavigationHref(event.currentTarget.getAttribute("href") ?? "");
}

function markPortalNavigationTarget(href: string) {
  const target = getPortalPerformanceTarget(href);
  if (target) {
    markPortalNavigationStart(target);
  }
}

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

function NotificationListItem({
  index,
  item,
  onClick,
}: NotificationListItemProps & { index: number }) {
  const handleClick = () => onClick(item);
  return (
    <m.button
      animate={{ opacity: 1, transform: "translateY(0)" }}
      className={`${buttonVariants({ surface: "staff" })} w-full border-brand-border border-b px-4 py-3 text-left last:border-b-0 hover:bg-brand-light active:scale-[0.99]`}
      initial={{ opacity: 0, transform: "translateY(6px)" }}
      onClick={handleClick}
      transition={{ delay: index * 0.04, duration: 0.2, ease: "linear" }}
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
    </m.button>
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

function MobileQuickLink({
  item,
  onNavigate,
  pathname,
}: {
  item: PortalNavItem;
  onNavigate?: () => void;
  pathname: string | null;
}) {
  const handleNavigate = () => markPortalNavigationTarget(item.href);
  return (
    <Link
      className={`flex min-h-11 items-center rounded-[var(--portal-control-radius)] border px-3 py-2 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] active:scale-[0.96] ${
        item.href === pathname
          ? "border-citius-blue/20 bg-citius-blue/10 font-semibold text-citius-blue"
          : "border-brand-border bg-white text-brand-muted hover:border-citius-blue/25 hover:text-brand-dark"
      }`}
      href={item.href}
      onClick={onNavigate}
      onFocus={preloadPortalNavigationTarget}
      onMouseEnter={preloadPortalNavigationTarget}
      onNavigate={handleNavigate}
      onTouchStart={preloadPortalNavigationTarget}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <PortalNavIcon href={item.href} />
        <span className="line-clamp-2 min-w-0 flex-1">{item.label}</span>
        <PortalNavLinkPending
          label={item.label}
          performanceTarget={getPortalPerformanceTarget(item.href)}
        />
      </span>
    </Link>
  );
}

function MobileQuickAccess({ action, items, onNavigate, pathname }: MobileQuickAccessProps) {
  const handleAction = () => {
    action?.run();
    onNavigate?.();
  };
  if (items.length === 0 && !action) {
    return null;
  }

  return (
    <div className="mb-5 border-brand-border border-b pb-4">
      <p className="px-3 pb-2 font-heading font-semibold text-citius-blue/70 text-xs">
        Quick access
      </p>
      {action ? (
        <Button
          className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--portal-control-radius)] bg-citius-blue px-3 py-2 font-semibold text-sm text-white shadow-sm transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-citius-blue/90 active:scale-[0.96]"
          onClick={handleAction}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          {action.label}
        </Button>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <MobileQuickLink
            item={item}
            key={item.href}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        ))}
      </div>
    </div>
  );
}

interface AccountMenuProps {
  email?: string | null;
  image?: string | null;
  name: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function AccountMenu({ email, image, name, onOpenChange, open }: AccountMenuProps) {
  const closeMenu = () => onOpenChange(false);
  const renderTrigger = (props: React.ComponentProps<typeof Button>) => (
    <Button
      {...props}
      aria-label={`Open account menu for ${name}`}
      className="flex min-h-11 items-center gap-2 rounded-full border border-brand-border/80 bg-white p-1.5 pr-2.5 text-left shadow-sm transition-[border-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:border-citius-blue/40 active:scale-[0.96]"
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
    </Button>
  );
  return (
    <PortalActionMenu
      aria-label="Account"
      contentClassName="p-2"
      header={
        <div className="flex items-center gap-3">
          <PortalAccountAvatar image={image} name={name} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-brand-dark text-sm">{name}</div>
            <div className="mt-0.5 truncate text-[length:var(--portal-label-size)] text-brand-muted">
              {email}
            </div>
          </div>
        </div>
      }
      menuClassName="portal-shell-surface w-64"
      onOpenChange={onOpenChange}
      open={open}
      sideOffset={12}
      trigger={renderTrigger}
    >
      <Link
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-brand-muted text-sm transition-colors hover:bg-brand-light hover:text-citius-blue"
        href="/"
        onClick={closeMenu}
        role="menuitem"
      >
        <ExternalLink aria-hidden="true" size={16} />
        <span>Back to site</span>
      </Link>
      <Button
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-semibold text-brand-muted text-sm transition-colors hover:bg-brand-light hover:text-citius-blue"
        onClick={handleLogout}
        role="menuitem"
        type="button"
      >
        <LogOut aria-hidden="true" size={16} />
        <span>Sign out</span>
      </Button>
    </PortalActionMenu>
  );
}

function SavedViewButton({
  applySavedView,
  view,
}: {
  applySavedView?: (view: PortalSavedView) => void;
  view: PortalSavedView;
}) {
  const handleApply = () => applySavedView?.(view);
  return (
    <PortalTooltip content={view.name}>
      <Button
        className="min-h-9 flex-1 truncate rounded-md px-2 py-1.5 text-left text-brand-muted text-xs transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
        onClick={handleApply}
        type="button"
      >
        {view.name}
      </Button>
    </PortalTooltip>
  );
}

export default function PortalShell({ access, user, children }: PortalShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const { isAuthenticated } = useConvexAuth();
  const notificationBellState = useQuery(
    api.crm.activity.notificationBellState,
    isAuthenticated && access.allowed ? { limit: 8 } : "skip"
  );
  // SAFETY: the Convex query validator and PortalNavShortcuts mirror the same nav-shortcut response contract.
  const navShortcuts = useQuery(
    api.crm.navShortcuts.list,
    isAuthenticated && access.allowed ? {} : "skip"
  ) as PortalNavShortcuts | undefined;
  const markNotificationRead = useMutation(api.crm.activity.markNotificationRead);
  // SAFETY: getAccessibleNavGroups returns only the portal navigation descriptors consumed by PortalNav.
  const navGroups = getAccessibleNavGroups(access) as PortalNavGroup[];
  // SAFETY: the notificationBellState Convex validator is the source of NotificationItem's fields.
  const notificationRows = (notificationBellState?.notifications ?? []) as NotificationItem[];
  const roles = access.roles ? access.roles.filter(Boolean) : [];
  const roleLabel = roles.join(" / ") || "Staff";
  const compactRoleLabel = getCompactRoleLabel(roles);
  const accountName = access.name || user?.name || "Staff";
  const accountEmail = access.email || user?.email;
  const accountImage = user?.image;
  const unreadCount =
    notificationBellState?.unreadCount ?? notificationRows.filter((item) => !item.readAt).length;
  const drawerMotion = portalOverlayMotion(!!shouldReduceMotion, "left", 0.2, "snap");
  const drawerBackdropMotion = portalOverlayMotion(!!shouldReduceMotion, "static", 0.15, "snap");

  useEffect(() => {
    const target = getPortalPerformanceTarget(pathname ?? "");
    if (target) {
      markPortalNavigationRouteReady(target);
    }
  }, [pathname]);

  const handleNotificationsOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAccountMenuOpen(false);
    }
    setNotificationsOpen(nextOpen);
  };

  const handleAccountMenuOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setNotificationsOpen(false);
    }
    setAccountMenuOpen(nextOpen);
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
  const openSidebar = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);
  const closeNotifications = () => setNotificationsOpen(false);
  const renderNotificationTrigger = (props: React.ComponentProps<typeof Button>) => (
    <Button
      {...props}
      aria-label="Open notifications"
      className="relative grid size-11 place-items-center rounded-full bg-white text-brand-muted shadow-sm transition-[color,transform] duration-150 ease-[var(--portal-ease-out)] hover:text-citius-blue active:scale-[0.96] lg:size-9"
      type="button"
    >
      <Bell size={17} />
      {unreadCount > 0 ? (
        <m.span
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, transform: "scale(1)" }}
          className="absolute -top-1 -right-1 min-w-5 rounded-full bg-citius-blue px-1.5 text-center font-bold text-[10px] text-white tabular-nums leading-5 shadow-sm"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scale(0.95)" }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: [0.23, 1, 0.32, 1] }
          }
        >
          {unreadCount > 99 ? "99+" : String(unreadCount)}
        </m.span>
      ) : null}
    </Button>
  );
  const drawerBackdrop = (
    <m.button
      animate={sidebarOpen ? drawerBackdropMotion.visible : drawerBackdropMotion.hidden}
      aria-label="Close portal navigation backdrop"
      className={`${buttonVariants({ surface: "staff" })} fixed inset-0 data-ending-style:pointer-events-none ${PORTAL_Z.mobileBackdrop} bg-slate-950/70 lg:hidden`}
      initial={drawerBackdropMotion.hidden}
      transition={drawerBackdropMotion.transition}
      type="button"
    />
  );
  const drawer = (
    <m.aside
      animate={sidebarOpen ? drawerMotion.visible : drawerMotion.hidden}
      className={`portal-mobile-drawer fixed inset-y-0 left-0 data-ending-style:pointer-events-none ${PORTAL_Z.mobileDrawer} flex w-[min(20rem,calc(100vw-1.5rem))] flex-col bg-white shadow-2xl lg:hidden`}
      initial={drawerMotion.hidden}
      transition={drawerMotion.transition}
    />
  );

  return (
    <PortalAccessProvider access={access}>
      <PortalToastProvider>
        <PortalConfirmProvider>
          <PortalChromeProvider navShortcuts={navShortcuts}>
            <div className="portal-shell relative min-h-screen overflow-x-hidden bg-brand-light text-brand-dark">
              <PortalLoadingAnnouncement />
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
                className={`material-structural sticky top-0 ${PORTAL_Z.chrome} border-brand-border/80 border-b bg-white/90 shadow-brand-dark/[0.03] shadow-sm backdrop-blur-xl`}
              >
                <div className="flex h-[var(--portal-chrome-height)] items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
                    <Button
                      aria-label="Open portal navigation"
                      className="grid min-h-11 min-w-11 place-items-center rounded-full text-brand-dark transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light active:scale-[0.96] lg:hidden"
                      onClick={openSidebar}
                      ref={sidebarTriggerRef}
                      type="button"
                    >
                      <Menu size={20} />
                    </Button>
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
                    <PortalTooltip content={roleLabel}>
                      <span className="inline-flex min-h-8 max-w-[8rem] shrink-0 items-center rounded-full border border-citius-orange/20 bg-citius-orange/10 px-2.5 text-center font-semibold text-[length:var(--portal-label-size)] text-citius-orange-ink leading-tight sm:max-w-none sm:px-3">
                        <span className="sr-only">Roles: {roleLabel}</span>
                        <span aria-hidden className="min-w-0 whitespace-normal">
                          {compactRoleLabel}
                        </span>
                      </span>
                    </PortalTooltip>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-5">
                    <div className="flex items-center rounded-full border border-brand-border/80 bg-brand-light/70 p-1.5">
                      <div className="relative shrink-0">
                        <PortalPopover
                          aria-label="notifications"
                          className="portal-shell-surface w-[min(20rem,calc(100vw-2rem))]"
                          onOpenChange={handleNotificationsOpenChange}
                          open={notificationsOpen}
                          sideOffset={12}
                          trigger={renderNotificationTrigger}
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
                              notificationRows.map((item, index) => (
                                <NotificationListItem
                                  index={index}
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
                              onClick={closeNotifications}
                            >
                              View all notifications
                            </Link>
                          </div>
                        </PortalPopover>
                      </div>
                    </div>

                    <AccountMenu
                      email={accountEmail}
                      image={accountImage}
                      name={accountName}
                      onOpenChange={handleAccountMenuOpenChange}
                      open={accountMenuOpen}
                    />
                  </div>
                </div>
              </header>

              <div className="flex min-h-[calc(100dvh-var(--portal-chrome-height))]">
                <aside className="material-structural sticky top-[var(--portal-chrome-height)] hidden h-[calc(100dvh-var(--portal-chrome-height))] w-64 shrink-0 flex-col overflow-hidden border-brand-border/80 border-r bg-white/80 backdrop-blur-sm lg:flex">
                  <PortalNav
                    navGroups={navGroups}
                    navShortcuts={navShortcuts}
                    pathname={pathname}
                  />
                </aside>

                <BaseDialog.Root onOpenChange={setSidebarOpen} open={sidebarOpen}>
                  <BaseDialog.Portal>
                    <BaseDialog.Backdrop
                      className="data-ending-style:pointer-events-none"
                      render={drawerBackdrop}
                    />
                    <BaseDialog.Popup
                      aria-hidden={sidebarOpen ? undefined : "true"}
                      aria-label="Navigation"
                      className="data-ending-style:pointer-events-none"
                      finalFocus={sidebarTriggerRef}
                      inert={sidebarOpen ? undefined : true}
                      render={drawer}
                    >
                      <div className="flex h-16 items-center justify-between border-brand-border border-b px-4">
                        <span className="font-heading text-citius-blue text-lg">Navigation</span>
                        <BaseDialog.Close
                          render={
                            <Button
                              aria-label="Close portal navigation"
                              className="grid min-h-11 min-w-11 place-items-center rounded-full text-brand-muted transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light active:scale-[0.96]"
                              type="button"
                            />
                          }
                        >
                          <X size={20} />
                        </BaseDialog.Close>
                      </div>
                      <PortalNav
                        mobile
                        navGroups={navGroups}
                        navShortcuts={navShortcuts}
                        onNavigate={closeSidebar}
                        pathname={pathname}
                      />
                    </BaseDialog.Popup>
                  </BaseDialog.Portal>
                </BaseDialog.Root>

                <main className="min-w-0 flex-1 p-4 sm:p-5 md:p-8 lg:p-10" id="portal-main">
                  {children}
                </main>
              </div>
            </div>
          </PortalChromeProvider>
        </PortalConfirmProvider>
      </PortalToastProvider>
    </PortalAccessProvider>
  );
}

function PortalNavShortcutList({
  item,
  onNavigate,
  shortcuts,
}: {
  item: PortalNavItem;
  onNavigate?: () => void;
  shortcuts: PortalNavShortcut[];
}) {
  const visibleShortcuts = shortcuts.slice(0, 3);
  const hiddenShortcutCount = Math.max(0, shortcuts.length - visibleShortcuts.length);
  return (
    <div className="ms-3 mt-0.5 space-y-0.5 border-brand-border border-s ps-2">
      {visibleShortcuts.map((shortcut) => (
        <PortalTooltip content={shortcut.label} key={shortcut.id}>
          <Link
            className="block min-h-9 rounded-lg p-2 text-brand-muted text-xs leading-snug transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light hover:text-brand-dark active:scale-[0.96]"
            href={shortcut.href}
            onClick={onNavigate}
          >
            <span className="line-clamp-2">{shortcut.label}</span>
          </Link>
        </PortalTooltip>
      ))}
      <Link
        className="block min-h-9 rounded-lg p-2 font-semibold text-citius-blue text-xs transition-[color,transform] duration-150 ease-[var(--portal-ease-out)] hover:text-brand-dark active:scale-[0.96]"
        href={item.href}
        onClick={onNavigate}
      >
        {hiddenShortcutCount > 0 ? `Show all (${shortcuts.length})` : "View all"}
      </Link>
    </div>
  );
}

function PortalNavItemRow({
  handleShortcutToggle,
  item,
  navShortcuts,
  onNavigate,
  pathname,
  shortcutsExpanded,
}: {
  handleShortcutToggle: (event: SyntheticEvent<HTMLButtonElement>) => void;
  item: PortalNavItem;
  navShortcuts?: PortalNavShortcuts;
  onNavigate?: () => void;
  pathname: string | null;
  shortcutsExpanded: boolean | undefined;
}) {
  const active = item.href === "/portal" ? pathname === "/portal" : pathname?.startsWith(item.href);
  const shortcuts = item.shortcutKey ? (navShortcuts?.[item.shortcutKey] ?? []) : [];
  const hasShortcuts = shortcuts.length > 0;
  const handleNavigate = () => markPortalNavigationTarget(item.href);
  return (
    <div>
      <div className="flex items-stretch gap-0.5">
        <Link
          className={`relative flex min-h-11 flex-1 items-center rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] ${
            active
              ? "bg-citius-blue/10 font-semibold text-citius-blue"
              : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
          } active:scale-[0.96]`}
          href={item.href}
          onClick={onNavigate}
          onFocus={preloadPortalNavigationTarget}
          onMouseEnter={preloadPortalNavigationTarget}
          onNavigate={handleNavigate}
          onTouchStart={preloadPortalNavigationTarget}
        >
          <PortalNavIcon href={item.href} />
          <span className="min-w-0 flex-1 truncate ps-2.5">{item.label}</span>
          <PortalNavLinkPending
            label={item.label}
            performanceTarget={getPortalPerformanceTarget(item.href)}
          />
        </Link>
        {hasShortcuts ? (
          <Button
            aria-expanded={shortcutsExpanded}
            aria-label={
              shortcutsExpanded ? `Hide latest ${item.label}` : `Show latest ${item.label}`
            }
            className={`grid min-h-11 min-w-11 place-items-center rounded-xl text-brand-muted transition-[background-color,color,transform] duration-150 ease-[var(--portal-ease-out)] hover:bg-brand-light hover:text-citius-blue active:scale-[0.96] ${
              shortcutsExpanded ? "bg-brand-light text-citius-blue" : ""
            }`}
            data-expanded={String(shortcutsExpanded)}
            data-href={item.href}
            onClick={handleShortcutToggle}
            type="button"
          >
            <ChevronDown
              className={`transition-transform duration-150 ease-[var(--portal-ease-out)] ${shortcutsExpanded ? "rotate-180" : ""}`}
              size={16}
            />
          </Button>
        ) : null}
      </div>
      {hasShortcuts && shortcutsExpanded ? (
        <PortalNavShortcutList item={item} onNavigate={onNavigate} shortcuts={shortcuts} />
      ) : null}
    </div>
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
  const router = useRouter();
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

  const preloadGroup = (group: PortalNavGroup) => {
    for (const item of group.items) {
      preloadPortalNavigationHref(item.href, router.prefetch);
    }
  };

  const toggleGroup = (group: PortalNavGroup) => {
    const next = new Set(expandedGroups);
    if (next.has(group.label)) {
      next.delete(group.label);
    } else {
      preloadGroup(group);
      next.add(group.label);
    }
    updatePortalNavPreference("expandedGroups", next);
  };

  const toggleShortcuts = (href: string, currentlyExpanded: boolean) => {
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
  const handleGroupPreload = (event: SyntheticEvent<HTMLButtonElement>) => {
    const group = navGroups.find(
      (candidate) => candidate.label === event.currentTarget.dataset.groupLabel
    );
    if (group) {
      preloadGroup(group);
    }
  };
  const handleGroupToggle = (event: SyntheticEvent<HTMLButtonElement>) => {
    const group = navGroups.find(
      (candidate) => candidate.label === event.currentTarget.dataset.groupLabel
    );
    if (group) {
      toggleGroup(group);
    }
  };
  const handleShortcutToggle = (event: SyntheticEvent<HTMLButtonElement>) => {
    const { href = "", expanded } = event.currentTarget.dataset;
    toggleShortcuts(href, expanded === "true");
  };

  const pinnedViews = (savedViewActions?.savedViews ?? [])
    .filter((view) => view.isFavorite)
    .slice(0, 5);
  const favoriteOverflow =
    (savedViewActions?.savedViews ?? []).filter((view) => view.isFavorite).length -
    pinnedViews.length;

  const handleSaveView = async (name: string, options?: JsonObject) => {
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
  const openSaveDialog = () => dispatchNavState({ open: true, type: "saveDialogOpen" });
  const closeSaveDialog = () => dispatchNavState({ open: false, type: "saveDialogOpen" });

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
                <Button
                  aria-expanded={groupExpanded}
                  className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 pb-2 text-left font-heading font-semibold text-citius-blue/70 text-xs transition-[color,transform] duration-150 ease-[var(--portal-ease-out)] hover:text-citius-blue active:scale-[0.96]"
                  data-group-label={group.label}
                  onClick={handleGroupToggle}
                  onFocus={handleGroupPreload}
                  onMouseEnter={handleGroupPreload}
                  onTouchStart={handleGroupPreload}
                  type="button"
                >
                  <span>{group.label}</span>
                  <ChevronRight
                    className={`transition-transform duration-150 ease-[var(--portal-ease-out)] ${groupExpanded ? "rotate-90" : ""}`}
                    size={14}
                  />
                </Button>
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
                    return (
                      <PortalNavItemRow
                        handleShortcutToggle={handleShortcutToggle}
                        item={item}
                        key={item.href}
                        navShortcuts={navShortcuts}
                        onNavigate={onNavigate}
                        pathname={pathname}
                        shortcutsExpanded={isShortcutsExpanded(item.href, active)}
                      />
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
                <Button
                  className="font-semibold text-[length:var(--portal-label-size)] text-citius-blue transition-colors duration-150 ease-[var(--portal-ease-out)] hover:text-brand-dark"
                  onClick={openSaveDialog}
                  type="button"
                >
                  Save view
                </Button>
              ) : null}
            </div>
            <div className="space-y-0.5">
              {pinnedViews.map((view) => (
                <div className="flex items-center gap-1 rounded-lg px-2 py-1" key={view.id}>
                  <SavedViewButton applySavedView={savedViewActions?.applySavedView} view={view} />
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

      <div className="material-structural shrink-0 border-brand-border border-t bg-white/80 pt-3 backdrop-blur-sm">
        <p className="px-3 pb-1 text-[length:var(--portal-label-size)] text-brand-muted">
          Press{" "}
          <kbd className="rounded border border-brand-border/80 bg-brand-light/80 px-1 font-sans text-[10px]">
            {modShortcutLabel}
          </kbd>{" "}
          for commands
        </p>
      </div>

      <SaveViewDialog
        onClose={closeSaveDialog}
        onSave={handleSaveView}
        open={saveDialogOpen}
        saving={savingView}
      />
    </nav>
  );
}
