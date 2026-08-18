import { describe, expect, test } from "bun:test";
import {
  describeSacredBharatIntentContext,
  normalizeSacredBharatIntentContext,
  SACRED_BHARAT_ENTRY_POINTS,
} from "./inboundIntent";

describe("Sacred Bharat inbound intent context", () => {
  test("Canonicalizes known planner temples and derives presentation from the catalog", () => {
    const context = normalizeSacredBharatIntentContext({
      entryPoint: SACRED_BHARAT_ENTRY_POINTS.JOURNEY_PLANNER,
      templeId: "varanasi",
    });
    expect(context).toEqual({ entryPoint: "journey_planner", templeId: "kashi-vishwanath" });
    expect(describeSacredBharatIntentContext(context)).toEqual({
      destination: "Kashi Vishwanath & Varanasi, Uttar Pradesh",
      label: "Journey Planner · Kashi Vishwanath & Varanasi",
    });
  });

  test("Accepts only known trails and rejects mixed or unknown context", () => {
    const context = normalizeSacredBharatIntentContext({
      entryPoint: SACRED_BHARAT_ENTRY_POINTS.TRAIL,
      templeId: "kedarnath",
      trailSlug: "shiva-trail",
    });
    expect(context).toEqual({ entryPoint: "trail", trailSlug: "shiva-trail" });
    expect(describeSacredBharatIntentContext(context)?.label).toBe("Trail · Shiva Trail");
    expect(
      normalizeSacredBharatIntentContext({ entryPoint: "trail", trailSlug: "unknown" })
    ).toBeNull();
    expect(normalizeSacredBharatIntentContext({ entryPoint: "wishlist" })).toBeNull();
  });
});
