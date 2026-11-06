import { describe, expect, test } from "bun:test";
import {
  awayTodaySummary,
  istDateKey,
  type LeaveListRow,
  leaveApprovalActions,
  leaveBalancesForDisplay,
  leaveDurationText,
  leaveProgressText,
  missingBalancesText,
  namesAwayOn,
  rowsWaitingForApproval,
} from "./leaveViewModel";

function leaveRow(overrides: Partial<LeaveListRow>): LeaveListRow {
  return {
    endDate: "2026-11-06",
    headReviewStatus: "Pending",
    hrReviewStatus: "Pending",
    id: "leave-1",
    staffId: "staff-1",
    staffName: "Nina Sales",
    startDate: "2026-11-05",
    status: "Pending",
    ...overrides,
  };
}

describe("istDateKey", () => {
  test("uses the India calendar date at 00:30 IST, when UTC is still on the previous day", () => {
    const halfPastMidnightIst = new Date("2026-11-05T00:30:00+05:30");
    expect(halfPastMidnightIst.toISOString().slice(0, 10)).toBe("2026-11-04");
    expect(istDateKey(halfPastMidnightIst)).toBe("2026-11-05");
  });

  test("keeps the same India date until 23:59 IST", () => {
    expect(istDateKey(new Date("2026-11-05T23:59:00+05:30"))).toBe("2026-11-05");
    expect(istDateKey(new Date("2026-03-31T23:59:59+05:30"))).toBe("2026-03-31");
  });
});

describe("rowsWaitingForApproval", () => {
  test("lists exactly the rows with an approval flag, soonest start first", () => {
    const rows = [
      leaveRow({ canApproveHr: true, id: "hr", startDate: "2026-11-20" }),
      leaveRow({ id: "none", startDate: "2026-11-01" }),
      leaveRow({ canReject: true, id: "reject-only", startDate: "2026-11-02" }),
      leaveRow({ canApproveHead: true, id: "head", startDate: "2026-11-10" }),
      leaveRow({ canApproveFinal: true, id: "final", startDate: "2026-11-15" }),
    ];

    expect(rowsWaitingForApproval(rows).map((row) => row.id)).toEqual(["head", "final", "hr"]);
    expect(rows.map((row) => row.id)).toEqual(["hr", "none", "reject-only", "head", "final"]);
  });

  test("is empty for someone who approves nothing", () => {
    expect(rowsWaitingForApproval([leaveRow({}), leaveRow({ id: "leave-2" })])).toEqual([]);
  });
});

describe("namesAwayOn", () => {
  const rows = [
    leaveRow({ id: "a", staffId: "a", staffName: "Aarti", status: "Approved" }),
    leaveRow({ id: "a2", staffId: "a", staffName: "Aarti", status: "Approved" }),
    leaveRow({ id: "b", staffId: "b", staffName: "Bhavesh", status: "Pending" }),
    leaveRow({
      endDate: "2026-11-04",
      id: "c",
      staffId: "c",
      staffName: "Chitra",
      startDate: "2026-11-03",
      status: "Approved",
    }),
  ];

  test("counts approved leave covering the day, once per person", () => {
    expect(namesAwayOn(rows, "2026-11-05")).toEqual(["Aarti"]);
    expect(namesAwayOn(rows, "2026-11-04")).toEqual(["Chitra"]);
  });

  test("summarises names in words", () => {
    expect(awayTodaySummary([])).toBe("No one is on approved leave today.");
    expect(awayTodaySummary(["Aarti", "Chitra"])).toBe("Aarti and Chitra");
    expect(awayTodaySummary(["A", "B", "C", "D", "E", "F"])).toBe("A, B, C and 3 more");
  });
});

describe("leaveProgressText", () => {
  test("says which stage a pending request is waiting for", () => {
    expect(leaveProgressText(leaveRow({ headApproverName: "Bhavesh Mehta" }))).toBe(
      "Waiting for head approval (Bhavesh Mehta)"
    );
    expect(leaveProgressText(leaveRow({ headApproverName: "Not assigned" }))).toBe(
      "Waiting for head approval"
    );
    expect(
      leaveProgressText(
        leaveRow({
          finalAuthorityName: "Meera Pillai",
          finalReviewStatus: "Pending",
          headReviewStatus: "Approved",
        })
      )
    ).toBe("Head approved · waiting for final authority (Meera Pillai)");
    expect(
      leaveProgressText(leaveRow({ finalReviewStatus: "Approved", headReviewStatus: "Approved" }))
    ).toBe("Head approved · waiting for HR");
  });

  test("names who rejected, and adds nothing to an approved request", () => {
    expect(
      leaveProgressText(
        leaveRow({ headReviewStatus: "Rejected", hrReviewStatus: "Rejected", status: "Rejected" })
      )
    ).toBe("Rejected by head");
    expect(
      leaveProgressText(
        leaveRow({ headReviewStatus: "Approved", hrReviewStatus: "Rejected", status: "Rejected" })
      )
    ).toBe("Rejected by HR");
    expect(leaveProgressText(leaveRow({ status: "Approved" }))).toBe("");
  });
});

describe("leaveApprovalActions", () => {
  test("keeps the existing labels for each stage", () => {
    expect(
      leaveApprovalActions(leaveRow({ canApproveHead: true, headReviewerRole: "HR" }))
    ).toEqual([{ key: "head", label: "Approve" }]);
    expect(
      leaveApprovalActions(
        leaveRow({ canApproveFinal: true, canApproveHead: true, canApproveHr: true })
      ).map((action) => action.label)
    ).toEqual(["Approve (Head)", "Approve (HR)", "Approve (Final Authority)"]);
    expect(leaveApprovalActions(leaveRow({ canReject: true }))).toEqual([]);
  });
});

describe("leave balances and durations", () => {
  test("shows only types with a balance plus Leave Without Pay", () => {
    const display = leaveBalancesForDisplay([
      { availableDays: 4, fiscalYear: "2026-2027", leaveType: "Casual" },
    ]);
    expect(display?.shown.map((row) => row.leaveType)).toEqual(["Casual", "Leave Without Pay"]);
    expect(display?.shown.map((row) => row.detail).join(" ")).not.toContain("No balance row");
    expect(missingBalancesText(display?.missing ?? [])).toBe(
      "No balance this year: Privilege, Sick, Maternity, Paternity, Bereavement and Marriage."
    );
    expect(leaveBalancesForDisplay(undefined)).toBeNull();
  });

  test("counts inclusive days", () => {
    expect(leaveDurationText(leaveRow({ endDate: "2026-11-05" }))).toBe("1 day");
    expect(leaveDurationText(leaveRow({ endDate: "2026-11-12" }))).toBe("8 days");
    expect(leaveDurationText(leaveRow({ endDate: "2026-11-01" }))).toBe("");
  });
});
