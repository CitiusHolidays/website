import { describe, expect, test } from "bun:test";
import { encryptPassportDetails } from "../lib/encryption";
import {
  classifyPassportExpiryUrgency,
  cleanPassportField,
  normalizePassportExpiryDate,
  resolvePassportExpiryForList,
} from "./passportExpiry";

describe("classifyPassportExpiryUrgency", () => {
  const referenceDate = "2026-01-01";

  test("classifies missing, expired, travel-blocking, warning, and healthy expiry dates", () => {
    expect(classifyPassportExpiryUrgency({ expiryDate: "", referenceDate })).toBe("unknown");
    expect(classifyPassportExpiryUrgency({ expiryDate: "2025-12-31", referenceDate })).toBe(
      "expired"
    );
    expect(
      classifyPassportExpiryUrgency({
        expiryDate: "2026-08-01",
        referenceDate,
        travelDate: "2026-03-01",
      })
    ).toBe("critical");
    expect(classifyPassportExpiryUrgency({ expiryDate: "2026-06-01", referenceDate })).toBe(
      "warning"
    );
    expect(classifyPassportExpiryUrgency({ expiryDate: "2027-01-01", referenceDate })).toBe("ok");
  });
});

describe("normalizePassportExpiryDate", () => {
  test("returns undefined for empty or UNKNOWN values", () => {
    expect(normalizePassportExpiryDate("")).toBeUndefined();
    expect(normalizePassportExpiryDate("UNKNOWN")).toBeUndefined();
  });

  test("keeps YYYY-MM-DD values", () => {
    expect(normalizePassportExpiryDate("2028-03-15")).toBe("2028-03-15");
  });

  test("parses human-readable dates", () => {
    expect(normalizePassportExpiryDate("15 Mar 2028")).toBe("2028-03-15");
  });
});

describe("cleanPassportField", () => {
  test("returns empty string for UNKNOWN", () => {
    expect(cleanPassportField("UNKNOWN")).toBe("");
  });
});

describe("resolvePassportExpiryForList", () => {
  test("prefers normalized plain expiry column", async () => {
    await expect(resolvePassportExpiryForList("2028-03-15", "")).resolves.toBe("2028-03-15");
  });

  test("reads expiry from encrypted payload when plain column is empty", async () => {
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const encrypted = encryptPassportDetails({
        dateOfBirth: "1990-01-01",
        expiryDate: "2031-06-15",
        issueDate: "2020-01-01",
        nationality: "IN",
        number: "Z1234567",
      });
      await expect(resolvePassportExpiryForList("", encrypted)).resolves.toBe("2031-06-15");
    } finally {
      if (previousKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousKey;
      }
    }
  });
});
