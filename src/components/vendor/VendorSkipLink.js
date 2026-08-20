"use client";

export const VENDOR_MAIN_ID = "vendor-main";

export function VendorSkipLink() {
  const focusMain = () => {
    requestAnimationFrame(() => {
      const main = document.getElementById(VENDOR_MAIN_ID);
      main?.focus({ preventScroll: true });
      main?.scrollIntoView({ block: "start" });
    });
  };

  return (
    <a
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-medium focus:text-[#0B1026] focus:shadow-lg focus:outline-2 focus:outline-citius-orange"
      href={`#${VENDOR_MAIN_ID}`}
      onClick={focusMain}
    >
      Skip to main content
    </a>
  );
}
