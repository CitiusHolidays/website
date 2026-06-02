"use client";

import { MessageCircle } from "lucide-react";
import { easeInOut, m as motion } from "motion/react";
import { useState } from "react";
import { ChatbotWindow } from "./ChatbotWindow";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <motion.button
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ease: easeInOut }}
          className="fixed bottom-6 right-6 z-50 bg-green-600 hover:bg-green-600/90 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group hover:scale-115"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat assistant"
        >
          <MessageCircle
            size={24}
            className="group-hover:rotate-12 transition-transform duration-300"
          />
        </motion.button>
      )}

      <ChatbotWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
