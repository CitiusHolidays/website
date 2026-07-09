"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowRight, Menu } from "lucide-react";
import { AnimatePresence, m, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout, useSession } from "@/lib/auth-client";
import Logo from "@/static/logos/logo.webp";
import { HeaderMobileMenu } from "./HeaderMobileMenu";
import { SignInDropdown } from "./HeaderSignInDropdown";
import { SpiritualTrailsDropdown } from "./HeaderSpiritualTrailsDropdown";
import { HeaderUserMenu } from "./HeaderUserMenu";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/mice", label: "MICE" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const userMenuRef = useRef(null);

  const { data: session, isPending } = useSession();
  const user = session?.user;
  const { isAuthenticated } = useConvexAuth();
  const portalAccess = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const canAccessPortal = Boolean(portalAccess?.allowed);

  useTransform(scrollY, [0, 100], [0, 1]);

  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    window.location.href = "/";
  };

  return (
    <>
      <m.header
        animate={{ opacity: 1, y: 0 }}
        className={`fixed top-0 right-0 left-0 z-50 flex justify-center transition-all duration-300 ${
          isScrolled ? "pt-4" : "pt-0"
        }`}
        initial={{ opacity: 0, y: -100 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <m.div
          className={`relative flex items-center justify-between transition-all duration-500 ease-[0.16,1,0.3,1] ${
            isScrolled
              ? "w-[90%] rounded-full bg-slate-900/40 px-6 py-3 shadow-2xl backdrop-blur-xl md:w-[80%] lg:w-[1200px]"
              : "w-[95%] bg-transparent px-0 py-4 md:w-[90%]"
          }`}
          layout="position"
        >
          <Link className="group relative z-10 flex items-center gap-2" href="/">
            <div
              className={`relative transition-all duration-300 ${isScrolled ? "scale-90" : "scale-100"}`}
            >
              <div className="rounded p-1">
                <Image
                  alt="Citius"
                  className="object-contain transition-all duration-300"
                  height={40}
                  priority
                  src={Logo}
                  width={isScrolled ? 100 : 120}
                />
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                className={`group relative overflow-hidden rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ${
                  isScrolled ? "text-slate-300 hover:text-white" : "text-white hover:text-white"
                }`}
                href={link.href}
                key={link.href}
              >
                <span className="relative z-10">{link.label}</span>
                <m.div
                  className="absolute inset-0 rounded-full bg-white/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  layoutId="navHover"
                />
              </Link>
            ))}
            <SpiritualTrailsDropdown isScrolled={isScrolled} />
            {navLinks.slice(4).map((link) => (
              <Link
                className={`group relative overflow-hidden rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ${
                  isScrolled ? "text-slate-300 hover:text-white" : "text-white hover:text-white"
                }`}
                href={link.href}
                key={link.href}
              >
                <span className="relative z-10">{link.label}</span>
                <m.div
                  className="absolute inset-0 rounded-full bg-white/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  layoutId="navHover"
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isPending ? (
              <div className="hidden size-8 animate-pulse rounded-full bg-white/10 sm:block" />
            ) : user ? (
              <HeaderUserMenu
                canAccessPortal={canAccessPortal}
                isScrolled={isScrolled}
                onLogout={handleLogout}
                setUserMenuOpen={setUserMenuOpen}
                user={user}
                userMenuOpen={userMenuOpen}
                userMenuRef={userMenuRef}
              />
            ) : (
              <SignInDropdown isScrolled={isScrolled} />
            )}

            <Link
              className={`hidden items-center gap-2 rounded-full px-5 py-2.5 font-bold text-sm transition-all duration-300 sm:flex ${
                isScrolled
                  ? "bg-white text-slate-900 hover:bg-blue-50"
                  : "border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
              }`}
              href="/contact"
            >
              Let&apos;s Talk <ArrowRight size={14} />
            </Link>

            <button
              aria-label="Open menu"
              className={`rounded-full p-2 transition-colors lg:hidden ${
                isScrolled ? "text-white hover:bg-white/10" : "text-white hover:bg-white/10"
              }`}
              onClick={() => setIsOpen(true)}
              type="button"
            >
              <Menu size={24} />
            </button>
          </div>
        </m.div>
      </m.header>

      <AnimatePresence>
        {isOpen && (
          <HeaderMobileMenu
            canAccessPortal={canAccessPortal}
            isOpen={isOpen}
            navLinks={navLinks}
            onClose={() => setIsOpen(false)}
            onLogout={handleLogout}
            user={user}
          />
        )}
      </AnimatePresence>
    </>
  );
}
