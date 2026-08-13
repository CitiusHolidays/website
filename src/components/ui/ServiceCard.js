"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export default function ServiceCard({
  title,
  icon: Icon,
  description,
  image,
  className,
  ...props
}) {
  return (
    <article
      className={cn(
        "public-media-edge public-service-card group relative flex min-h-[22rem] items-end overflow-hidden bg-public-night text-white",
        className
      )}
      {...props}
    >
      <Image
        alt=""
        className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:group-hover:scale-[1.03] motion-reduce:transition-none"
        fill
        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 50vw"
        src={image}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-public-night via-public-night/65 to-public-night/10" />
      <div className="relative z-10 flex w-full flex-col justify-end p-7 sm:p-8">
        <div className="mb-5 flex items-start">
          <div className="rounded-2xl border border-white/20 bg-public-night/70 p-3 shadow-lg">
            {Icon ? <Icon aria-hidden="true" className="size-7 text-blue-100" /> : null}
          </div>
        </div>

        <h3 className="mb-3 font-heading font-semibold text-2xl text-white">{title}</h3>

        {description ? (
          <p className="max-w-[44ch] text-slate-200 text-sm leading-6 sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
    </article>
  );
}
