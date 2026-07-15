"use client";

import { X } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { getTrailsForHub } from "@/data/trails";
import Logo from "@/static/logos/logo.webp";
import { SignInDropdown } from "./HeaderSignInDropdown";

export function HeaderMobileMenu({ isOpen, onClose, navLinks, user, canAccessPortal, onLogout }) {
  if (!isOpen) {
    return null;
  }

  return (
    <m.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/98 pt-[var(--safe-area-inset-top)] pr-[var(--safe-area-inset-right)] pb-[var(--safe-area-inset-bottom)] pl-[var(--safe-area-inset-left)]"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
    >
      <button
        aria-label="Close menu"
        className="absolute top-8 right-8 p-4 text-white/50 transition-colors hover:text-white"
        onClick={onClose}
        type="button"
      >
        <X size={32} />
      </button>

      <nav className="flex max-h-[65vh] w-full flex-col items-center gap-6 overflow-y-auto px-4">
        {navLinks.slice(0, 4).map((link, i) => (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            key={link.href}
            transition={{ delay: 0.1 + i * 0.1 }}
          >
            <Link
              className="block text-center font-heading font-light text-4xl text-white transition-colors hover:text-blue-400"
              href={link.href}
              onClick={onClose}
            >
              {link.label}
            </Link>
          </m.div>
        ))}
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full flex-col items-center gap-3 border-white/10 border-y py-6"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.45 }}
        >
          <span className="text-white/40 text-xs uppercase tracking-[0.25em]">
            Spiritual Trails
          </span>
          <Link
            className="font-heading font-light text-2xl text-white transition-colors hover:text-blue-400"
            href="/pilgrimage"
            onClick={onClose}
          >
            Overview
          </Link>
          <div className="mt-1 flex flex-col items-center gap-2">
            {getTrailsForHub().map((t) => (
              <Link
                className="max-w-xs text-center text-base text-white/80 transition-colors hover:text-blue-300"
                href={`/pilgrimage/${t.slug}`}
                key={t.slug}
                onClick={onClose}
              >
                {t.title}
                {t.status === "comingSoon" ? " · soon" : ""}
              </Link>
            ))}
          </div>
        </m.div>
        {navLinks.slice(4).map((link, i) => (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            key={link.href}
            transition={{ delay: 0.55 + i * 0.08 }}
          >
            <Link
              className="block text-center font-heading font-light text-4xl text-white transition-colors hover:text-blue-400"
              href={link.href}
              onClick={onClose}
            >
              {link.label}
            </Link>
          </m.div>
        ))}
      </nav>

      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.6 }}
      >
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
                <div className="flex size-8 items-center justify-center rounded-full bg-citius-orange">
                  <span className="font-bold text-sm text-white">
                    {user.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
              <span className="font-medium text-white">{user.name?.split(" ")[0]}</span>
            </div>
            {canAccessPortal && (
              <Link
                className="text-lg text-white transition-colors hover:text-blue-300"
                href="/portal"
                onClick={onClose}
              >
                Employee Portal
              </Link>
            )}
            <button
              className="text-lg text-red-400 transition-colors hover:text-red-300"
              onClick={() => {
                onLogout();
                onClose();
              }}
              type="button"
            >
              Sign Out
            </button>
          </>
        ) : (
          <SignInDropdown isScrolled={false} onSelect={onClose} variant="mobile" />
        )}
      </m.div>

      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-8"
        initial={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.7 }}
      >
        <Image
          alt="Citius"
          className="opacity-50 brightness-0 invert"
          height={50}
          src={Logo}
          width={140}
        />
      </m.div>
    </m.div>
  );
}
