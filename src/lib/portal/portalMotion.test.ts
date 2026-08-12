import { describe, expect, test } from "bun:test";
import {
  portalModalExitTransform,
  portalModalHiddenTransform,
  portalMotionTransition,
  portalOverlayMotion,
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

  test("portal overlay lifecycle keeps reduced motion spatially still", () => {
    expect(portalOverlayMotion(true, "left", 0.18)).toEqual({
      hidden: { opacity: 0, transform: "none" },
      transition: { duration: 0.18, ease: "linear" },
      visible: { opacity: 1, transform: "none" },
    });
    expect(portalOverlayMotion(false, "top-right", 0.15)).toMatchObject({
      hidden: { opacity: 0, transform: "translate3d(0, -6px, 0) scale(0.98)" },
      visible: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    });
  });
});
