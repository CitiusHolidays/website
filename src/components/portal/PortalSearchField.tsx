"use client";

import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/application-field";
import { cn } from "@/lib/utils";

interface PortalSearchFieldProps extends Omit<ComponentProps<typeof Input>, "aria-label"> {
  label: string;
  wrapperClassName?: string;
}

export function PortalSearchField({
  className,
  label,
  wrapperClassName,
  ...props
}: PortalSearchFieldProps) {
  return (
    <div className={cn("relative block", wrapperClassName)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-brand-muted/60"
      />
      <Input
        aria-label={label}
        className={cn(
          "portal-toolbar-control h-11 w-full rounded-xl border border-brand-border bg-white ps-9 pe-3 text-base outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 sm:text-sm",
          className
        )}
        type="search"
        {...props}
      />
    </div>
  );
}
