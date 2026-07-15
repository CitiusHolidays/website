import { describe, expect, setSystemTime, test } from "bun:test";
import { stableProfileTimestamps } from "./profileFallback";

describe("stable profile query fallback", () => {
  test("does not synthesize wall-clock timestamps when profile state is missing", () => {
    try {
      setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const first = stableProfileTimestamps(null, {});
      setSystemTime(new Date("2036-01-01T00:00:00.000Z"));
      const second = stableProfileTimestamps(null, {});
      expect(second).toEqual(first);
      expect(first).toEqual({ createdAt: null, updatedAt: null });
    } finally {
      setSystemTime();
    }
  });

  test("uses persisted profile or stable identity claims when available", () => {
    expect(stableProfileTimestamps({ createdAt: 1000, updatedAt: 2000 }, {})).toEqual({
      createdAt: "1970-01-01T00:00:01.000Z",
      updatedAt: "1970-01-01T00:00:02.000Z",
    });
    expect(stableProfileTimestamps(null, { createdAt: "2026-07-13T10:00:00Z" })).toEqual({
      createdAt: "2026-07-13T10:00:00.000Z",
      updatedAt: "2026-07-13T10:00:00.000Z",
    });
  });
});
