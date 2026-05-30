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
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  }, [onVerify, onExpire, onError]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return undefined;
    }

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) {
        return;
      }

      if (widgetIdRef.current != null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget may already be gone */
        }
        widgetIdRef.current = null;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        callback: (token) => callbacksRef.current.onVerify?.(token),
        "expired-callback": () => callbacksRef.current.onExpire?.(),
        "error-callback": () => callbacksRef.current.onError?.(),
      });
    };

    const ensureScript = () => {
      if (window.turnstile) {
        renderWidget();
        return;
      }

      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        existing.addEventListener("load", renderWidget, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget, { once: true });
      document.head.appendChild(script);
    };

    ensureScript();

    return () => {
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
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
