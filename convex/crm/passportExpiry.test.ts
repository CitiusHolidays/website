import { describe, expect, test } from "bun:test";
import { withTestEncryptionKey } from "../../test-helpers/encryptionKey";
import { encryptPassportDetails } from "../lib/encryption";
import {
  classifyPassportExpiryUrgency,
  cleanPassportField,
  normalizePassportExpiryDate,
  resolvePassportExpiryForList,
} from "./passportExpiry";

describe("ClassifyPassportExpiryUrgency", () => {
  const referenceDate = "2026-01-01";

  test("Classifies missing, expired, travel-blocking, warning, and healthy expiry dates", () => {
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

describe("NormalizePassportExpiryDate", () => {
  test("Returns undefined for empty or UNKNOWN values", () => {
    expect(normalizePassportExpiryDate("")).toBeUndefined();
    expect(normalizePassportExpiryDate("UNKNOWN")).toBeUndefined();
  });

  test("Keeps YYYY-MM-DD values", () => {
    expect(normalizePassportExpiryDate("2028-03-15")).toBe("2028-03-15");
  });

  test("Parses human-readable dates", () => {
    expect(normalizePassportExpiryDate("15 Mar 2028")).toBe("2028-03-15");
  });
});

describe("CleanPassportField", () => {
  test("Returns empty string for UNKNOWN", () => {
    expect(cleanPassportField("UNKNOWN")).toBe("");
  });
});

describe("ResolvePassportExpiryForList", () => {
  test("Prefers normalized plain expiry column", async () => {
    await expect(resolvePassportExpiryForList("2028-03-15", "")).resolves.toBe("2028-03-15");
  });

  test("Reads expiry from encrypted payload when plain column is empty", async () => {
    await withTestEncryptionKey(async () => {
      const encrypted = encryptPassportDetails({
        dateOfBirth: "1990-01-01",
        expiryDate: "2031-06-15",
        issueDate: "2020-01-01",
        nationality: "IN",
        number: "Z1234567",
      });
      await expect(resolvePassportExpiryForList("", encrypted)).resolves.toBe("2031-06-15");
    });
  });
});
