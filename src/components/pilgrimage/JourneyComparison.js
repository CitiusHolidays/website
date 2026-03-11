"use client";

import { motion } from "motion/react";
import { 
  Clock, Mountain, Users, CheckCircle, 
  Plane, Footprints, ArrowRight
} from "lucide-react";
import { cn } from "../../utils/cn";

const comparisonData = [
  {
    icon: Clock,
    label: "Duration",
    yatra: "14 Days",
    aerial: "2N/3D",
    yatraDesc: "Complete immersion",
    aerialDesc: "Weekend retreat"
  },
  {
    icon: Mountain,
    label: "Max Altitude",
    yatra: "5,650m (trek)",
    aerial: "32,000 ft (flight)",
    yatraDesc: "Physical challenge",
    aerialDesc: "Comfortable altitude"
  },
  {
    icon: Footprints,
    label: "Physical Effort",
    yatra: "High - Trekking",
    aerial: "Minimal - Road & air",
    yatraDesc: "3 days of Kora",
    aerialDesc: "No walking required"
  },
  {
    icon: Users,
    label: "Ideal For",
    yatra: "Adventurers, seekers",
    aerial: "Seniors, families, busy professionals",
    yatraDesc: "Ages 15-70, fit",
    aerialDesc: "All ages welcome"
  },
  {
    icon: Plane,
    label: "Experience",
    yatra: "Full Kora + Lake dip",
    aerial: "Aerial darshan + Temple",
    yatraDesc: "Complete pilgrimage",
    aerialDesc: "Divine sight from sky"
  }
];

function ComparisonRow({ item, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 py-4 md:py-5 border-b border-brand-light last:border-0"
    >
      {/* Feature Label */}
      <div className="md:col-span-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-citius-blue/10 flex items-center justify-center shrink-0">
          <item.icon className="w-5 h-5 text-citius-blue" />
        </div>
        <span className="font-heading text-sm md:text-base text-brand-dark font-medium">
          {item.label}
        </span>
      </div>

      {/* 14-Day Yatra */}
      <div className="md:col-span-4 bg-citius-blue/5 rounded-xl p-4 border border-citius-blue/10">
        <p className="font-heading text-sm md:text-base text-citius-blue font-semibold mb-1">
          {item.yatra}
        </p>
        <p className="text-xs md:text-sm text-brand-muted">
          {item.yatraDesc}
        </p>
      </div>

      {/* Aerial Darshan */}
      <div className="md:col-span-4 bg-citius-orange/5 rounded-xl p-4 border border-citius-orange/10">
        <p className="font-heading text-sm md:text-base text-citius-orange font-semibold mb-1">
          {item.aerial}
        </p>
        <p className="text-xs md:text-sm text-brand-muted">
          {item.aerialDesc}
        </p>
      </div>
    </motion.div>
  );
}

export default function JourneyComparison({ className }) {
  return (
    <section className={cn("py-16 md:py-24 bg-white", className)}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 md:mb-16"
        >
          <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.3em] uppercase mb-4 block">
            Choose Your Path
          </span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl text-brand-dark mb-4 leading-tight">
            Two Ways to <span className="text-citius-blue italic">Kailash</span>
          </h2>
          <p className="font-sans text-base md:text-lg text-brand-muted max-w-2xl mx-auto leading-relaxed">
            Whether you seek the complete pilgrimage experience or divine darshan without physical exertion, 
            both paths lead to the same blessings.
          </p>
        </motion.div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4 mb-8">
          {/* 14-Day Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-linear-to-br from-citius-blue to-citius-blue/90 rounded-2xl p-5 text-white"
          >
            <h3 className="font-heading text-lg mb-1">14-Day Yatra</h3>
            <p className="text-white/80 text-xs mb-3">Complete pilgrimage with Kora</p>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold">INR 2.65L</span>
              <a
                href="#package-14day"
                className="bg-white text-citius-blue px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1"
              >
                Details <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </motion.div>

          {/* Aerial Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-linear-to-br from-citius-orange to-citius-orange/90 rounded-2xl p-5 text-white"
          >
            <h3 className="font-heading text-lg mb-1">2N/3D Aerial</h3>
            <p className="text-white/80 text-xs mb-3">Divine darshan without trek</p>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold">INR 49,500</span>
              <a
                href="#package-aerial"
                className="bg-white text-citius-orange px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1"
              >
                Details <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        </div>

        {/* Desktop Comparison Table */}
        <div className="hidden md:block">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-3" />
            <div className="col-span-4 text-center">
              <div className="bg-citius-blue text-white px-6 py-4 rounded-xl shadow-md">
                <h3 className="font-heading text-lg font-semibold">14-Day Yatra</h3>
                <p className="text-sm text-white/80 mt-1">The Complete Journey</p>
              </div>
            </div>
            <div className="col-span-4 text-center">
              <div className="bg-citius-orange text-white px-6 py-4 rounded-xl shadow-md">
                <h3 className="font-heading text-lg font-semibold">2N/3D Aerial</h3>
                <p className="text-sm text-white/80 mt-1">Sky Path Darshan</p>
              </div>
            </div>
          </div>

          {/* Comparison Card */}
          <div className="bg-white rounded-2xl shadow-lg shadow-brand-dark/5 border border-brand-light p-6 md:p-8">
            {comparisonData.map((item, index) => (
              <ComparisonRow key={item.label} item={item} index={index} />
            ))}
          </div>
        </div>

        {/* Package Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 md:mt-14 grid md:grid-cols-2 gap-4 md:gap-6"
        >
          {/* 14-Day Highlights */}
          <div className="bg-citius-blue/5 rounded-2xl p-5 md:p-6 border border-citius-blue/10">
            <h4 className="font-heading text-citius-blue text-base md:text-lg mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              14-Day Yatra Includes
            </h4>
            <ul className="space-y-2 text-sm text-brand-dark/80">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-blue rounded-full mt-2 shrink-0" />
                Complete 53km Kora (circumambulation)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-blue rounded-full mt-2 shrink-0" />
                Holy dip in Lake Mansarovar
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-blue rounded-full mt-2 shrink-0" />
                Pashupatinath Temple darshan
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-blue rounded-full mt-2 shrink-0" />
                Drolma La Pass crossing (5,650m)
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-citius-blue/20">
              <p className="text-citius-blue font-semibold text-sm">Starting at INR 2.65 Lakh + GST</p>
            </div>
          </div>

          {/* Aerial Highlights */}
          <div className="bg-citius-orange/5 rounded-2xl p-5 md:p-6 border border-citius-orange/10">
            <h4 className="font-heading text-citius-orange text-base md:text-lg mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Aerial Darshan Includes
            </h4>
            <ul className="space-y-2 text-sm text-brand-dark/80">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-orange rounded-full mt-2 shrink-0" />
                Chartered flight with window seat guarantee
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-orange rounded-full mt-2 shrink-0" />
                Aerial views of Kailash & Mansarovar
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-orange rounded-full mt-2 shrink-0" />
                Bageshwari Temple pooja & hawan
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-citius-orange rounded-full mt-2 shrink-0" />
                Lucknow-Nepalgunj transport in Innova
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-citius-orange/20">
              <p className="text-citius-orange font-semibold text-sm">Starting at INR 49,500 + GST</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
