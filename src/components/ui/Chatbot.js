"use client";

import { Compass } from "lucide-react";
import { easeInOut, m } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChatbotWindow } from "./ChatbotWindow";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const avoidsMobileBottomBar = pathname === "/pilgrimage";

  return (
    <>
      {!isOpen && (
        <m.button
          animate={{ opacity: 1, scale: 1 }}
          aria-label="Open Citius Concierge chat"
          className={`safe-area-fixed-corner group fixed z-50 rounded-full bg-citius-blue p-4 text-white shadow-lg transition-[scale,background-color,box-shadow] duration-300 fine-hover:hover:scale-105 hover:bg-citius-blue/90 hover:shadow-xl ${
            avoidsMobileBottomBar ? "mobile-bottom-bar-offset" : ""
          }`}
          initial={{ opacity: 0, scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          transition={{ ease: easeInOut }}
        >
          <Compass
            aria-hidden="true"
            className="transition-transform duration-300 fine-hover:group-hover:rotate-12"
            size={24}
          />
        </m.button>
      )}

      <ChatbotWindow
        avoidsMobileBottomBar={avoidsMobileBottomBar}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
