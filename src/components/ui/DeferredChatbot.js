"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Chatbot = dynamic(() => import("./Chatbot"), {
  ssr: false,
});

export default function DeferredChatbot() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => {
        setIsReady(true);
      }, { timeout: 4000 });

      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(() => {
      setIsReady(true);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!isReady) {
    return null;
  }

  return <Chatbot />;
}
