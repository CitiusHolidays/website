"use client";

import { cn } from "@/lib/utils";

export default function ServiceCard({ title, icon: Icon, description, className, ...props }) {
  return (
    <div
      className={cn(
        "public-service-card relative overflow-hidden rounded-3xl border border-white/15 bg-public-blue/45 p-1",
        className
      )}
      {...props}
    >
      <div className="public-service-card__core flex h-full flex-col rounded-[1.25rem] border border-white/10 bg-public-night p-7">
        <div className="mb-6 flex items-start">
          <div className="rounded-2xl border border-white/15 bg-public-blue/35 p-3">
            {Icon ? <Icon aria-hidden="true" className="size-8 text-blue-200" /> : null}
          </div>
        </div>

        <h3 className="mb-3 font-heading font-semibold text-2xl text-white">{title}</h3>

        {description ? <p className="text-slate-300 leading-relaxed">{description}</p> : null}
      </div>
    </div>
  );
}
