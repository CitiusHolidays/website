import { describe, expect, test } from "bun:test";
import { getLeaveApprovalActionsForApprover, resolveAlertLabelToStaff } from "./leaveApprovers";

const staffRows = [
  {
    _id: "staff_monika",
    email: "monika@citius.in",
    name: "Monika Sarang Karnik",
    roles: ["Operations Head", "Contracting Head"],
    active: true,
  },
  {
    _id: "staff_mithu",
    email: "mithu@citius.in",
    name: "Mithu Chatterjee",
    roles: ["HR"],
    active: true,
  },
  {
    _id: "staff_aditya",
    email: "aditya@citius.in",
    name: "Aditya Patil",
    roles: ["Contracting"],
    active: true,
    leaveHeadApproverId: "staff_monika",
  },
] as const;

describe("leaveApprovers", () => {
  test("maps matrix alert names to staff", () => {
    const match = resolveAlertLabelToStaff(staffRows as any, "Monika");
    expect(match?._id).toBe("staff_monika");
  });

  test("head approval does not expose HR actions in the same stage", () => {
    const leave = {
      status: "Pending",
      headReviewStatus: "Pending",
      hrReviewStatus: "Pending",
      headApproverStaffId: "staff_monika",
    };
    const employee = staffRows[2];

    const headAccess = {
      staffId: "staff_monika",
      roles: ["Operations Head"],
      permissions: ["approve:leave"],
    };
    const hrAccess = {
      staffId: "staff_mithu",
      roles: ["HR"],
      permissions: ["manage:leave", "approve:leave"],
    };

    const headActions = getLeaveApprovalActionsForApprover(
      headAccess as any,
      leave,
      employee as any,
      "staff_monika",
      () => false,
    );
    expect(headActions.canApproveHead).toBe(true);
    expect(headActions.canApproveHr).toBe(false);

    const hrActions = getLeaveApprovalActionsForApprover(
      hrAccess as any,
      leave,
      employee as any,
      "staff_monika",
      (access) => access.roles.includes("HR"),
    );
    expect(hrActions.canApproveHead).toBe(false);
    expect(hrActions.canApproveHr).toBe(false);
  });

  test("HR actions unlock only after head approval", () => {
    const leave = {
      status: "Pending",
      headReviewStatus: "Approved",
      hrReviewStatus: "Pending",
      headApproverStaffId: "staff_monika",
    };
    const employee = staffRows[2];
    const hrAccess = {
      staffId: "staff_mithu",
      roles: ["HR"],
      permissions: ["manage:leave", "approve:leave"],
    };

    const hrActions = getLeaveApprovalActionsForApprover(
      hrAccess as any,
      leave,
      employee as any,
      "staff_monika",
      (access) => access.roles.includes("HR"),
    );
    expect(hrActions.canApproveHead).toBe(false);
    expect(hrActions.canApproveHr).toBe(true);
  });
});
