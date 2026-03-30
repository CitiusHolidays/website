"use client";

import { createLucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";

import Logo from "@/static/logos/logo.webp";
import IATA from "@/static/partners/iata.webp";
import IncredibleIndia from "@/static/partners/incredibleindiafooter.webp";

const brandFill = { stroke: "none", fill: "currentColor" };

const XIcon = createLucideIcon("X", [
  [
    "path",
    {
      key: "x-brand-path",
      d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
      ...brandFill,
    },
  ],
]);

/** Lucide dropped brand icons; keep glyphs in-repo (same pattern as X). */
const FacebookIcon = createLucideIcon("FacebookBrand", [
  [
    "path",
    {
      key: "fb",
      d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
      ...brandFill,
    },
  ],
]);

const InstagramIcon = createLucideIcon("InstagramBrand", [
  [
    "path",
    {
      key: "ig-body",
      d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324z",
      ...brandFill,
    },
  ],
  [
    "path",
    {
      key: "ig-dot",
      d: "M16.649 7.51a1.44 1.44 0 11-2.878 0 1.44 1.44 0 012.878 0z",
      ...brandFill,
    },
  ],
]);

const LinkedinIcon = createLucideIcon("LinkedinBrand", [
  [
    "path",
    {
      key: "li",
      d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
      ...brandFill,
    },
  ],
]);

const offices = [
  {
    city: "Mumbai",
    address: "214 Swastik Plaza\nPokhran Road No 2\nThane West 400610",
    phone: "+91 9920993259",
  },
  {
    city: "Bengaluru",
    address:
      "Pachie's 3rd Floor\nBuilding Number: 982\n3rd Cross Road\nKalyan Nagar\nBengaluru 560043",
    phone: "+91 99008 14292",
  },
  {
    city: "Kolkata",
    address:
      "207, The Chambers, 1865 Rajdanga\nMain Road Kolkata, West\nBengal 700107",
    phone: "+91 98310 82929",
  },
];

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/services", label: "Services" },
  { href: "/mice", label: "MICE" },
  { href: "/pilgrimage", label: "Spiritual Trails" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/policies", label: "Legal & Policies" },
];

const footerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { ease: "easeOut" } },
};

export default function Footer() {
  return (
    <footer className="bg-brand-dark bg-[url('/gallery/bgfooter.webp')] bg-cover bg-center text-brand-light">
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12"
        variants={footerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div variants={itemVariants}>
          <Image
            src={Logo}
            alt="Citius Logo"
            width={140}
            height={48}
            className="mb-2"
          />
          <p className="text-sm text-citius-orange">We Inspire to Travel</p>
          <div className="flex flex-col mx-auto mt-4">
            <div className="px-8">
              <Image src={IATA} alt="IATA Logo" width={60} height={60} />
            </div>
            <div className="px-3">
              <Image
                src={IncredibleIndia}
                alt="Incredible India Logo"
                width={100}
                height={100}
              />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold mb-4">Our Offices</h3>
          <ul className="space-y-4 text-sm">
            {offices.map((office) => (
              <li key={office.city}>
                <p className="font-medium text-brand-light">{office.city}</p>
                <p className="text-brand-muted whitespace-pre-line">
                  {office.address}
                </p>
                <p className="text-brand-muted">{office.phone}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            {quickLinks.map((link) => (
              <motion.li key={link.href} whileHover={{ x: 5 }}>
                <Link href={link.href} className="hover:text-brand-light">
                  {link.label}
                </Link>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h3 className="text-lg font-semibold mb-2">Follow Us</h3>
          <div className="flex gap-4">
            <motion.div whileHover={{ y: -3 }}>
              <Link
                href="https://www.instagram.com/citius_holidays/?hl=en"
                aria-label="Instagram"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <InstagramIcon className="w-6 h-6" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -3 }}>
              <Link
                href="https://x.com/citiusholidays"
                aria-label="Twitter"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -3 }}>
              <Link
                href="https://www.facebook.com/citiusholidays"
                aria-label="Facebook"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <FacebookIcon className="w-6 h-6" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -3 }}>
              <Link
                href="https://linkedin.com/company/citius-holidays"
                aria-label="LinkedIn"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <LinkedinIcon className="w-6 h-6" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      <div className="bg-brand-dark/20 py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-sm text-brand-muted">
          <p>© {new Date().getFullYear()} Citius. All Rights Reserved.</p>
          <div className="flex gap-4 sm:gap-6 mt-2 sm:mt-0">
            <Link 
              href="/policies" 
              target="_blank" 
              className="hover:text-citius-orange transition-colors"
            >
              Terms & Conditions
            </Link>
            <Link 
              href="/policies" 
              target="_blank" 
              className="hover:text-citius-orange transition-colors"
            >
              Billing Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
