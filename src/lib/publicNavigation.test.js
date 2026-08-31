import { describe, expect, test } from "bun:test";
import { publicRouteCurrent } from "./publicNavigation";

describe("public navigation current state", () => {
  test("distinguishes exact pages from nested locations", () => {
    expect(publicRouteCurrent("/blog", "/blog")).toBe("page");
    expect(publicRouteCurrent("/blog/a-field-note", "/blog")).toBe("location");
    expect(publicRouteCurrent("/", "/")).toBe("page");
    expect(publicRouteCurrent("/about", "/")).toBeUndefined();
    expect(publicRouteCurrent("/blogroll", "/blog")).toBeUndefined();
  });
});
