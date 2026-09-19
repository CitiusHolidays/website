"use client";

import { Compass } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ChatbotWindow } from "./ChatbotWindow";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef(null);
  const pathname = usePathname();
  const avoidsMobileBottomBar = pathname === "/pilgrimage";
  const openChat = () => setIsOpen(true);
  const closeChat = () => setIsOpen(false);

  return (
    <>
      <button
        aria-controls="citius-concierge-dialog"
        aria-expanded={isOpen}
        aria-label="Open Citius Concierge"
        className={`safe-area-fixed-corner fixed z-50 inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-public-night p-3 text-white shadow-lg transition-colors hover:bg-public-blue focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-4 sm:px-4 ${
          avoidsMobileBottomBar ? "mobile-bottom-bar-offset" : ""
        } ${isOpen ? "pointer-events-none opacity-0" : ""}`}
        onClick={openChat}
        ref={openerRef}
        tabIndex={isOpen ? -1 : undefined}
        type="button"
      >
        <Compass aria-hidden="true" size={20} />
        <span className="hidden font-semibold text-sm sm:block">Concierge</span>
      </button>

      <ChatbotWindow
        avoidsMobileBottomBar={avoidsMobileBottomBar}
        isOpen={isOpen}
        onClose={closeChat}
        openerRef={openerRef}
      />
    </>
  );
}
