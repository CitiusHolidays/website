"use client";

import { BriefcaseBusiness, ChevronDown, LogOut, User } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";

export function HeaderUserMenu({
  user,
  isScrolled,
  userMenuOpen,
  setUserMenuOpen,
  userMenuRef,
  canAccessPortal,
  onLogout,
}) {
  return (
    <div className="relative" ref={userMenuRef}>
      <button
        className={`hidden items-center gap-2 rounded-full px-3 py-2 font-medium text-sm transition-all duration-300 sm:flex ${
          isScrolled
            ? "bg-white/10 text-white hover:bg-white/20"
            : "border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
        }`}
        onClick={() => setUserMenuOpen(!userMenuOpen)}
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
        {userMenuOpen && (
          <m.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-gray-100 bg-white py-2 shadow-xl"
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="border-gray-100 border-b px-4 py-3">
              <p className="truncate font-semibold text-gray-900 text-sm">{user.name}</p>
              <p className="truncate text-gray-500 text-xs">{user.email}</p>
            </div>

            <div className="py-1">
              {canAccessPortal && (
                <Link
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                  href="/portal"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <BriefcaseBusiness size={16} />
                  Employee Portal
                </Link>
              )}
              <Link
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                href="/account"
                onClick={() => setUserMenuOpen(false)}
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
        )}
      </AnimatePresence>
    </div>
  );
}
