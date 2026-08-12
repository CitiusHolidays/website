"use client";

import { Compass } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { ChatbotWindow } from "./ChatbotWindow";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef(null);
  const shouldReduceMotion = !!useReducedMotion();
  const pathname = usePathname();
  const avoidsMobileBottomBar = pathname === "/pilgrimage";
  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <m.button
        animate={{
          opacity: isOpen ? 0 : 1,
          transform: isOpen || shouldReduceMotion ? "none" : "scale(1)",
        }}
        aria-controls="citius-concierge-dialog"
        aria-expanded={isOpen}
        aria-label="Open Citius Concierge chat"
        className={`safe-area-fixed-corner group fixed z-50 rounded-full bg-citius-blue p-4 text-white shadow-lg transition-[background-color,box-shadow] duration-200 hover:bg-citius-blue/90 hover:shadow-xl ${
          avoidsMobileBottomBar ? "mobile-bottom-bar-offset" : ""
        } ${isOpen ? "pointer-events-none" : ""}`}
        initial={{
          opacity: 0,
          transform: shouldReduceMotion ? "none" : "scale(0.95)",
        }}
        onClick={openChat}
        ref={openerRef}
        tabIndex={isOpen ? -1 : undefined}
        transition={{ duration: 0.2, ease: PUBLIC_EASE_OUT }}
      >
        <Compass
          aria-hidden="true"
          className="transition-transform duration-300 fine-hover:group-hover:rotate-12"
          size={24}
        />
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
