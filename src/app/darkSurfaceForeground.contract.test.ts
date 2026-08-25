import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fromAny } from "@total-typescript/shoehorn";

const DARK_SURFACE_FILES = ["src/components/layout/Footer.js"];
const HEX_COLOR_PATTERN = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;
const MUTED_ON_DARK_TOKEN_PATTERN = /--color-brand-muted-on-dark:\s*(#[\da-f]{6});/i;
const LOW_ALPHA_WHITE_PATTERN = /text-white\/(?:30|60)/;

function rgb(hex: string): [number, number, number] {
  const channels = hex.match(HEX_COLOR_PATTERN)?.slice(1);
  if (!channels) {
    throw new Error(`Expected six-digit hex color, received ${hex}`);
  }
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return fromAny<[number, number, number], unknown>(
    channels.map((channel) => Number.parseInt(channel, 16))
  );
}

function luminance(hex: string) {
  const channels = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("Dark surface foreground contract", () => {
  test("The shared muted-on-dark role clears WCAG AA on dark application backgrounds", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    const token = globals.match(MUTED_ON_DARK_TOKEN_PATTERN)?.[1];
    expect(token).toBeDefined();
    expect(contrast(token ?? "#000000", "#0f172a")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token ?? "#000000", "#0b1026")).toBeGreaterThanOrEqual(4.5);
  });

  test("Audited dark surfaces consume the semantic role instead of low-alpha white", () => {
    for (const file of DARK_SURFACE_FILES) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("text-brand-muted-on-dark");
      expect(source).not.toMatch(LOW_ALPHA_WHITE_PATTERN);
    }
  });
});
