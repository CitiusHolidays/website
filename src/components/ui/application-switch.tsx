"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Switch as BaseSwitch } from "./foundation/base";

export interface SwitchProps
  extends Omit<
    ComponentProps<typeof BaseSwitch.Root>,
    "children" | "className" | "onCheckedChange"
  > {
  children?: ReactNode;
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
  surface?: "account" | "staff";
  thumbClassName?: string;
}

export function Switch({
  children,
  className,
  onCheckedChange,
  surface = "staff",
  thumbClassName,
  ...props
}: SwitchProps) {
  return (
    <BaseSwitch.Root
      className={cn(
        surface === "account"
          ? "account-focus relative inline-block"
          : "relative inline-flex h-6 w-11 items-center rounded-full bg-brand-border p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-citius-blue/20 data-[disabled]:cursor-not-allowed data-[checked]:bg-citius-blue data-[disabled]:opacity-60",
        className
      )}
      data-slot="switch"
      onCheckedChange={onCheckedChange}
      {...props}
    >
      {children ?? (
        <BaseSwitch.Thumb
          className={cn(
            "block size-4 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5",
            thumbClassName
          )}
        />
      )}
    </BaseSwitch.Root>
  );
}
