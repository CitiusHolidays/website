"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowRight, Menu } from "lucide-react";
import { AnimatePresence, m as motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");

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

  if (isAuthPage) return null;

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-300 ${
          isScrolled ? "pt-4" : "pt-0"
        }`}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className={`relative flex items-center justify-between transition-all duration-500 ease-[0.16,1,0.3,1] ${
            isScrolled
              ? "w-[90%] md:w-[80%] lg:w-[1200px] bg-slate-900/40 backdrop-blur-xl shadow-2xl rounded-full py-3 px-6"
              : "w-[95%] md:w-[90%] bg-transparent py-4 px-0"
          }`}
          layout="position"
        >
          <Link href="/" className="relative z-10 flex items-center gap-2 group">
            <div
              className={`relative transition-all duration-300 ${isScrolled ? "scale-90" : "scale-100"}`}
            >
              <div className="rounded p-1">
                <Image
                  src={Logo}
                  alt="Citius"
                  width={isScrolled ? 100 : 120}
                  height={40}
                  className="object-contain transition-all duration-300"
                  priority
                />
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 group overflow-hidden rounded-full ${
                  isScrolled ? "text-slate-300 hover:text-white" : "text-white hover:text-white"
                }`}
              >
                <span className="relative z-10">{link.label}</span>
                <motion.div
                  className="absolute inset-0 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  layoutId="navHover"
                />
              </Link>
            ))}
            <SpiritualTrailsDropdown isScrolled={isScrolled} pathname={pathname} />
            {navLinks.slice(4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 group overflow-hidden rounded-full ${
                  isScrolled ? "text-slate-300 hover:text-white" : "text-white hover:text-white"
                }`}
              >
                <span className="relative z-10">{link.label}</span>
                <motion.div
                  className="absolute inset-0 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  layoutId="navHover"
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {isPending ? (
              <div className="hidden sm:block size-8 rounded-full bg-white/10 animate-pulse" />
            ) : user ? (
              <HeaderUserMenu
                user={user}
                isScrolled={isScrolled}
                userMenuOpen={userMenuOpen}
                setUserMenuOpen={setUserMenuOpen}
                userMenuRef={userMenuRef}
                canAccessPortal={canAccessPortal}
                onLogout={handleLogout}
              />
            ) : (
              <SignInDropdown isScrolled={isScrolled} />
            )}

            <Link
              href="/contact"
              className={`hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                isScrolled
                  ? "bg-white text-slate-900 hover:bg-blue-50"
                  : "bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20"
              }`}
            >
              Let&apos;s Talk <ArrowRight size={14} />
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className={`lg:hidden p-2 rounded-full transition-colors ${
                isScrolled ? "text-white hover:bg-white/10" : "text-white hover:bg-white/10"
              }`}
            >
              <Menu size={24} />
            </button>
          </div>
        </motion.div>
      </motion.header>

      <AnimatePresence>
        {isOpen && (
          <HeaderMobileMenu
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            navLinks={navLinks}
            user={user}
            canAccessPortal={canAccessPortal}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>
    </>
  );
}
