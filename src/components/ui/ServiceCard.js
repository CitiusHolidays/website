"use client";

import { motion } from "motion/react";
import { cn } from "../../utils/cn";
import { ArrowUpRight } from "lucide-react";

export default function ServiceCard({
  title,
  icon: Icon,
  description,
  className,
  ...props
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "group relative p-8 rounded-3xl overflow-hidden transition-all duration-500",
        "bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-sm", // Glass effect for dark bg
        className
      )}
      {...props}
    >
      {/* Gradient Blob on Hover */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/30 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 opacity-0 group-hover:opacity-100"></div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 group-hover:scale-110 transition-transform duration-300">
                {Icon && (
                    <Icon className="w-8 h-8 text-blue-300 group-hover:text-white transition-colors duration-300" />
                )}
            </div>
            <ArrowUpRight className="text-white/30 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" size={24} />
        </div>
        
        <h3 className="mb-3 text-2xl font-heading font-semibold text-white">
          {title}
        </h3>
        
        {description && (
          <p className="text-slate-400 leading-relaxed group-hover:text-slate-200 transition-colors duration-300">
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}
