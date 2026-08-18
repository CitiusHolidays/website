import { useSyncExternalStore } from "react";
import { isRuntimeObject, isRuntimeString } from "../runtimeValues";

export interface ModShortcutLabelOptions {
  mac?: boolean;
}

const MAC_PLATFORM_RE = /Mac|iPhone|iPad|iPod/;

export function isMacPlatform(): boolean {
  if (!("navigator" in globalThis)) {
    return false;
  }
  const platformNavigator = globalThis.navigator;
  const userAgentData =
    "userAgentData" in platformNavigator ? platformNavigator.userAgentData : undefined;
  if (
    isRuntimeObject(userAgentData) &&
    "platform" in userAgentData &&
    isRuntimeString(userAgentData.platform)
  ) {
    return userAgentData.platform === "macOS";
  }
  return MAC_PLATFORM_RE.test(platformNavigator.platform);
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
