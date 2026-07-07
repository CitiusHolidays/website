"use client";

import { ArrowUpRight } from "lucide-react";
import { m } from "motion/react";
import { cn } from "../../utils/cn";

export default function ServiceCard({ title, icon: Icon, description, className, ...props }) {
  return (
    <m.div
      className={cn(
        "group relative overflow-hidden rounded-3xl p-8 transition-all duration-500",
        "border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10", // Glass effect for dark bg
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      viewport={{ margin: "-50px", once: true }}
      whileHover={{ y: -10 }}
      whileInView={{ opacity: 1, y: 0 }}
      {...props}
    >
      {/* Gradient Blob on Hover */}
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-blue-500/30 opacity-0 blur-3xl transition-transform duration-700 group-hover:scale-150 group-hover:opacity-100" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-6 flex items-start justify-between">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-3 transition-transform duration-300 group-hover:scale-110">
            {Icon && (
              <Icon className="size-8 text-blue-300 transition-colors duration-300 group-hover:text-white" />
            )}
          </div>
          <ArrowUpRight
            className="text-white/30 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-white"
            size={24}
          />
        </div>

        <h3 className="mb-3 font-heading font-semibold text-2xl text-white">{title}</h3>

        {description && (
          <p className="text-slate-400 leading-relaxed transition-colors duration-300 group-hover:text-slate-200">
            {description}
          </p>
        )}
      </div>
    </m.div>
  );
}
