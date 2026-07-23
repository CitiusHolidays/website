import { describe, expect, test } from "bun:test";
import {
  portalModalExitTransform,
  portalModalHiddenTransform,
  portalMotionTransition,
  resolveMotionUITransition,
} from "@/lib/portal/portalMotion";

describe("portalMotion theme helpers", () => {
  test("portalMotionTransition uses calm opacity fades when reduced motion is preferred", () => {
    expect(portalMotionTransition(true)).toEqual({ duration: 0.3, ease: "linear" });
  });

  test("portalMotionTransition resolves spring tokens for full motion", () => {
    const transition = portalMotionTransition(false, undefined, "snap");
    expect(transition).toMatchObject({
      damping: expect.any(Number),
      duration: 0.15,
      stiffness: expect.any(Number),
      type: "spring",
    });
  });

  test("portal modal transforms suppress travel under reduced motion", () => {
    expect(portalModalHiddenTransform(true)).toBe("scale(1)");
    expect(portalModalExitTransform(true)).toBe("scale(1)");
    expect(portalModalHiddenTransform(false, 0.96)).toBe("scale(0.96)");
  });

  test("resolveMotionUITransition includes opacity channel from theme token", () => {
    const transition = resolveMotionUITransition("ui");
    expect(transition.opacity).toEqual({
      duration: 0.3,
      ease: "linear",
      inherit: true,
      type: "tween",
    });
  });
});
