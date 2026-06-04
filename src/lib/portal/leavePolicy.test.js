import { describe, expect, test } from "bun:test";
import { calculateLeaveRequestImpact } from "./leavePolicy.js";

describe("leavePolicy", () => {
  test("blocks casual leave requests over the max-at-once limit", () => {
    const result = calculateLeaveRequestImpact({
      leaveType: "Casual",
      startDate: "2026-06-01",
      endDate: "2026-06-04",
      employmentStatus: "Confirmed",
      balances: { Casual: 8 },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("3 days");
  });

  test("probationers do not accrue privilege leave", () => {
    const result = calculateLeaveRequestImpact({
      leaveType: "Privilege",
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      employmentStatus: "Probationer",
      balances: { Privilege: 0 },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("probation");
  });

  test("allows confirmed paternity leave up to 10 days", () => {
    const result = calculateLeaveRequestImpact({
      leaveType: "Paternity",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      employmentStatus: "Confirmed",
      balances: { Paternity: 10 },
    });

    expect(result).toMatchObject({
      allowed: true,
      days: 10,
      balanceAfter: 0,
    });
  });

  test("uses policy defaults when no balance rows are loaded yet", () => {
    const result = calculateLeaveRequestImpact({
      leaveType: "Casual",
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      employmentStatus: "Confirmed",
      balances: {},
    });

    expect(result).toMatchObject({
      allowed: true,
      days: 1,
      balanceAfter: 7,
    });
  });
});
