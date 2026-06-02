"use client";

import { BriefcaseBusiness, ChevronDown, LogOut, User } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
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
        type="button"
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
          isScrolled
            ? "bg-white/10 text-white hover:bg-white/20"
            : "bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20"
        }`}
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name || "User"}
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="size-7 rounded-full bg-citius-orange flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
        )}
        {!isScrolled && (
          <span className="hidden md:inline max-w-[100px] truncate">
            {user.name?.split(" ")[0] || "Account"}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {userMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 py-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>

            <div className="py-1">
              {canAccessPortal && (
                <Link
                  href="/portal"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <BriefcaseBusiness size={16} />
                  Employee Portal
                </Link>
              )}
              <Link
                href="/account"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={16} />
                My Account
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
