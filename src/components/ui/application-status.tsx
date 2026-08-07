import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "./foundation/variants";

const badgeVariants = cva("inline-flex items-center", {
  compoundVariants: [
    {
      className: "bg-[var(--account-success-soft)] text-[var(--account-success)]",
      surface: "account",
      tone: "success",
    },
    {
      className: "bg-[var(--account-gold-soft)] text-[var(--account-gold)]",
      surface: "account",
      tone: "neutral",
    },
  ],
  defaultVariants: { surface: "staff", tone: "neutral" },
  variants: {
    surface: {
      account: "rounded-full px-2.5 py-1 font-medium text-[10px] uppercase tracking-[0.13em]",
      staff: "rounded-full border border-brand-border bg-white px-2.5 py-1 text-xs",
    },
    tone: {
      danger: "text-red-700",
      neutral: "text-brand-muted",
      success: "text-emerald-700",
      warning: "text-amber-700",
    },
  },
});

export interface BadgeProps
  extends Omit<ComponentProps<"span">, "className">,
    VariantProps<typeof badgeVariants> {
  className?: string;
}

export function Badge({ className, surface, tone, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ surface, tone }), className)}
      data-surface={surface ?? "staff"}
      {...props}
    />
  );
}

function getStatusDotClass(surface: BadgeProps["surface"], tone: BadgeProps["tone"]) {
  if (surface === "account") {
    return tone === "success" ? "bg-[var(--account-success)]" : "bg-[var(--account-gold)]";
  }
  return tone === "success" ? "bg-emerald-600" : "bg-current";
}

export function Status({ children, className, surface, tone, ...props }: BadgeProps) {
  return (
    <Badge className={className} surface={surface} tone={tone} {...props}>
      <span
        aria-hidden="true"
        className={cn("mr-1.5 size-1.5 rounded-full", getStatusDotClass(surface, tone))}
      />
      {children}
    </Badge>
  );
}
