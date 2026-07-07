"use client";

import { Compass } from "lucide-react";
import { easeInOut, m } from "motion/react";
import { useState } from "react";
import { ChatbotWindow } from "./ChatbotWindow";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <m.button
          animate={{ opacity: 1, scale: 1 }}
          aria-label="Open Citius Concierge chat"
          className="group fixed right-6 bottom-6 z-50 rounded-full bg-citius-blue p-4 text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-citius-blue/90 hover:shadow-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          transition={{ ease: easeInOut }}
        >
          <Compass
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:rotate-12"
            size={24}
          />
        </m.button>
      )}

      <ChatbotWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
