import { init as initReactGrab } from "react-grab/core";
import { scan } from "react-scan";

type ReactGrabApi = ReturnType<typeof initReactGrab>;

declare global {
  interface Window {
    __REACT_GRAB__?: ReactGrabApi;
  }
}

try {
  const existingReactGrab = window.__REACT_GRAB__;
  const reactGrab =
    existingReactGrab ??
    initReactGrab({
      maxContextLines: 6,
      telemetry: false,
    });

  if (!existingReactGrab) {
    window.__REACT_GRAB__ = reactGrab;
    window.dispatchEvent(new CustomEvent("react-grab:init", { detail: reactGrab }));
  }

  scan({
    dangerouslyForceRunInProduction: false,
    enabled: true,
    safeArea: { bottom: 72, right: 16 },
    showToolbar: true,
  });
} catch (error) {
  console.error("[Citius React inspection] Local instrumentation failed to initialize", error);
}
