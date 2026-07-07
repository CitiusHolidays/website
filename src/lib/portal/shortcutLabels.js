import { useSyncExternalStore } from "react";

export function isMacPlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }
  if (navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform === "macOS";
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function getModShortcutLabel({ mac = isMacPlatform() } = {}) {
  return mac ? "⌘K" : "Ctrl+K";
}

const subscribeToShortcutLabel = () => () => {};

export function useModShortcutLabel() {
  return useSyncExternalStore(
    subscribeToShortcutLabel,
    () => getModShortcutLabel(),
    () => "Ctrl+K"
  );
}
