"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Field as BaseField, Input as BaseInput } from "./foundation/base";
import { cva, type VariantProps } from "./foundation/variants";

const fieldRootVariants = cva("block", {
  defaultVariants: { surface: "staff" },
  variants: {
    surface: {
      account: "text-[var(--account-ink)]",
      staff: "text-brand-dark",
    },
  },
});

const labelVariants = cva("mb-1 block font-semibold", {
  defaultVariants: { surface: "staff" },
  variants: {
    surface: {
      account: "text-[10px] text-[var(--account-muted)] uppercase tracking-[0.14em]",
      staff: "text-brand-muted text-xs",
    },
  },
});

export const inputVariants = cva("w-full outline-none transition", {
  defaultVariants: { surface: "staff" },
  variants: {
    surface: {
      account:
        "account-focus rounded-sm border border-[var(--account-border)] bg-white px-4 py-3 text-[var(--account-ink)] shadow-sm focus:border-[var(--account-gold)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--account-paper)] disabled:text-[var(--account-muted)]",
      staff:
        "h-11 rounded-xl border border-brand-border bg-brand-light px-3 text-sm focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10 disabled:cursor-not-allowed disabled:opacity-60",
    },
  },
});

type SurfaceProps = VariantProps<typeof fieldRootVariants>;

export interface FieldProps
  extends Omit<ComponentProps<typeof BaseField.Root>, "children" | "className">,
    SurfaceProps {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
  required?: boolean;
}

export function Field({
  children,
  className,
  description,
  error,
  label,
  required = false,
  surface,
  ...props
}: FieldProps) {
  return (
    <BaseField.Root
      className={cn(fieldRootVariants({ surface }), className)}
      invalid={Boolean(error)}
      {...props}
    >
      <BaseField.Label className={labelVariants({ surface })}>
        {label}
        {required ? (
          <>
            <span
              aria-hidden="true"
              className={surface === "account" ? "" : "text-citius-orange-ink"}
            >
              {" "}
              *
            </span>
            <span className="sr-only"> required</span>
          </>
        ) : null}
      </BaseField.Label>
      {children}
      {description ? (
        <BaseField.Description className="mt-1 text-brand-muted text-xs">
          {description}
        </BaseField.Description>
      ) : null}
      {error ? (
        <BaseField.Error
          className={cn("mt-1 text-xs", surface === "account" ? "text-[#9b3d32]" : "text-red-700")}
          match
          role="alert"
        >
          {error}
        </BaseField.Error>
      ) : null}
    </BaseField.Root>
  );
}

export interface InputProps
  extends Omit<ComponentProps<typeof BaseInput>, "className">,
    VariantProps<typeof inputVariants> {
  className?: string;
}

export function Input({ className, ref, surface, ...props }: InputProps) {
  return <BaseInput className={cn(inputVariants({ surface }), className)} ref={ref} {...props} />;
}

const textareaVariants = cva("w-full outline-none transition", {
  defaultVariants: { surface: "staff" },
  variants: {
    surface: {
      account:
        "account-focus rounded-sm border border-[var(--account-border)] bg-white px-4 py-3 text-[var(--account-ink)] shadow-sm focus:border-[var(--account-gold)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--account-paper)] disabled:text-[var(--account-muted)]",
      staff:
        "rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10 disabled:cursor-not-allowed disabled:opacity-60",
    },
  },
});

export interface TextareaProps
  extends Omit<ComponentProps<"textarea">, "className">,
    VariantProps<typeof textareaVariants> {
  className?: string;
}

export function Textarea({ className, ref, surface, ...props }: TextareaProps) {
  return <textarea className={cn(textareaVariants({ surface }), className)} ref={ref} {...props} />;
}
