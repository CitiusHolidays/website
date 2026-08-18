import { describe, expect, test } from "bun:test";
import { DESTRUCTIVE_HOLD_EASING, DESTRUCTIVE_HOLD_SECONDS } from "./destructiveSafetyPolicy";

describe("Destructive hold safety policy", () => {
  test("Requires a truthful linear two-second hold for every motion preference", () => {
    expect(DESTRUCTIVE_HOLD_SECONDS).toBe(2);
    expect(DESTRUCTIVE_HOLD_EASING).toBe("linear");
  });
});
