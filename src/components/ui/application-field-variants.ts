import { cva } from "./foundation/variants";

export const fieldRootVariants = cva("block", {
  defaultVariants: { surface: "staff" },
  variants: {
    surface: { account: "text-[var(--account-ink)]", staff: "text-brand-dark" },
  },
});

export const labelVariants = cva("mb-1 block font-semibold", {
  defaultVariants: { surface: "staff" },
  variants: {
    surface: {
      account: "text-[var(--account-muted)] text-xs uppercase tracking-[0.1em]",
      staff: "text-brand-muted text-xs",
    },
  },
});

export const inputVariants = cva(
  "w-full outline-none transition-[background-color,border-color,box-shadow,color]",
  {
    defaultVariants: { surface: "staff" },
    variants: {
      surface: {
        account:
          "account-focus rounded-sm border border-[var(--account-border)] bg-white px-4 py-3 text-[var(--account-ink)] shadow-sm duration-150 ease-out focus:border-[var(--account-gold)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--account-paper)] disabled:text-[var(--account-muted)]",
        staff:
          "h-11 rounded-xl border border-brand-border bg-brand-light px-3 text-sm duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10 disabled:cursor-not-allowed disabled:opacity-60",
      },
    },
  }
);

export const textareaVariants = cva(
  "w-full outline-none transition-[background-color,border-color,box-shadow,color]",
  {
    defaultVariants: { surface: "staff" },
    variants: {
      surface: {
        account:
          "account-focus rounded-sm border border-[var(--account-border)] bg-white px-4 py-3 text-[var(--account-ink)] shadow-sm duration-150 ease-out focus:border-[var(--account-gold)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--account-paper)] disabled:text-[var(--account-muted)]",
        staff:
          "rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10 disabled:cursor-not-allowed disabled:opacity-60",
      },
    },
  }
);
