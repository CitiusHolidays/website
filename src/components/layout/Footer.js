import { createLucideIcon, Facebook, Instagram, Linkedin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import Logo from "@/static/logos/logo.webp";
import IATA from "@/static/partners/iata.webp";
import IncredibleIndia from "@/static/partners/incredibleindiafooter.webp";

const XIcon = createLucideIcon("X", [
  [
    "path",
    {
      key: "x-brand-path",
      d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
      stroke: "none",
      fill: "currentColor",
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

export default function Footer() {
  return (
    <footer className="bg-brand-dark bg-[url('/gallery/bgfooter.webp')] bg-cover bg-center text-brand-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">
        <div>
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
        </div>

        <div>
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
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-block hover:text-brand-light transition-transform duration-200 hover:translate-x-1"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Follow Us</h3>
          <div className="flex gap-4">
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                href="https://www.instagram.com/citius_holidays/?hl=en"
                aria-label="Instagram"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <Instagram className="w-6 h-6" />
              </Link>
            </div>
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                href="https://x.com/citiusholidays"
                aria-label="Twitter"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </Link>
            </div>
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                href="https://www.facebook.com/citiusholidays"
                aria-label="Facebook"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <Facebook className="w-6 h-6" />
              </Link>
            </div>
            <div className="transition-transform duration-200 hover:-translate-y-0.5">
              <Link
                href="https://linkedin.com/company/citius-holidays"
                aria-label="LinkedIn"
                className="text-brand-muted hover:text-white transition-colors"
              >
                <Linkedin className="w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </div>

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
