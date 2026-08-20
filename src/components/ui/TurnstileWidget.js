"use client";

import { useEffect, useRef } from "react";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * @param {{
 *   appearance?: "always" | "execute" | "interaction-only";
 *   siteKey: string;
 *   onVerify: (token: string) => void;
 *   onExpire?: () => void;
 *   onError?: () => void;
 * }} props
 */
export default function TurnstileWidget({
  appearance = "always",
  siteKey,
  onVerify,
  onExpire,
  onError,
}) {
  const containerRef = useRef(null);
  const callbacksRef = useRef({ onError, onExpire, onVerify });

  useEffect(() => {
    callbacksRef.current = { onError, onExpire, onVerify };
  }, [onVerify, onExpire, onError]);

  useEffect(() => {
    if (!(siteKey && containerRef.current)) {
      return;
    }

    const container = containerRef.current;
    let renderedWidgetId = null;

    const renderWidget = () => {
      if (!(container && window.turnstile)) {
        return;
      }

      if (renderedWidgetId !== null) {
        try {
          window.turnstile.remove(renderedWidgetId);
        } catch {
          /* widget may already be gone */
        }
        renderedWidgetId = null;
      }

      renderedWidgetId = window.turnstile.render(container, {
        appearance,
        callback: (token) => callbacksRef.current.onVerify?.(token),
        "error-callback": () => callbacksRef.current.onError?.(),
        "expired-callback": () => callbacksRef.current.onExpire?.(),
        sitekey: siteKey,
        theme: "auto",
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
      if (renderedWidgetId !== null && window.turnstile) {
        try {
          window.turnstile.remove(renderedWidgetId);
        } catch {
          /* ignore */
        }
      }
    };
  }, [appearance, siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <fieldset
      aria-label="Security check"
      className="m-0 flex min-h-0 min-w-0 justify-center border-0 p-0"
      ref={containerRef}
    />
  );
}
