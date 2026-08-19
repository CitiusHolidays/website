import { describe, expect, it } from "bun:test";
import { isStandalonePublicRoute } from "./publicRouteChrome";

describe("isStandalonePublicRoute", () => {
  it("treats every Sacred Bharat URL as an intentional standalone experience", () => {
    expect(isStandalonePublicRoute("/sacred-bharat")).toBe(true);
    expect(isStandalonePublicRoute("/sacred-bharat/001")).toBe(true);
    expect(isStandalonePublicRoute("/sacred-bharat/001?via=friend")).toBe(true);
  });

  it("preserves the normal public chrome everywhere else", () => {
    expect(isStandalonePublicRoute("/")).toBe(false);
    expect(isStandalonePublicRoute("/pilgrimage")).toBe(false);
    expect(isStandalonePublicRoute("/sacred-bharati")).toBe(false);
  });
});
