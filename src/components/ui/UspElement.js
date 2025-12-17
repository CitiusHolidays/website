"use client";

import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";

export default function UspElement({ title }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      whileHover={{ x: 10 }}
      className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-300 group"
    >
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-500 transition-colors duration-300">
        <CheckCircle2 className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors duration-300" />
      </div>
      <span className="font-medium text-brand-dark group-hover:text-blue-900 transition-colors">
        {title}
      </span>
    </motion.div>
  );
}
