import { defineTheme, editorial } from "@/components/motion-ui/ui-theme";

/** Citius Connect portal motion vocabulary — productive base with editorial lively accents. */
export default defineTheme({
  reducedMotion: "calm",
  transitions: {
    lively: editorial.transitions.lively,
  },
});
