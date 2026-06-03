import { describe, expect, test } from "bun:test";
import {
  attachPassportExpiryUrgency,
  filterByPassportExpiryUrgency,
  formatPassportExpiryLabel,
  getPassportExpiryInfo,
  passportExpiryTone,
} from "./passportExpiry.js";

const TODAY = new Date("2026-06-01");

describe("passportExpiry", () => {
  test("unknown when expiry missing", () => {
    const info = getPassportExpiryInfo({ travelDate: "2026-08-01", today: TODAY });
    expect(info.level).toBe("unknown");
    expect(formatPassportExpiryLabel(info)).toBe("—");
    expect(passportExpiryTone(info)).toBe("neutral");
  });

  test("expired when date is before today", () => {
    const info = getPassportExpiryInfo({
      expiryDate: "2026-01-15",
      travelDate: "2026-08-01",
      today: TODAY,
    });
    expect(info.level).toBe("expired");
    expect(formatPassportExpiryLabel(info)).toContain("Expired");
  });

  test("critical when fewer than six months validity beyond travel start", () => {
    const info = getPassportExpiryInfo({
      expiryDate: "2026-09-01",
      travelDate: "2026-08-01",
      today: TODAY,
    });
    expect(info.level).toBe("critical");
    expect(formatPassportExpiryLabel(info)).toContain("Cannot travel");
  });

  test("warning when valid for travel but expiring within six months from today", () => {
    const info = getPassportExpiryInfo({
      expiryDate: "2026-10-01",
      travelDate: "2026-02-01",
      today: TODAY,
    });
    expect(info.level).toBe("warning");
    expect(formatPassportExpiryLabel(info)).toContain("Renew soon");
  });

  test("ok when validity is comfortably beyond travel and today", () => {
    const info = getPassportExpiryInfo({
      expiryDate: "2028-06-01",
      travelDate: "2026-08-01",
      today: TODAY,
    });
    expect(info.level).toBe("ok");
    expect(passportExpiryTone(info)).toBe("green");
  });

  test("filterByPassportExpiryUrgency returns matching rows", () => {
    const rows = attachPassportExpiryUrgency(
      [
        {
          id: "a",
          passportExpiryDate: "2026-09-01",
          travelStartDate: "2026-08-01",
        },
        {
          id: "b",
          passportExpiryDate: "2028-06-01",
          travelStartDate: "2026-08-01",
        },
      ],
      TODAY,
    );
    expect(filterByPassportExpiryUrgency(rows, "critical").map((row) => row.id)).toEqual(["a"]);
    expect(filterByPassportExpiryUrgency(rows, "ok").map((row) => row.id)).toEqual(["b"]);
  });
});
