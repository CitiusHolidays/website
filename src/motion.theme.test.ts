import { describe, expect, test } from "bun:test";
import { resolveReducedMotion } from "@/components/motion-ui/ui-theme";
import citiusTheme from "@/motion.theme";

describe("citius portal motion theme", () => {
  test("defineTheme keeps productive base with editorial lively tuning", () => {
    expect(citiusTheme.reducedMotion).toBe("calm");
    expect(citiusTheme.transitions.ui.duration).toBe(0.3);
    expect(citiusTheme.transitions.lively.duration).toBe(0.23);
    expect(citiusTheme.transitions.lively.stiffness).toBeCloseTo(518.25, 1);
  });

  test("resolveReducedMotion returns calm strategy when OS prefers reduced motion", () => {
    expect(resolveReducedMotion(citiusTheme, true).strategy).toBe("calm");
    expect(resolveReducedMotion(citiusTheme, false).strategy).toBe("full");
  });
});
