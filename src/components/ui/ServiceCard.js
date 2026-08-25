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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(72,105,190,0.72),transparent_42%),linear-gradient(145deg,#101a3b_0%,#0B1026_58%,#213b77_100%)]" />
      <Image
        alt=""
        className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:group-hover:scale-[1.03] motion-reduce:transition-none"
        fill
        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 50vw"
        src={image}
      />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] opacity-40 [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      {Icon ? (
        <Icon
          aria-hidden="true"
          className="absolute -top-8 -right-8 size-48 text-white/[0.055] transition-transform duration-300 fine-hover:group-hover:-translate-x-2 fine-hover:group-hover:translate-y-2 motion-reduce:transition-none"
          strokeWidth={1}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-public-night via-public-night/25 to-transparent" />
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
