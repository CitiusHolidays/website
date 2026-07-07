import { createLucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import Logo from "@/static/logos/logo.webp";
import IATA from "@/static/partners/iata.webp";
import IncredibleIndia from "@/static/partners/incredibleindiafooter.webp";

const brandFill = { fill: "currentColor", stroke: "none" };
const CURRENT_YEAR = new Date().getFullYear();

const XIcon = createLucideIcon("X", [
  [
    "path",
    {
      d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
      key: "x-brand-path",
      ...brandFill,
    },
  ],
]);

/** Lucide dropped brand icons; keep glyphs in-repo (same pattern as X). */
const FacebookIcon = createLucideIcon("FacebookBrand", [
  [
    "path",
    {
      d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
      key: "fb",
      ...brandFill,
    },
  ],
]);

const InstagramIcon = createLucideIcon("InstagramBrand", [
  [
    "path",
    {
      d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324z",
      key: "ig-body",
      ...brandFill,
    },
  ],
  [
    "path",
    {
      d: "M16.649 7.51a1.44 1.44 0 11-2.878 0 1.44 1.44 0 012.878 0z",
      key: "ig-dot",
      ...brandFill,
    },
  ],
]);

const LinkedinIcon = createLucideIcon("LinkedinBrand", [
  [
    "path",
    {
      d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
      key: "li",
      ...brandFill,
    },
  ],
]);

const offices = [
  {
    address: "214 Swastik Plaza\nPokhran Road No 2\nThane West 400610",
    city: "Mumbai",
    phone: "+91 9920993259",
  },
  {
    address:
      "Pachie's 3rd Floor\nBuilding Number: 982\n3rd Cross Road\nKalyan Nagar\nBengaluru 560043",
    city: "Bengaluru",
    phone: "+91 99008 14292",
  },
  {
    address: "207, The Chambers, 1865 Rajdanga\nMain Road Kolkata, West\nBengal 700107",
    city: "Kolkata",
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

export default function Footer() {
  return (
    <footer className="bg-[url('/gallery/bgfooter.webp')] bg-brand-dark bg-center bg-cover text-brand-light">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-16 sm:grid-cols-2 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <Image alt="Citius Logo" className="mb-2" height={48} src={Logo} width={140} />
          <p className="text-citius-orange text-sm">We Inspire to Travel</p>
          <div className="mx-auto mt-4 flex flex-col">
            <div className="px-8">
              <Image alt="IATA Logo" height={60} src={IATA} width={60} />
            </div>
            <div className="px-3">
              <Image alt="Incredible India Logo" height={100} src={IncredibleIndia} width={100} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 font-semibold text-lg">Our Offices</h3>
          <ul className="space-y-4 text-sm">
            {offices.map((office) => (
              <li key={office.city}>
                <p className="font-medium text-brand-light">{office.city}</p>
                <p className="whitespace-pre-line text-brand-muted">{office.address}</p>
                <p className="text-brand-muted">{office.phone}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-semibold text-lg">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  className="inline-block transition-transform duration-200 hover:translate-x-1 hover:text-brand-light"
                  href={link.href}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-lg">Follow Us</h3>
          <div className="flex gap-4">
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                aria-label="Instagram"
                className="text-brand-muted transition-colors hover:text-white"
                href="https://www.instagram.com/citius_holidays/?hl=en"
              >
                <InstagramIcon className="size-6" />
              </Link>
            </div>
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                aria-label="Twitter"
                className="text-brand-muted transition-colors hover:text-white"
                href="https://x.com/citiusholidays"
              >
                <XIcon className="size-6" />
              </Link>
            </div>
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                aria-label="Facebook"
                className="text-brand-muted transition-colors hover:text-white"
                href="https://www.facebook.com/citiusholidays"
              >
                <FacebookIcon className="size-6" />
              </Link>
            </div>
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                aria-label="LinkedIn"
                className="text-brand-muted transition-colors hover:text-white"
                href="https://linkedin.com/company/citius-holidays"
              >
                <LinkedinIcon className="size-6" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-brand-dark/20 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between px-4 text-brand-muted text-sm sm:flex-row">
          <p>© {CURRENT_YEAR} Citius. All Rights Reserved.</p>
          <div className="mt-2 flex gap-4 sm:mt-0 sm:gap-6">
            <Link
              className="transition-colors hover:text-citius-orange"
              href="/policies"
              target="_blank"
            >
              Terms & Conditions
            </Link>
            <Link
              className="transition-colors hover:text-citius-orange"
              href="/policies"
              target="_blank"
            >
              Billing Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
