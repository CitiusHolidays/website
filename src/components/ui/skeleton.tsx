import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "./foundation/variants";

const skeletonVariants = cva("animate-pulse", {
  defaultVariants: { surface: "staff" },
  variants: {
    surface: {
      account: "rounded-sm bg-[var(--account-border)]/70",
      staff: "rounded-lg bg-brand-border/60",
    },
  },
});

export interface SkeletonProps
  extends Omit<ComponentProps<"div">, "className">,
    VariantProps<typeof skeletonVariants> {
  className?: string;
}

export function Skeleton({ className, surface, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn(skeletonVariants({ surface }), className)}
      data-slot="skeleton"
      data-surface={surface ?? "staff"}
      {...props}
    />
  );
}
