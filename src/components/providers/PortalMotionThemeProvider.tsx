"use client";

import type { ReactNode } from "react";
import { MotionUIThemeProvider } from "@/components/motion-ui/ui-theme";
import citiusTheme from "@/motion.theme";

export default function PortalMotionThemeProvider({ children }: { children: ReactNode }) {
  return <MotionUIThemeProvider theme={citiusTheme}>{children}</MotionUIThemeProvider>;
}
