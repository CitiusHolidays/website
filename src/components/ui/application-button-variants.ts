import { cva } from "./foundation/variants";

export const buttonVariants = cva(
  "disabled:cursor-not-allowed disabled:opacity-60 data-[loading]:cursor-wait",
  {
    compoundVariants: [
      {
        className:
          "account-focus inline-flex min-h-11 items-center justify-center transition-colors",
        surface: "account",
      },
      { className: "min-h-11 min-w-11", iconOnly: true },
    ],
    defaultVariants: { iconOnly: false, surface: "staff", variant: "bare" },
    variants: {
      iconOnly: { false: "", true: "inline-grid place-items-center" },
      surface: { account: "text-[var(--account-ink)]", staff: "" },
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
