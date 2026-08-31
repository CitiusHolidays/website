"use client";

import { m, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/components/motion-ui/overlay";
import { getTrailsForHub } from "@/data/trails";
import { lockBodyScroll } from "@/lib/portal/lockBodyScroll";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { publicRouteCurrent } from "@/lib/publicNavigation";
import Logo from "@/static/logos/logo.webp";
import { useAnimatedIconTrigger, XIcon } from "../ui/AnimatedLucideIcons";
import { SignInDropdown } from "./HeaderSignInDropdown";

function MobileNavLink({ link, onClose, pathname }) {
  const current = publicRouteCurrent(pathname, link.href);
  const active = Boolean(current);
  return (
    <Link
      aria-current={current}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 font-semibold text-base transition-colors focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2 ${
        active
          ? "bg-blue-50 text-public-blue"
          : "text-public-ink hover:bg-public-paper hover:text-public-blue"
      }`}
      data-active={active ? "true" : "false"}
      href={link.href}
      onClick={onClose}
    >
      {link.label}
      {active ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-current"
          data-current-route-marker=""
        />
      ) : null}
    </Link>
  );
}

function MobileAccountActions({ canAccessPortal, isPending, onClose, onLogout, user }) {
  if (isPending) {
    return (
      <div
        aria-busy="true"
        className="flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm text-white/70"
        role="status"
      >
        Checking your account…
      </div>
    );
  }

  if (!user) {
    return <SignInDropdown isScrolled={false} onSelect={onClose} variant="mobile" />;
  }

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  return (
    <div>
      <div className="mb-2 flex min-h-11 items-center gap-3 px-1">
        {user.image ? (
          <Image
            alt={user.name || "User"}
            className="rounded-full"
            height={32}
            src={user.image}
            width={32}
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-public-orange">
            <span className="font-bold text-sm text-white">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
        )}
        <span className="min-w-0 truncate font-medium text-sm text-white">
          {user.name || user.email || "Your account"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link
          className="flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3 text-center font-semibold text-sm text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
          href="/account"
          onClick={onClose}
        >
          My Account
        </Link>
        {canAccessPortal ? (
          <Link
            className="flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3 text-center font-semibold text-sm text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
            href="/portal"
            onClick={onClose}
          >
            Employee Portal
          </Link>
        ) : null}
      </div>
      <button
        className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-semibold text-red-200 text-sm transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
        onClick={handleLogout}
        type="button"
      >
        Sign Out
      </button>
    </div>
  );
}

export function HeaderMobileMenu({
  isOpen,
  isPending = false,
  onClose,
  navLinks,
  user,
  canAccessPortal,
  onLogout,
  pathname = "/",
  id = "public-mobile-menu",
}) {
  const surfaceRef = useRef(null);
  const closeRef = useRef(null);
  const closeIconRef = useRef(null);
  const closeIconTrigger = useAnimatedIconTrigger(closeIconRef);
  const shouldReduceMotion = !!useReducedMotion();
  const transition = {
    duration: shouldReduceMotion ? 0 : 0.22,
    ease: PUBLIC_EASE_OUT,
  };

  useFocusTrap({
    active: isOpen,
    container: surfaceRef,
    inertSiblingsOf: surfaceRef,
    initialFocus: closeRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    return lockBodyScroll();
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trailsCurrent = publicRouteCurrent(pathname, "/pilgrimage");
  const trailsActive = Boolean(trailsCurrent);
  const trailsGroupCurrent = trailsActive ? "location" : undefined;
  const stopSheetClick = (event) => event.stopPropagation();

  return (
    <m.div
      animate={{ opacity: 1 }}
      aria-label="Mobile navigation"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-public-night/45"
      exit={{ opacity: 0 }}
      id={id}
      initial={{ opacity: 0 }}
      onClick={onClose}
      ref={surfaceRef}
      role="dialog"
      tabIndex={-1}
      transition={transition}
    >
      <m.div
        animate={{ transform: "translate3d(0, 0, 0)" }}
        className="ml-auto flex h-[100dvh] w-[min(92vw,26rem)] flex-col overflow-hidden border-white/10 border-l bg-public-surface text-public-ink shadow-2xl"
        data-mobile-menu-sheet=""
        exit={{ transform: shouldReduceMotion ? "none" : "translate3d(100%, 0, 0)" }}
        initial={{ transform: shouldReduceMotion ? "none" : "translate3d(100%, 0, 0)" }}
        onClick={stopSheetClick}
        transition={transition}
      >
        <div className="flex shrink-0 items-center justify-between border-brand-border border-b px-[max(1rem,var(--safe-area-inset-left))] pt-[max(0.75rem,var(--safe-area-inset-top))] pr-[max(1rem,var(--safe-area-inset-right))] pb-3">
          <Link
            aria-label="Citius Holidays home"
            className="flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2"
            href="/"
            onClick={onClose}
          >
            <Image alt="" className="h-auto w-[7.5rem]" height={40} src={Logo} width={120} />
          </Link>
          <button
            aria-label="Close menu"
            className="grid min-h-11 min-w-11 place-items-center rounded-full text-public-muted transition-colors hover:bg-public-paper hover:text-public-ink focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2"
            onClick={onClose}
            ref={closeRef}
            type="button"
            {...closeIconTrigger}
          >
            <XIcon aria-hidden="true" ref={closeIconRef} size={24} />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-public-surface"
          data-mobile-menu-scroll=""
        >
          <div className="flex min-h-full flex-col bg-public-surface px-[max(1rem,var(--safe-area-inset-left))] pt-5 pr-[max(1rem,var(--safe-area-inset-right))] pb-5">
            <h2
              className="mb-4 max-w-[15ch] text-balance font-heading font-semibold text-2xl text-public-night leading-tight"
              data-mobile-menu-heading=""
            >
              Your next great journey starts here.
            </h2>
            <nav aria-label="Primary" className="flex flex-1 flex-col justify-evenly gap-1">
              {navLinks.slice(0, 4).map((link) => (
                <MobileNavLink key={link.href} link={link} onClose={onClose} pathname={pathname} />
              ))}

              <details className="group/trails" data-active={trailsActive ? "true" : "false"}>
                <summary
                  aria-current={trailsGroupCurrent}
                  className={`flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-4 py-2.5 font-semibold text-base transition-colors focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden ${
                    trailsActive
                      ? "bg-blue-50 text-public-blue"
                      : "text-public-ink hover:bg-public-paper hover:text-public-blue"
                  }`}
                >
                  Spiritual Trails
                  <span className="flex items-center gap-2">
                    {trailsActive ? (
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-current"
                        data-current-route-marker=""
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className="text-public-muted transition-transform duration-200 group-open/trails:rotate-180 motion-reduce:transition-none"
                    >
                      ⌄
                    </span>
                  </span>
                </summary>
                <div className="mt-1 space-y-1 border-brand-border border-l pl-3">
                  <Link
                    aria-current={pathname === "/pilgrimage" ? "page" : undefined}
                    className={`flex min-h-11 w-full items-center rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2 ${
                      pathname === "/pilgrimage"
                        ? "bg-blue-50 font-semibold text-public-blue"
                        : "text-public-muted hover:bg-public-paper hover:text-public-ink"
                    }`}
                    href="/pilgrimage"
                    onClick={onClose}
                  >
                    All trails overview
                  </Link>
                  {getTrailsForHub().map((trail) => {
                    const href = `/pilgrimage/${trail.slug}`;
                    const active = pathname === href;
                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 w-full items-center rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-2 ${
                          active
                            ? "bg-blue-50 font-semibold text-public-blue"
                            : "text-public-muted hover:bg-public-paper hover:text-public-ink"
                        }`}
                        href={href}
                        key={trail.slug}
                        onClick={onClose}
                      >
                        {trail.title}
                        {trail.status === "comingSoon" ? " · soon" : ""}
                      </Link>
                    );
                  })}
                </div>
              </details>

              {navLinks.slice(4).map((link) => (
                <MobileNavLink key={link.href} link={link} onClose={onClose} pathname={pathname} />
              ))}
            </nav>
          </div>
        </div>

        <div
          className="shrink-0 border-white/10 border-t bg-public-night px-[max(1rem,var(--safe-area-inset-left))] pt-4 pr-[max(1rem,var(--safe-area-inset-right))] pb-[max(1rem,var(--safe-area-inset-bottom))] text-white"
          data-mobile-menu-actions=""
        >
          <Link
            className="flex min-h-11 w-full items-center justify-between rounded-xl bg-public-orange px-4 py-2.5 font-semibold text-public-night transition-colors hover:bg-public-lime focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            href="/contact"
            onClick={onClose}
          >
            Plan your trip
            <span aria-hidden="true">→</span>
          </Link>

          <div className="mt-3">
            <MobileAccountActions
              canAccessPortal={canAccessPortal}
              isPending={isPending}
              onClose={onClose}
              onLogout={onLogout}
              user={user}
            />
          </div>
        </div>
      </m.div>
    </m.div>
  );
}
