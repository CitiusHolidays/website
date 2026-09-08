"use client";

import {
  Briefcase,
  FileBadge,
  Globe,
  MapPinned,
  Medal,
  Plane,
  ShieldCheck,
  Star,
  Sun,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { PUBLIC_SERVICES } from "@/data/publicServices";

const serviceIcons = {
  branding: Star,
  "celebrity-management": Medal,
  "domestic-travel": MapPinned,
  "event-management": Users,
  "international-travel": Globe,
  mice: Briefcase,
  "onsite-travel-desk": Plane,
  "spiritual-trails": Sun,
  "sporting-events": Trophy,
  "travel-insurance": ShieldCheck,
  "visa-assistance": FileBadge,
};

const services = PUBLIC_SERVICES.map((service) => ({
  ...service,
  icon: serviceIcons[service.id],
}));

export default function CircularServicesMenu() {
  return (
    <ul className="grid list-none gap-x-10 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => {
        const ServiceIcon = service.icon;
        const hasDetailPage = service.path !== "/services";
        return (
          <li className="min-w-0 border-public-blue/15 border-t py-6" key={service.id}>
            <ServiceIcon aria-hidden="true" className="mb-4 size-6 text-public-blue" />
            <h2 className="font-heading font-semibold text-public-ink text-xl">{service.title}</h2>
            <p className="mt-2 text-public-muted leading-relaxed">{service.description}</p>
            <Link
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-public-blue underline underline-offset-4 hover:text-public-orange-ink focus-visible:outline-2 focus-visible:outline-public-orange-ink focus-visible:outline-offset-4"
              href={hasDetailPage ? service.path : "/contact"}
            >
              {hasDetailPage ? "Explore" : "Enquire about"} {service.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
