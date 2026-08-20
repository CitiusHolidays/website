"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  fieldRootVariants,
  inputVariants,
  labelVariants,
  textareaVariants,
} from "./application-field-variants";
import { Field as BaseField, Input as BaseInput } from "./foundation/base";
import type { VariantProps } from "./foundation/variants";

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

export interface TextareaProps
  extends Omit<ComponentProps<"textarea">, "className">,
    VariantProps<typeof textareaVariants> {
  className?: string;
}

export function Textarea({ className, ref, surface, ...props }: TextareaProps) {
  return <textarea className={cn(textareaVariants({ surface }), className)} ref={ref} {...props} />;
}
