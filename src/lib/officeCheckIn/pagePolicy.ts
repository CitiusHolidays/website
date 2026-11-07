"use client";

import { useEffect } from "react";

interface FeatureGate {
  allowsFeature: (feature: string) => boolean;
}

/** `permissionsPolicy` is the current name; Chromium also exposes the older `featurePolicy`. */
interface PolicyDocument {
  featurePolicy?: FeatureGate;
  permissionsPolicy?: FeatureGate;
}

/**
 * Whether this page's own Permissions-Policy blocks location. The policy is fixed when a document
 * loads, and the portal changes pages without reloading, so a session that started on a page that
 * blocks location (sign-in, the public site) keeps blocking it inside the portal, whatever the
 * browser's site setting says. Browsers without the API are treated as not blocking.
 */
export function pageBlocksLocation(doc: PolicyDocument) {
  const gate = doc.permissionsPolicy ?? doc.featurePolicy;
  return gate ? !gate.allowsFeature("geolocation") : false;
}

const RELOAD_KEY = "office-check-in:location-policy-reload";
/** At most one automatic reload a minute, so a policy that still blocks can never loop. */
const RELOAD_COOLDOWN_MS = 60_000;

export function shouldReloadForLocation(lastReloadAt: number | null, now: number) {
  return lastReloadAt === null || now - lastReloadAt > RELOAD_COOLDOWN_MS;
}

function readLastReload() {
  try {
    const stored = Number(window.sessionStorage.getItem(RELOAD_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    // Storage can be unavailable (private modes); then the cooldown can't be checked, so skip.
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Reloads the check-in page once when the page itself blocks location, so the fresh document gets
 * the portal's own policy (`geolocation=(self)`) before anyone presses Clock in.
 */
export function useReloadWhenPageBlocksLocation(needsLocation: boolean) {
  useEffect(() => {
    // SAFETY: Chromium adds these properties to Document; the DOM typings don't declare them yet,
    // and both are optional in PolicyDocument, so browsers without them read as not blocking.
    const policyDocument = document as Document & PolicyDocument;
    if (!(needsLocation && pageBlocksLocation(policyDocument))) {
      return;
    }
    const now = Date.now();
    if (!shouldReloadForLocation(readLastReload(), now)) {
      return;
    }
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
    window.location.reload();
  }, [needsLocation]);
}
