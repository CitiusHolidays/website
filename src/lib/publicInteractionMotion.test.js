import { describe, expect, test } from "bun:test";
import {
  contextualIconMotion,
  PUBLIC_EASE_OUT,
  PUBLIC_PRESS_TRANSITION,
  publicPressTarget,
  publicRevealMotion,
  publicStageMotion,
  publicStaggerContainer,
  publicStaggerItem,
} from "./publicInteractionMotion";

describe("Public interaction motion recipe", () => {
  test("Uses one restrained 0.96 press target", () => {
    expect(publicPressTarget(false)).toEqual({ scale: 0.96 });
    expect(PUBLIC_PRESS_TRANSITION).toEqual({ duration: 0.15, ease: "easeOut" });
  });

  test("Uses exact contextual icon values", () => {
    expect(contextualIconMotion(false)).toEqual({
      animate: { filter: "blur(0px)", opacity: 1, transform: "scale(1)" },
      exit: { filter: "blur(4px)", opacity: 0, transform: "scale(0.25)" },
      initial: { filter: "blur(4px)", opacity: 0, transform: "scale(0.25)" },
      transition: { bounce: 0, duration: 0.3, type: "spring" },
    });
  });

  test("Removes transform motion for reduced-motion users", () => {
    expect(publicPressTarget(true)).toBeUndefined();
    expect(contextualIconMotion(true)).toEqual({
      animate: { filter: "none", opacity: 1, transform: "none" },
      exit: { filter: "none", opacity: 1, transform: "none" },
      initial: false,
      transition: { duration: 0 },
    });
    expect(publicStageMotion(true).initial).toEqual({ opacity: 0 });
    expect(publicStageMotion(true).transition).toEqual({ duration: 0 });
    expect(publicRevealMotion(true).animate).toEqual({ opacity: 1 });
    expect(publicRevealMotion(true).transition).toEqual({ duration: 0 });
    expect(publicStaggerContainer(true).variants.visible.transition.staggerChildren).toBe(0);
    expect(publicStaggerItem(true).variants.hidden).toEqual({ opacity: 0 });
  });

  test("Stages occasional content swaps with GPU transform strings", () => {
    expect(publicStageMotion(false)).toEqual({
      animate: { filter: "blur(0px)", opacity: 1, transform: "translate3d(0, 0, 0)" },
      exit: {
        filter: "blur(4px)",
        opacity: 0,
        transform: "translate3d(0, -12px, 0)",
        transition: { duration: 0.15, ease: PUBLIC_EASE_OUT },
      },
      initial: { filter: "blur(4px)", opacity: 0, transform: "translate3d(0, 16px, 0)" },
      transition: { duration: 0.28, ease: PUBLIC_EASE_OUT },
    });
    expect(publicRevealMotion(false).initial).toEqual({
      opacity: 0,
      transform: "translate3d(0, 12px, 0)",
    });
    expect(publicStaggerContainer(false).variants.visible.transition.staggerChildren).toBe(0.08);
  });
});
