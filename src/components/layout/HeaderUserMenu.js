"use client";

import { BriefcaseBusiness, ChevronDown, LogOut, User } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef } from "react";
import { publicDisclosureMotion } from "@/lib/publicInteractionMotion";

const PANEL_ID = "public-account-disclosure";

export function HeaderUserMenu({
  user,
  isScrolled,
  userMenuOpen,
  setUserMenuOpen,
  userMenuRef,
  canAccessPortal,
  onLogout,
}) {
  const triggerRef = useRef(null);
  const shouldReduceMotion = !!useReducedMotion();
  const motion = publicDisclosureMotion(shouldReduceMotion, "right");
  const close = () => setUserMenuOpen(false);
  const toggle = () => setUserMenuOpen((current) => !current);
  const closeFromEffect = useEffectEvent(close);
  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromEffect();
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    const handleFocusIn = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        closeFromEffect();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [userMenuOpen, userMenuRef]);

  return (
    <div className="relative" ref={userMenuRef}>
      <button
        aria-controls={PANEL_ID}
        aria-expanded={userMenuOpen}
        aria-label="Account menu"
        className={`hidden items-center gap-2 rounded-full px-3 py-2 font-medium text-sm transition-[background-color,color,box-shadow] duration-300 sm:flex ${
          isScrolled
            ? "bg-white/10 text-white hover:bg-white/20"
            : "material-floating border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
        }`}
        onClick={toggle}
        ref={triggerRef}
        type="button"
      >
        {user.image ? (
          <Image
            alt={user.name || "User"}
            className="rounded-full"
            height={28}
            src={user.image}
            width={28}
          />
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-citius-orange">
            <span className="font-bold text-white text-xs">
              {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
        )}
        {!isScrolled && (
          <span className="hidden max-w-[100px] truncate md:inline">
            {user.name?.split(" ")[0] || "Account"}
          </span>
        )}
        <ChevronDown
          className={`transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
          size={14}
        />
      </button>

      <AnimatePresence>
        {userMenuOpen ? (
          <m.div
            animate={motion.animate}
            className="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-gray-100 bg-white py-2 shadow-xl"
            exit={motion.exit}
            id={PANEL_ID}
            initial={motion.initial}
            style={motion.style}
            transition={motion.transition}
          >
            <div className="border-gray-100 border-b px-4 py-3">
              <p className="truncate font-semibold text-gray-900 text-sm">{user.name}</p>
              <p className="truncate text-gray-500 text-xs">{user.email}</p>
            </div>

            <div className="py-1">
              {canAccessPortal ? (
                <Link
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                  href="/portal"
                  onClick={close}
                >
                  <BriefcaseBusiness size={16} />
                  Employee Portal
                </Link>
              ) : null}
              <Link
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                href="/account"
                onClick={close}
              >
                <User size={16} />
                My Account
              </Link>
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-red-600 text-sm transition-colors hover:bg-red-50"
                onClick={onLogout}
                type="button"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
