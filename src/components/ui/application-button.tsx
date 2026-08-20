"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./application-button-variants";
import { Button as BaseButton } from "./foundation/base";
import type { VariantProps } from "./foundation/variants";

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
