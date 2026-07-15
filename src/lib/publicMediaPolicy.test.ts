import { describe, expect, test } from "bun:test";
import { heroMediaDecision } from "./publicMediaPolicy";

describe("public hero media policy", () => {
  const eligible = {
    effectiveType: "4g",
    isVisible: true,
    prefersReducedMotion: false,
    saveData: false,
  };

  test("loads only when the hero is visible on an eligible connection", () => {
    expect(heroMediaDecision(eligible)).toEqual({ load: true, reason: "eligible" });
    expect(heroMediaDecision({ ...eligible, isVisible: false })).toEqual({
      load: false,
      reason: "outside-viewport",
    });
  });

  test("keeps the poster for reduced motion, data saver, and slow networks", () => {
    expect(heroMediaDecision({ ...eligible, prefersReducedMotion: true }).reason).toBe(
      "reduced-motion"
    );
    expect(heroMediaDecision({ ...eligible, saveData: true }).reason).toBe("data-saver");
    expect(heroMediaDecision({ ...eligible, effectiveType: "2g" }).reason).toBe("slow-network");
  });
});
