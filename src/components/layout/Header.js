"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { Menu, X, ArrowRight, User, LogOut, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useSession, logout } from "@/lib/auth-client";

import Logo from "@/static/logos/logo.png";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/mice", label: "MICE" },
  { href: "/pilgrimage", label: "Spiritual Trails" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');

  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const userMenuRef = useRef(null);

  // Get session data
  const { data: session, isPending } = useSession();
  const user = session?.user;

  useTransform(scrollY, [0, 100], [0, 1]);

  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", updateScroll);
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  // Close user menu when clicking outside
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

  // Do not render the header on auth pages
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
          {/* Logo */}
          <Link
            href="/"
            className="relative z-10 flex items-center gap-2 group"
          >
            <div
              className={`relative transition-all duration-300 ${isScrolled ? "scale-90" : "scale-100"}`}
            >
              <div className={`rounded p-1`}>
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

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 group overflow-hidden rounded-full ${
                  isScrolled
                    ? "text-slate-300 hover:text-white"
                    : "text-white hover:text-white"
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

          {/* CTA / User Menu / Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            {/* User Authentication Section */}
            {isPending ? (
              // Loading state
              <div className="hidden sm:block w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : user ? (
              // Logged in - User dropdown
              <div className="relative" ref={userMenuRef}>
                <button
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
                    <div className="w-7 h-7 rounded-full bg-citius-orange flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {user.name?.charAt(0)?.toUpperCase() ||
                          user.email?.charAt(0)?.toUpperCase() ||
                          "U"}
                      </span>
                    </div>
                  )}
                  {isScrolled ? (
                    <></>
                  ) : (
                    <span className="hidden md:inline max-w-[100px] truncate">
                      {user.name?.split(" ")[0] || "Account"}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* User Dropdown Menu */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 py-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50"
                    >
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        <Link
                          href="/account"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <User size={16} />
                          My Account
                        </Link>
                        <button
                          onClick={handleLogout}
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
            ) : (
              // Not logged in - Sign in button
              <Link
                href="/auth"
                className={`hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  isScrolled
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20"
                }`}
              >
                <User size={16} />
                Sign In
              </Link>
            )}

            {/* Let's Talk CTA */}
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
              onClick={() => setIsOpen(true)}
              className={`lg:hidden p-2 rounded-full transition-colors ${
                isScrolled
                  ? "text-white hover:bg-white/10"
                  : "text-white hover:bg-white/10"
              }`}
            >
              <Menu size={24} />
            </button>
          </div>
        </motion.div>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/98 backdrop-blur-xl flex flex-col justify-center items-center"
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-8 right-8 p-4 text-white/50 hover:text-white transition-colors"
            >
              <X size={32} />
            </button>

            <nav className="flex flex-col items-center gap-8">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-4xl font-heading font-light text-white hover:text-blue-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Mobile Auth Section */}
            <motion.div
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
                      <div className="w-8 h-8 rounded-full bg-citius-orange flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                      </div>
                    )}
                    <span className="text-white font-medium">
                      {user.name?.split(" ")[0]}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                    className="text-lg text-red-400 hover:text-red-300 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-6 py-3 bg-citius-orange text-white rounded-full font-medium hover:bg-citius-orange/90 transition-colors"
                >
                  <User size={18} />
                  Sign In
                </Link>
              )}
            </motion.div>

            <motion.div
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
