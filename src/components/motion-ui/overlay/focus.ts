const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  if (!(element?.isConnected && !element.closest('[inert], [hidden], [aria-hidden="true"]'))) {
    return false;
  }
  if (element.getAttribute("aria-disabled") === "true") {
    return false;
  }
  return !("disabled" in element && element.disabled === true);
}

function resolveFocusRestoreTarget(
  target: HTMLElement | null,
  fallbackRoot: HTMLElement | null
): HTMLElement | null {
  if (canRestoreFocus(target)) {
    return target;
  }
  return getFocusableElements(fallbackRoot).find(canRestoreFocus) ?? null;
}

export function restoreFocusAfterOverlayTeardown(
  target: HTMLElement | null,
  fallbackRoot: HTMLElement | null = null
): () => void {
  const frame = requestAnimationFrame(() => {
    const resolved = resolveFocusRestoreTarget(target, fallbackRoot);
    try {
      resolved?.focus({ preventScroll: true });
    } catch {
      // The opener can disappear between eligibility checking and focus in a concurrent render.
    }
  });
  return () => cancelAnimationFrame(frame);
}
