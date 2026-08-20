"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";
import { isStandalonePublicRoute } from "@/lib/publicRouteChrome";

function RuntimeChromeSlot({ children }) {
  const pathname = usePathname();
  if (isStandalonePublicRoute(pathname)) {
    return null;
  }
  return children;
}

function ChromeSlot({ children }) {
  return (
    <Suspense fallback={null}>
      <RuntimeChromeSlot>{children}</RuntimeChromeSlot>
    </Suspense>
  );
}

export default function AppChromeFrame({ chatbot, children, footer, header }) {
  return (
    <ReducedMotionProvider>
      <div className="relative flex min-h-screen flex-col">
        <a
          className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-md bg-public-surface px-4 py-2 font-semibold text-public-blue shadow-lg transition-transform focus:translate-y-0 focus:outline-2 focus:outline-public-orange-ink focus:outline-offset-2"
          href="#public-main"
        >
          Skip to main content
        </a>
        <ChromeSlot>{header}</ChromeSlot>
        <main
          className="relative min-h-0 w-full flex-1 scroll-mt-24 outline-none"
          id="public-main"
          tabIndex={-1}
        >
          {children}
        </main>
        <ChromeSlot>{footer}</ChromeSlot>
        <ChromeSlot>{chatbot}</ChromeSlot>
      </div>
    </ReducedMotionProvider>
  );
}
