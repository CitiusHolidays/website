import { describe, expect, test } from "bun:test";
import { cn } from "./utils";

describe("Canonical conditional class composition", () => {
  test("Keeps caller-last Tailwind overrides deterministic", () => {
    expect(cn("bg-white p-4", null, ["p-2", { "bg-black": true }])).toBe("p-2 bg-black");
  });
});
