"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Radio as BaseRadio, RadioGroup as BaseRadioGroup } from "./foundation/base";

export interface RadioGroupProps<Value extends string = string>
  extends Omit<ComponentProps<typeof BaseRadioGroup<Value>>, "onValueChange"> {
  onValueChange?: (value: Value) => void;
}

export function RadioGroup<Value extends string = string>({
  onValueChange,
  ...props
}: RadioGroupProps<Value>) {
  return <BaseRadioGroup<Value> onValueChange={onValueChange} {...props} />;
}

export interface RadioProps<Value extends string = string>
  extends Omit<ComponentProps<typeof BaseRadio.Root<Value>>, "children" | "className"> {
  appearance?: "control" | "hidden";
  children?: ReactNode;
  className?: string;
  value: Value;
}

export function Radio<Value extends string = string>({
  appearance = "control",
  children,
  className,
  ...props
}: RadioProps<Value>) {
  return (
    <BaseRadio.Root<Value>
      className={cn(
        appearance === "hidden"
          ? "peer sr-only"
          : "inline-grid size-5 shrink-0 place-items-center rounded-full border border-brand-border bg-white outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus-visible:ring-2 focus-visible:ring-citius-blue/20 data-[checked]:border-citius-blue",
        className
      )}
      data-slot="radio"
      {...props}
    >
      {children ?? (
        <BaseRadio.Indicator className="size-2.5 rounded-full bg-citius-blue" keepMounted />
      )}
    </BaseRadio.Root>
  );
}
