"use client";

import { CheckCircle2 } from "lucide-react";
import { m } from "motion/react";

export default function UspElement({ title }) {
  return (
    <m.div
      className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-blue-100 hover:shadow-md"
      initial={{ opacity: 0, x: -20 }}
      viewport={{ once: true }}
      whileHover={{ x: 10 }}
      whileInView={{ opacity: 1, x: 0 }}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-blue-50 transition-colors duration-300 group-hover:bg-blue-500">
        <CheckCircle2 className="size-5 text-blue-600 transition-colors duration-300 group-hover:text-white" />
      </div>
      <span className="font-medium text-brand-dark transition-colors group-hover:text-blue-900">
        {title}
      </span>
    </m.div>
  );
}
