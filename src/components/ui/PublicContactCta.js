"use client";

import Link from "next/link";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import AirplaneIcon from "./AirplaneIcon";

const toneClasses = {
  glass:
    "material-floating border-white/25 bg-white/10 text-white shadow-lg [--material-preference-background:var(--color-public-night)] [--material-preference-boundary:var(--color-public-surface)] fine-hover:hover:bg-white/20",
  light:
    "border-transparent bg-public-surface text-public-night shadow-xl fine-hover:hover:bg-blue-50 fine-hover:hover:shadow-2xl",
};

const islandClasses = {
  glass: "bg-public-surface text-public-night",
  light: "bg-public-night text-white",
};

const sizeClasses = {
  compact: "min-h-11 gap-2 py-1.5 ps-5 pe-1.5 text-sm",
  large: "min-h-14 gap-3 py-2 ps-7 pe-2 text-sm sm:ps-8",
};

const islandSizeClasses = {
  compact: "size-8",
  large: "size-10",
};

export default function PublicContactCta({
  children,
  className,
  href = "/contact",
  size = "large",
  tone = "light",
}) {
  const iconRef = useRef(null);
  const startIcon = () => {
    if (globalThis.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
      iconRef.current?.startAnimation();
    }
  };
  const stopIcon = () => iconRef.current?.stopAnimation();

  return (
    <Link
      className={cn(
        "group motion-reduce-spatial inline-flex w-fit items-center justify-center rounded-full border font-semibold transition-[transform,background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-3 active:scale-[0.98]",
        sizeClasses[size],
        toneClasses[tone],
        className
      )}
      href={href}
      onMouseEnter={startIcon}
      onMouseLeave={stopIcon}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full",
          islandSizeClasses[size],
          islandClasses[tone]
        )}
      >
        <AirplaneIcon
          className="motion-reduce-spatial"
          ref={iconRef}
          size={size === "compact" ? 15 : 17}
        />
      </span>
    </Link>
  );
}
