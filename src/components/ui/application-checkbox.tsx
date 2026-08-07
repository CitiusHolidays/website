"use client";

import { Check, Minus } from "lucide-react";
import { type ComponentProps, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Checkbox as BaseCheckbox } from "./foundation/base";

export interface CheckboxProps
  extends Omit<
    ComponentProps<typeof BaseCheckbox.Root>,
    "children" | "className" | "onCheckedChange"
  > {
  children?: ReactNode;
  className?: string;
  controlClassName?: string;
  indicatorClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
  checked,
  children,
  className,
  controlClassName,
  indeterminate,
  indicatorClassName,
  inputRef,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const nativeInputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (nativeInputRef.current) {
      nativeInputRef.current.indeterminate = Boolean(indeterminate);
    }
    if (typeof inputRef === "function") {
      inputRef(nativeInputRef.current);
    } else if (inputRef) {
      inputRef.current = nativeInputRef.current;
    }
    return () => {
      if (typeof inputRef === "function") {
        inputRef(null);
      } else if (inputRef) {
        inputRef.current = null;
      }
    };
  }, [indeterminate, inputRef]);
  return (
    <BaseCheckbox.Root
      checked={checked}
      className={cn(
        "group inline-flex cursor-pointer items-center outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
        className
      )}
      data-slot="checkbox"
      indeterminate={indeterminate}
      inputRef={nativeInputRef}
      onCheckedChange={onCheckedChange}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded border border-brand-border bg-white text-white transition group-focus-visible:ring-2 group-focus-visible:ring-citius-blue/20 group-data-[checked]:border-citius-blue group-data-[indeterminate]:border-citius-blue group-data-[checked]:bg-citius-blue group-data-[indeterminate]:bg-citius-blue",
          controlClassName
        )}
      >
        <BaseCheckbox.Indicator
          className={cn("grid place-items-center", indicatorClassName)}
          keepMounted
        >
          {indeterminate ? (
            <Minus aria-hidden size={14} strokeWidth={2.5} />
          ) : (
            <Check aria-hidden size={14} strokeWidth={2.5} />
          )}
        </BaseCheckbox.Indicator>
      </span>
      {children}
    </BaseCheckbox.Root>
  );
}
