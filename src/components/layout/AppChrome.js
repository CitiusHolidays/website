"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { usePathname } from "next/navigation";
import DeferredChatbot from "../ui/DeferredChatbot";
import Footer from "./Footer";
import Header from "./Header";

export default function AppChrome({ children }) {
  const pathname = usePathname();
  const isPortal = pathname?.startsWith("/portal");

  return (
    <div className="min-h-screen flex flex-col relative">
      {!isPortal && <Header />}
      <main
        className={
          isPortal
            ? "relative flex-1 w-full min-h-screen bg-brand-light"
            : "relative flex-1 w-full min-h-0"
        }
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </main>
      {!isPortal && <Footer />}
      {!isPortal && <DeferredChatbot />}
    </div>
  );
}
