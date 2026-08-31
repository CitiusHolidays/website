"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { AnimatePresence, useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout, useSession } from "@/lib/auth-client";
import { publicRouteCurrent } from "@/lib/publicNavigation";
import Logo from "@/static/logos/logo.webp";
import { MenuIcon, useAnimatedIconTrigger } from "../ui/AnimatedLucideIcons";
import PublicContactCta from "../ui/PublicContactCta";
import { HeaderMobileMenu } from "./HeaderMobileMenu";
import { HeaderSessionControl } from "./HeaderSessionControl";
import { SpiritualTrailsDropdown } from "./HeaderSpiritualTrailsDropdown";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/mice", label: "MICE" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

function HeaderNavLink({ isScrolled, link, pathname }) {
  const current = publicRouteCurrent(pathname, link.href);
  let tone = "text-white hover:text-white";
  if (isScrolled) {
    tone = "text-slate-300 hover:text-white";
  }
  if (current) {
    tone = "bg-white/15 text-white";
  }
  return (
    <Link
      aria-current={current}
      className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ${tone}`}
      data-active={current ? "true" : "false"}
      href={link.href}
    >
      <span className="relative z-10">{link.label}</span>
      {current ? (
        <span
          aria-hidden="true"
          className="relative z-10 size-1.5 rounded-full bg-current"
          data-current-route-marker=""
        />
      ) : null}
      <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const userMenuRef = useRef(null);
  const menuIconRef = useRef(null);
  const menuIconTrigger = useAnimatedIconTrigger(menuIconRef);

  const { data: session, isPending } = useSession();
  const user = session?.user;
  const { isAuthenticated } = useConvexAuth();
  const portalAccess = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const canAccessPortal = Boolean(portalAccess?.allowed);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const nextScrolled = latest > 20;
    setIsScrolled((current) => (current === nextScrolled ? current : nextScrolled));
  });

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
  const openMobileMenu = () => setIsOpen(true);
  const closeMobileMenu = () => setIsOpen(false);

  return (
    <>
      <header className="fixed top-0 right-0 left-0 z-50 flex justify-center pt-4">
        <div
          className={`relative flex w-[calc(100%-2rem)] max-w-[1200px] items-center justify-between rounded-full border px-4 py-3 transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] sm:w-[calc(100%-3rem)] sm:px-6 ${
            isScrolled
              ? "material-structural material-public-night border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl"
              : "border-transparent bg-transparent"
          }`}
        >
          <Link className="group relative z-10 flex items-center gap-2" href="/">
            <div
              className={`relative h-10 w-[120px] origin-left transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${isScrolled ? "scale-90" : "scale-100"}`}
            >
              <div className="size-full rounded p-1">
                <Image
                  alt="Citius"
                  className="size-full object-contain"
                  height={40}
                  src={Logo}
                  width={120}
                />
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 xl:flex">
            {navLinks.slice(0, 4).map((link) => (
              <HeaderNavLink
                isScrolled={isScrolled}
                key={link.href}
                link={link}
                pathname={pathname}
              />
            ))}
            <SpiritualTrailsDropdown isScrolled={isScrolled} pathname={pathname} />
            {navLinks.slice(4).map((link) => (
              <HeaderNavLink
                isScrolled={isScrolled}
                key={link.href}
                link={link}
                pathname={pathname}
              />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <HeaderSessionControl
              canAccessPortal={canAccessPortal}
              isPending={isPending}
              isScrolled={isScrolled}
              onLogout={handleLogout}
              setUserMenuOpen={setUserMenuOpen}
              user={user}
              userMenuOpen={userMenuOpen}
              userMenuRef={userMenuRef}
            />

            <PublicContactCta
              className="hidden sm:inline-flex"
              size="compact"
              tone={isScrolled ? "light" : "glass"}
            >
              Let&apos;s Talk
            </PublicContactCta>

            <button
              aria-controls="public-mobile-menu"
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              className="grid min-h-11 min-w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 xl:hidden"
              onClick={openMobileMenu}
              type="button"
              {...menuIconTrigger}
            >
              <MenuIcon aria-hidden="true" ref={menuIconRef} size={24} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isOpen ? (
          <HeaderMobileMenu
            canAccessPortal={canAccessPortal}
            isOpen={isOpen}
            isPending={isPending}
            navLinks={navLinks}
            onClose={closeMobileMenu}
            onLogout={handleLogout}
            pathname={pathname}
            user={user}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
