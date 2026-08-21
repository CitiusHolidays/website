"use client";

import { Sparkles } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { CompassIcon, useAnimatedIconTrigger } from "./AnimatedLucideIcons";
import { ChatbotWindow } from "./ChatbotWindow";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const compassIconRef = useRef(null);
  const openerRef = useRef(null);
  const compassIconTrigger = useAnimatedIconTrigger(compassIconRef);
  const shouldReduceMotion = !!useReducedMotion();
  const pathname = usePathname();
  const avoidsMobileBottomBar = pathname === "/pilgrimage";
  const openChat = () => setIsOpen(true);
  const closeChat = () => setIsOpen(false);

  return (
    <>
      <m.button
        animate={{
          opacity: isOpen ? 0 : 1,
          transform: isOpen || shouldReduceMotion ? "none" : "translate3d(0, 0, 0) scale(1)",
        }}
        aria-controls="citius-concierge-dialog"
        aria-expanded={isOpen}
        aria-label="Open Citius Concierge"
        className={`safe-area-fixed-corner group fixed z-50 inline-flex min-h-14 items-center gap-3 rounded-full bg-[#0e2238] p-2 text-white shadow-[0_16px_50px_rgba(14,34,56,0.28)] transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-[#163b5f] hover:shadow-[0_20px_60px_rgba(14,34,56,0.34)] focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-4 motion-reduce:hover:translate-y-0 sm:pr-5 ${
          avoidsMobileBottomBar ? "mobile-bottom-bar-offset" : ""
        } ${isOpen ? "pointer-events-none" : ""}`}
        initial={{
          opacity: 0,
          transform: shouldReduceMotion ? "none" : "translate3d(0, 8px, 0) scale(0.98)",
        }}
        onClick={openChat}
        ref={openerRef}
        tabIndex={isOpen ? -1 : undefined}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: PUBLIC_EASE_OUT }}
        {...compassIconTrigger}
      >
        <span className="relative flex size-10 items-center justify-center rounded-full bg-white/10">
          <CompassIcon aria-hidden="true" ref={compassIconRef} size={20} />
          <Sparkles
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 size-3 text-[#e8c987]"
          />
        </span>
        <span className="hidden font-semibold text-sm sm:block">Plan with Concierge</span>
      </m.button>

      <ChatbotWindow
        avoidsMobileBottomBar={avoidsMobileBottomBar}
        isOpen={isOpen}
        onClose={closeChat}
        openerRef={openerRef}
      />
    </>
  );
}
