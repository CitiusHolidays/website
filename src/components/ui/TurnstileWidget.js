"use client";

import { useEffect, useRef } from "react";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * @param {{
 *   siteKey: string;
 *   onVerify: (token: string) => void;
 *   onExpire?: () => void;
 *   onError?: () => void;
 * }} props
 */
export default function TurnstileWidget({ siteKey, onVerify, onExpire, onError }) {
  const containerRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  }, [onVerify, onExpire, onError]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return undefined;
    }

    const container = containerRef.current;
    let renderedWidgetId = null;

    const renderWidget = () => {
      if (!container || !window.turnstile) {
        return;
      }

      if (renderedWidgetId != null) {
        try {
          window.turnstile.remove(renderedWidgetId);
        } catch {
          /* widget may already be gone */
        }
        renderedWidgetId = null;
      }

      renderedWidgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: "light",
        callback: (token) => callbacksRef.current.onVerify?.(token),
        "expired-callback": () => callbacksRef.current.onExpire?.(),
        "error-callback": () => callbacksRef.current.onError?.(),
      });
    };

    let loadTarget = null;

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        loadTarget = existing;
        loadTarget.addEventListener("load", renderWidget, { once: true });
      } else {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        loadTarget = script;
        loadTarget.addEventListener("load", renderWidget, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      if (loadTarget) {
        loadTarget.removeEventListener("load", renderWidget);
      }
      if (renderedWidgetId != null && window.turnstile) {
        try {
          window.turnstile.remove(renderedWidgetId);
        } catch {
          /* ignore */
        }
      }
    };
  }, [siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <fieldset
      ref={containerRef}
      className="min-h-[65px] flex justify-center border-0 p-0 m-0 min-w-0"
      aria-label="Security check"
    />
  );
}
