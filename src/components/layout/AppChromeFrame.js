"use client";

import { usePathname } from "next/navigation";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { isStandalonePublicRoute } from "@/lib/publicRouteChrome";

function ChromeSlot({ children, hidden }) {
  if (hidden) {
    return null;
  }
  return children;
}

export default function AppChromeFrame({ chatbot, children, footer, header }) {
  const pathname = usePathname();
  const isStandalone = isStandalonePublicRoute(pathname);

  return (
    <ReducedMotionProvider>
      <div className="relative flex min-h-screen flex-col">
        <a
          className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-md bg-public-surface px-4 py-2 font-semibold text-public-blue shadow-lg transition-transform focus:translate-y-0 focus:outline-2 focus:outline-public-orange-ink focus:outline-offset-2"
          href="#public-main"
        >
          Skip to main content
        </a>
        <ChromeSlot hidden={isStandalone}>{header}</ChromeSlot>
        <main
          className="relative min-h-0 w-full flex-1 scroll-mt-24 outline-none"
          id="public-main"
          tabIndex={-1}
        >
          {children}
        </main>
        <ChromeSlot hidden={isStandalone}>{footer}</ChromeSlot>
        <ChromeSlot hidden={isStandalone}>{chatbot}</ChromeSlot>
      </div>
    </ReducedMotionProvider>
  );
}
