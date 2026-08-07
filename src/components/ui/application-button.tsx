"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button as BaseButton } from "./foundation/base";
import { cva, type VariantProps } from "./foundation/variants";

export const buttonVariants = cva(
  "disabled:cursor-not-allowed disabled:opacity-60 data-[loading]:cursor-wait",
  {
    compoundVariants: [
      {
        className:
          "account-focus inline-flex min-h-11 items-center justify-center transition-colors",
        surface: "account",
      },
      {
        className: "min-h-11 min-w-11",
        iconOnly: true,
      },
    ],
    defaultVariants: {
      iconOnly: false,
      surface: "staff",
      variant: "bare",
    },
    variants: {
      iconOnly: {
        false: "",
        true: "inline-grid place-items-center",
      },
      surface: {
        account: "text-[var(--account-ink)]",
        staff: "",
      },
      variant: {
        bare: "",
        danger: "portal-danger-btn",
        outline: "portal-outline-btn",
        primary: "portal-primary-btn",
        small: "portal-small-btn",
      },
    },
  }
);

export interface ButtonProps
  extends Omit<ComponentProps<typeof BaseButton>, "className">,
    VariantProps<typeof buttonVariants> {
  className?: string;
  loading?: boolean;
}

export function Button({
  "aria-busy": ariaBusy,
  children,
  className,
  disabled,
  iconOnly,
  loading = false,
  ref,
  surface,
  variant,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      aria-busy={ariaBusy ?? (loading || undefined)}
      className={cn(buttonVariants({ iconOnly, surface, variant }), className)}
      data-loading={loading ? "" : undefined}
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {children}
    </BaseButton>
  );
}

export type IconButtonProps = Omit<ButtonProps, "iconOnly"> & { "aria-label": string };

export function IconButton({ ref, ...props }: IconButtonProps) {
  return <Button iconOnly ref={ref} {...props} />;
}
