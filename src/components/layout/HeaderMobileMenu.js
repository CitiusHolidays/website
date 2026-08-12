"use client";

import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useFocusTrap } from "@/components/motion-ui/overlay";
import { getTrailsForHub } from "@/data/trails";
import { lockBodyScroll } from "@/lib/portal/lockBodyScroll";
import Logo from "@/static/logos/logo.webp";
import { SignInDropdown } from "./HeaderSignInDropdown";

export function HeaderMobileMenu({
  isOpen,
  onClose,
  navLinks,
  user,
  canAccessPortal,
  onLogout,
  id = "public-mobile-menu",
}) {
  const surfaceRef = useRef(null);
  const closeRef = useRef(null);

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

  const handleLogout = useCallback(() => {
    onLogout();
    onClose();
  }, [onClose, onLogout]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-label="Mobile navigation"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex flex-col items-center bg-public-night"
      id={id}
      ref={surfaceRef}
      role="dialog"
      tabIndex={-1}
    >
      <button
        aria-label="Close menu"
        className="absolute top-[max(1rem,var(--safe-area-inset-top))] right-[max(1rem,var(--safe-area-inset-right))] z-10 grid min-h-11 min-w-11 place-items-center rounded-full text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
        onClick={onClose}
        ref={closeRef}
        type="button"
      >
        <X size={32} />
      </button>

      <div className="flex min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-[max(1rem,var(--safe-area-inset-left))] pt-[calc(max(1rem,var(--safe-area-inset-top))+4.5rem)] pr-[max(1rem,var(--safe-area-inset-right))] pb-[max(1.5rem,var(--safe-area-inset-bottom))]">
        <div className="my-auto flex w-full flex-col items-center py-4">
          <nav className="flex w-full flex-col items-center gap-6">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                className="block min-h-11 text-center font-heading font-light text-4xl text-white transition-colors hover:text-blue-300"
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex w-full flex-col items-center gap-3 border-white/10 border-y py-6">
              <span className="text-white/50 text-xs uppercase tracking-[0.25em]">
                Spiritual Trails
              </span>
              <Link
                className="min-h-11 font-heading font-light text-2xl text-white transition-colors hover:text-blue-300"
                href="/pilgrimage"
                onClick={onClose}
              >
                Overview
              </Link>
              <div className="mt-1 flex flex-col items-center gap-2">
                {getTrailsForHub().map((trail) => (
                  <Link
                    className="min-h-11 max-w-xs text-center text-base text-white/80 transition-colors hover:text-blue-200"
                    href={`/pilgrimage/${trail.slug}`}
                    key={trail.slug}
                    onClick={onClose}
                  >
                    {trail.title}
                    {trail.status === "comingSoon" ? " · soon" : ""}
                  </Link>
                ))}
              </div>
            </div>
            {navLinks.slice(4).map((link) => (
              <Link
                className="block min-h-11 text-center font-heading font-light text-4xl text-white transition-colors hover:text-blue-300"
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 flex flex-col items-center gap-4">
            {user ? (
              <>
                <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2">
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
                  <span className="font-medium text-white">{user.name?.split(" ")[0]}</span>
                </div>
                {canAccessPortal ? (
                  <Link
                    className="min-h-11 text-lg text-white transition-colors hover:text-blue-200"
                    href="/portal"
                    onClick={onClose}
                  >
                    Employee Portal
                  </Link>
                ) : null}
                <button
                  className="min-h-11 text-lg text-red-300 transition-colors hover:text-red-200"
                  onClick={handleLogout}
                  type="button"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <SignInDropdown isScrolled={false} onSelect={onClose} variant="mobile" />
            )}
          </div>

          <div className="mt-8">
            <Link
              aria-label="Citius Holidays home"
              className="block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-4"
              href="/"
            >
              <Image
                alt=""
                className="opacity-60 brightness-0 invert"
                height={50}
                src={Logo}
                width={140}
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
