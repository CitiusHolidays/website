"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export default function LogoNameReveal({ alt, className, src }) {
  return (
    <div
      className={cn(
        "group relative flex size-full items-center justify-center overflow-hidden",
        className
      )}
    >
      <Image
        alt={alt}
        className="size-full object-contain transition-[filter,opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] fine-hover:group-hover:scale-90 fine-hover:group-hover:opacity-30 fine-hover:group-hover:blur-[5px] motion-reduce:transition-none"
        height={60}
        src={src}
        width={120}
      />
      <p className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 px-2 text-center font-semibold text-brand-dark text-xs uppercase tracking-wide opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] fine-hover:group-hover:opacity-100 motion-reduce:transition-none">
        {alt}
      </p>
    </div>
  );
}
