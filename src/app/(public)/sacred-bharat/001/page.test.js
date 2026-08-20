import { describe, expect, mock, test } from "bun:test";

mock.module("next/server", () => ({ connection: () => undefined }));
mock.module("@/components/sacredBharat/edition/SacredBharatEdition", () => ({
  default: () => null,
}));
mock.module("@/lib/operationalControls/runtimeService", () => ({
  resolveOperationalControl: () => ({
    blockedBy: [],
    enabled: true,
    key: "public.sacred_bharat_001",
    reason: "enabled",
  }),
}));

const { instant } = await import("./page.js");

describe("Sacred Bharat / 001 route rendering", () => {
  test("opts its runtime operational-control read out of instant prerendering", () => {
    expect(instant).toBe(false);
  });
});
