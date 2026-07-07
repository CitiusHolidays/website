"use client";

import { ArrowRight, CheckCircle, Clock, Footprints, Mountain, Plane, Users } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { cn } from "../../utils/cn";

const comparisonData = [
  {
    aerial: "2N/3D",
    aerialDesc: "Weekend retreat",
    icon: Clock,
    label: "Duration",
    yatra: "14 Days",
    yatraDesc: "Complete immersion",
  },
  {
    aerial: "32,000 ft (flight)",
    aerialDesc: "Comfortable altitude",
    icon: Mountain,
    label: "Max Altitude",
    yatra: "5,650m (trek)",
    yatraDesc: "Physical challenge",
  },
  {
    aerial: "Minimal - Road & air",
    aerialDesc: "No walking required",
    icon: Footprints,
    label: "Physical Effort",
    yatra: "High - Trekking",
    yatraDesc: "3 days of Kora",
  },
  {
    aerial: "Seniors, families, busy professionals",
    aerialDesc: "All ages welcome",
    icon: Users,
    label: "Ideal For",
    yatra: "Adventurers, seekers",
    yatraDesc: "Ages 15-70, fit",
  },
  {
    aerial: "Aerial darshan + Temple",
    aerialDesc: "Divine sight from sky",
    icon: Plane,
    label: "Experience",
    yatra: "Full Kora + Lake dip",
    yatraDesc: "Complete pilgrimage",
  },
];

function ComparisonRow({ item, index }) {
  return (
    <m.div
      className="grid grid-cols-1 gap-3 border-brand-light border-b py-4 last:border-0 md:grid-cols-12 md:gap-4 md:py-5"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {/* Feature Label */}
      <div className="flex items-center gap-3 md:col-span-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-citius-blue/10">
          <item.icon className="size-5 text-citius-blue" />
        </div>
        <span className="font-heading font-medium text-brand-dark text-sm md:text-base">
          {item.label}
        </span>
      </div>

      {/* 14-Day Yatra */}
      <div className="rounded-xl border border-citius-blue/10 bg-citius-blue/5 p-4 md:col-span-4">
        <p className="mb-1 font-heading font-semibold text-citius-blue text-sm md:text-base">
          {item.yatra}
        </p>
        <p className="text-brand-muted text-xs md:text-sm">{item.yatraDesc}</p>
      </div>

      {/* Aerial Darshan */}
      <div className="rounded-xl border border-citius-orange/10 bg-citius-orange/5 p-4 md:col-span-4">
        <p className="mb-1 font-heading font-semibold text-citius-orange text-sm md:text-base">
          {item.aerial}
        </p>
        <p className="text-brand-muted text-xs md:text-sm">{item.aerialDesc}</p>
      </div>
    </m.div>
  );
}

