"use client";

import { m } from "motion/react";
import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTrailsForHub } from "@/data/trails";
import Logo from "@/static/logos/logo.webp";
import { SignInDropdown } from "./HeaderSignInDropdown";

export function HeaderMobileMenu({ isOpen, onClose, navLinks, user, canAccessPortal, onLogout }) {
  if (!isOpen) return null;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-slate-950/98 backdrop-blur-xl flex flex-col justify-center items-center"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-8 right-8 p-4 text-white/50 hover:text-white transition-colors"
      >
        <X size={32} />
      </button>

      <nav className="flex flex-col items-center gap-6 max-h-[65vh] overflow-y-auto px-4 w-full">
        {navLinks.slice(0, 4).map((link, i) => (
          <m.div
            key={link.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
          >
            <Link
              href={link.href}
              onClick={onClose}
              className="text-4xl font-heading font-light text-white hover:text-blue-400 transition-colors block text-center"
            >
              {link.label}
            </Link>
          </m.div>
        ))}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex flex-col items-center gap-3 w-full border-y border-white/10 py-6"
        >
          <span className="text-xs uppercase tracking-[0.25em] text-white/40">
            Spiritual Trails
          </span>
          <Link
            href="/pilgrimage"
            onClick={onClose}
            className="text-2xl font-heading font-light text-white hover:text-blue-400 transition-colors"
          >
            Overview
          </Link>
          <div className="flex flex-col items-center gap-2 mt-1">
            {getTrailsForHub().map((t) => (
              <Link
                key={t.slug}
                href={`/pilgrimage/${t.slug}`}
                onClick={onClose}
                className="text-base text-white/80 hover:text-blue-300 transition-colors text-center max-w-xs"
              >
                {t.title}
                {t.status === "comingSoon" ? " · soon" : ""}
              </Link>
            ))}
          </div>
        </m.div>
        {navLinks.slice(4).map((link, i) => (
          <m.div
            key={link.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 + i * 0.08 }}
          >
            <Link
              href={link.href}
              onClick={onClose}
              className="text-4xl font-heading font-light text-white hover:text-blue-400 transition-colors block text-center"
            >
              {link.label}
            </Link>
          </m.div>
        ))}
      </nav>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 flex flex-col items-center gap-4"
      >
        {user ? (
          <>
            <div className="flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User"}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="size-8 rounded-full bg-citius-orange flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {user.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
              <span className="text-white font-medium">{user.name?.split(" ")[0]}</span>
            </div>
            {canAccessPortal && (
              <Link
                href="/portal"
                onClick={onClose}
                className="text-lg text-white hover:text-blue-300 transition-colors"
              >
                Employee Portal
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="text-lg text-red-400 hover:text-red-300 transition-colors"
            >
              Sign Out
            </button>
          </>
        ) : (
          <SignInDropdown isScrolled={false} variant="mobile" onSelect={onClose} />
        )}
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-8"
      >
        <Image
          src={Logo}
          alt="Citius"
          width={140}
          height={50}
          className="brightness-0 invert opacity-50"
        />
      </m.div>
    </m.div>
  );
}
