import { describe, expect, test } from "bun:test";
import {
  detectSpamContent,
  isHoneypotTripped,
  validateFormTiming,
  MIN_FORM_SECONDS,
} from "./spam-guard.js";

describe("isHoneypotTripped", () => {
  test("empty honeypot passes", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });

  test("filled honeypot trips", () => {
    expect(isHoneypotTripped("Acme Inc")).toBe(true);
  });
});

describe("validateFormTiming", () => {
  test("rejects missing or instant submit", () => {
    expect(validateFormTiming(undefined).ok).toBe(false);
    expect(validateFormTiming(Date.now()).ok).toBe(false);
  });

  test("accepts submit after minimum delay", () => {
    const loadedAt = Date.now() - (MIN_FORM_SECONDS + 1) * 1000;
    expect(validateFormTiming(loadedAt).ok).toBe(true);
  });
});

describe("detectSpamContent", () => {
  test("flags obvious SEO spam", () => {
    const result = detectSpamContent({
      name: "Mark",
      email: "mark@example.com",
      subject: "Hello",
      message: "We offer SEO services and backlink packages.",
    });
    expect(result.spam).toBe(true);
  });

  test("allows normal travel inquiry", () => {
    const result = detectSpamContent({
      name: "Priya Sharma",
      email: "priya@example.com",
      subject: "Kerala trip",
      message: "Looking for a 7-day family trip to Kerala in December.",
    });
    expect(result.spam).toBe(false);
  });
});
