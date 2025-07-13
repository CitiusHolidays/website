"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import Logo from "@/static/logos/logo.png";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/services", label: "Services" },
  { href: "/mice", label: "MICE" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const mobileMenuVariants = {
  hidden: {
    opacity: 0,
    x: "100%",
  },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: "easeInOut",
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    x: "100%",
    transition: {
      duration: 0.2,
      ease: "easeInOut",
    },
  },
};

const navLinkVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      ease: "easeOut",
    },
  },
};

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className={`fixed top-0 z-50 w-full transition-colors duration-100
        ${isOpen ? "bg-white shadow text-brand-dark" : ""}
        ${!isOpen && scrolled ? "backdrop-blur-lg bg-white/95 text-brand-dark shadow-sm" : ""}
        ${!isOpen && !scrolled ? "bg-transparent text-brand-dark hover:bg-brand-dark/60 hover:text-brand-light" : ""}
        lg:${scrolled ? "backdrop-blur-lg bg-white/95 text-brand-dark shadow-sm" : "bg-transparent text-brand-dark hover:bg-brand-dark/60 hover:text-brand-light"}
      `}
    >
      <div className="flex justify-between items-center px-4 mx-auto max-w-7xl h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex gap-2 items-center">
          <Image
            src={Logo}
            alt="Citius Logo"
            width={120}
            height={40}
            priority
          />
        </Link>

        <motion.nav className="hidden gap-8 items-center lg:flex" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
          {navLinks.map((link) => (
            <motion.div key={link.href} whileHover={{ y: -3 }} variants={navLinkVariants}>
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors hover:text-citius-orange"
              >
                {link.label}
              </Link>
            </motion.div>
          ))}
        </motion.nav>
        <button
          type="button"
          className="inline-flex justify-center items-center p-2 rounded-md lg:hidden text-brand-dark hover:text-citius-orange focus:outline-none"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="flex fixed inset-0 z-50 flex-col p-6 backdrop-blur-lg bg-white/95"
            variants={mobileMenuVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex justify-between items-center mb-8">
              <Image src={Logo} alt="Citius Logo" width={120} height={40} />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-6 h-6 text-brand-dark" />
              </button>
            </div>
            <motion.nav
              className="flex flex-col flex-1 gap-6"
            >
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  variants={navLinkVariants}
                  initial="hidden"
                  animate="show"
                  custom={i}
                  whileHover={{ x: 5 }}
                >
                  <Link
                    href={link.href}
                    className="text-lg font-medium text-brand-dark hover:text-citius-orange"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
