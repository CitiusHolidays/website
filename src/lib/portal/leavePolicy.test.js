import { describe, expect, test } from "bun:test";
import { calculateLeaveRequestImpact } from "./leavePolicy.js";

describe("leavePolicy", () => {
  test("blocks casual leave requests over the max-at-once limit", () => {
    const result = calculateLeaveRequestImpact({
      balances: { Casual: 8 },
      employmentStatus: "Confirmed",
      endDate: "2026-06-04",
      leaveType: "Casual",
      startDate: "2026-06-01",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("3 days");
  });

  test("probationers do not accrue privilege leave", () => {
    const result = calculateLeaveRequestImpact({
      balances: { Privilege: 0 },
      employmentStatus: "Probationer",
      endDate: "2026-06-01",
      leaveType: "Privilege",
      startDate: "2026-06-01",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("probation");
  });

  test("allows confirmed paternity leave up to 10 days", () => {
    const result = calculateLeaveRequestImpact({
      balances: { Paternity: 10 },
      employmentStatus: "Confirmed",
      endDate: "2026-06-10",
      leaveType: "Paternity",
      startDate: "2026-06-01",
    });

    expect(result).toMatchObject({
      allowed: true,
      balanceAfter: 0,
      days: 10,
    });
  });

  test("uses policy defaults when no balance rows are loaded yet", () => {
    const result = calculateLeaveRequestImpact({
      balances: {},
      employmentStatus: "Confirmed",
      endDate: "2026-06-01",
      leaveType: "Casual",
      startDate: "2026-06-01",
    });

    expect(result).toMatchObject({
      allowed: true,
      balanceAfter: 7,
      days: 1,
    });
  });
});
