import { describe, expect, test } from "bun:test";
import {
  contextualIconMotion,
  PUBLIC_PRESS_TRANSITION,
  publicPressTarget,
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
  });
});
