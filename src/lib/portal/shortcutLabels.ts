import { useSyncExternalStore } from "react";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

export interface ModShortcutLabelOptions {
  mac?: boolean;
}

const MAC_PLATFORM_RE = /Mac|iPhone|iPad|iPod/;

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const platformNavigator = navigator as NavigatorWithUserAgentData;
  if (platformNavigator.userAgentData?.platform) {
    return platformNavigator.userAgentData.platform === "macOS";
  }
  return MAC_PLATFORM_RE.test(navigator.platform);
}

export function getModShortcutLabel({
  mac = isMacPlatform(),
}: ModShortcutLabelOptions = {}): string {
  return mac ? "⌘K" : "Ctrl+K";
}

const noopUnsubscribe = (): void => undefined;

const subscribeToShortcutLabel = (): (() => void) => noopUnsubscribe;

export function useModShortcutLabel(): string {
  return useSyncExternalStore(
    subscribeToShortcutLabel,
    () => getModShortcutLabel(),
    () => "Ctrl+K"
  );
}