export default function JourneyComparison({ className }) {
  return (
    <section className={cn("bg-white py-16 md:py-24", className)}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <m.div
          className="mb-10 text-center md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <span className="mb-4 block font-heading text-citius-orange text-xs uppercase tracking-[0.3em] md:text-sm">
            Choose Your Path
          </span>
          <h2 className="mb-4 font-heading text-3xl text-brand-dark leading-tight md:text-4xl lg:text-5xl">
            Two Ways to <span className="text-citius-blue italic">Kailash</span>
          </h2>
          <p className="mx-auto max-w-2xl font-sans text-base text-brand-muted leading-relaxed md:text-lg">
            Whether you seek the complete pilgrimage experience or divine darshan without physical
            exertion, both paths lead to the same blessings.
          </p>
        </m.div>

        {/* Mobile Cards */}
        <div className="mb-8 space-y-4 md:hidden">
          {/* 14-Day Card */}
          <Link
            className="block rounded-2xl bg-linear-to-br from-citius-blue to-citius-blue/90 p-5 text-white shadow-md transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
            href="/pilgrimage/kailash-mansarovar-14day"
          >
            <m.div
              initial={{ opacity: 0, x: -20 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <h3 className="mb-1 font-heading text-lg">14-Day Yatra</h3>
              <p className="mb-3 text-white/80 text-xs">
                Complete pilgrimage with Kora , tap for full page
              </p>
              <div className="flex items-center justify-end">
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-medium text-citius-blue text-xs">
                  Open trail <ArrowRight className="size-3" />
                </span>
              </div>
            </m.div>
          </Link>

          {/* Aerial Card */}
          <Link
            className="block rounded-2xl bg-linear-to-br from-citius-orange to-citius-orange/90 p-5 text-white shadow-md transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
            href="/pilgrimage/kailash-aerial-3day"
          >
            <m.div
              initial={{ opacity: 0, x: 20 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <h3 className="mb-1 font-heading text-lg">2N/3D Aerial</h3>
              <p className="mb-3 text-white/80 text-xs">
                Divine darshan without trek , tap for full page
              </p>
              <div className="flex items-center justify-end">
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-medium text-citius-orange text-xs">
                  Open trail <ArrowRight className="size-3" />
                </span>
              </div>
            </m.div>
          </Link>
        </div>

        {/* Desktop Comparison Table */}
        <div className="hidden md:block">
          {/* Table Header — full-card links to trail detail pages */}
          <div className="mb-4 grid grid-cols-12 gap-4">
            <div className="col-span-3" />
            <div className="col-span-4 text-center">
              <Link
                className="block rounded-xl bg-citius-blue px-6 py-4 text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                href="/pilgrimage/kailash-mansarovar-14day"
              >
                <h3 className="font-heading font-semibold text-lg">14-Day Yatra</h3>
                <p className="mt-1 text-sm text-white/80">The Complete Journey</p>
                <span className="mt-2 inline-flex items-center justify-center gap-1 font-medium text-white/90 text-xs">
                  View full itinerary <ArrowRight className="size-3.5" />
                </span>
              </Link>
            </div>
            <div className="col-span-4 text-center">
              <Link
                className="block rounded-xl bg-citius-orange px-6 py-4 text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                href="/pilgrimage/kailash-aerial-3day"
              >
                <h3 className="font-heading font-semibold text-lg">2N/3D Aerial</h3>
                <p className="mt-1 text-sm text-white/80">Sky Path Darshan</p>
                <span className="mt-2 inline-flex items-center justify-center gap-1 font-medium text-white/90 text-xs">
                  View full itinerary <ArrowRight className="size-3.5" />
                </span>
              </Link>
            </div>
          </div>

          {/* Comparison Card */}
          <div className="rounded-2xl border border-brand-light bg-white p-6 shadow-brand-dark/5 shadow-lg md:p-8">
            {comparisonData.map((item, index) => (
              <ComparisonRow index={index} item={item} key={item.label} />
            ))}
          </div>
        </div>

        {/* Package Highlights */}
        <m.div
          className="mt-10 grid gap-4 md:mt-14 md:grid-cols-2 md:gap-6"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.3 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {/* 14-Day Highlights */}
          <div className="rounded-2xl border border-citius-blue/10 bg-citius-blue/5 p-5 md:p-6">
            <h4 className="mb-4 flex items-center gap-2 font-heading text-base text-citius-blue md:text-lg">
              <CheckCircle className="size-5" />
              14-Day Yatra Includes
            </h4>
            <ul className="space-y-2 text-brand-dark/80 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-blue" />
                Complete 53km Kora (circumambulation)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-blue" />
                Holy dip in Lake Mansarovar
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-blue" />
                Pashupatinath Temple darshan
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-blue" />
                Drolma La Pass crossing (5,650m)
              </li>
            </ul>
            <div className="mt-4 border-citius-blue/20 border-t pt-4">
              <p className="font-semibold text-citius-blue text-sm">
                Contact us for current rates and availability
              </p>
            </div>
          </div>

          {/* Aerial Highlights */}
          <div className="rounded-2xl border border-citius-orange/10 bg-citius-orange/5 p-5 md:p-6">
            <h4 className="mb-4 flex items-center gap-2 font-heading text-base text-citius-orange md:text-lg">
              <CheckCircle className="size-5" />
              Aerial Darshan Includes
            </h4>
            <ul className="space-y-2 text-brand-dark/80 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                Chartered flight with window seat guarantee
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                Aerial views of Kailash & Mansarovar
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                Bageshwari Temple pooja & hawan
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-citius-orange" />
                Lucknow-Nepalgunj transport in Innova
              </li>
            </ul>
            <div className="mt-4 border-citius-orange/20 border-t pt-4">
              <p className="font-semibold text-citius-orange text-sm">
                Contact us for current rates and availability
              </p>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}
