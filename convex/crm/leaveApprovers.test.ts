import { describe, expect, test } from "bun:test";
import { getLeaveApprovalActionsForApprover, resolveAlertLabelToStaff } from "./leaveApprovers";

const staffRows = [
  {
    _id: "staff_monika",
    active: true,
    email: "monika@citius.in",
    name: "Monika Sarang Karnik",
    roles: ["Operations Head", "Contracting Head"],
  },
  {
    _id: "staff_mithu",
    active: true,
    email: "mithu@citius.in",
    name: "Mithu Chatterjee",
    roles: ["HR"],
  },
  {
    _id: "staff_aditya",
    active: true,
    email: "aditya@citius.in",
    leaveHeadApproverId: "staff_monika",
    name: "Aditya Patil",
    roles: ["Contracting"],
  },
] as const;

describe("leaveApprovers", () => {
  test("maps matrix alert names to staff", () => {
    const match = resolveAlertLabelToStaff(staffRows as any, "Monika");
    expect(match?._id).toBe("staff_monika");
  });

  test("head approval does not expose HR actions in the same stage", () => {
    const leave = {
      headApproverStaffId: "staff_monika",
      headReviewStatus: "Pending",
      hrReviewStatus: "Pending",
      status: "Pending",
    };
    const employee = staffRows[2];

    const headAccess = {
      permissions: ["approve:leave"],
      roles: ["Operations Head"],
      staffId: "staff_monika",
    };
    const hrAccess = {
      permissions: ["manage:leave", "approve:leave"],
      roles: ["HR"],
      staffId: "staff_mithu",
    };

    const headActions = getLeaveApprovalActionsForApprover(
      headAccess as any,
      leave,
      employee as any,
      "staff_monika",
      null,
      () => false
    );
    expect(headActions.canApproveHead).toBe(true);
    expect(headActions.canApproveHr).toBe(false);

    const hrActions = getLeaveApprovalActionsForApprover(
      hrAccess as any,
      leave,
      employee as any,
      "staff_monika",
      null,
      (access) => access.roles.includes("HR")
    );
    expect(hrActions.canApproveHead).toBe(false);
    expect(hrActions.canApproveHr).toBe(false);
  });

  test("HR actions unlock only after head approval", () => {
    const leave = {
      headApproverStaffId: "staff_monika",
      headReviewStatus: "Approved",
      hrReviewStatus: "Pending",
      status: "Pending",
    };
    const employee = staffRows[2];
    const hrAccess = {
      permissions: ["manage:leave", "approve:leave"],
      roles: ["HR"],
      staffId: "staff_mithu",
    };

    const hrActions = getLeaveApprovalActionsForApprover(
      hrAccess as any,
      leave,
      employee as any,
      "staff_monika",
      null,
      (access) => access.roles.includes("HR")
    );
    expect(hrActions.canApproveHead).toBe(false);
    expect(hrActions.canApproveHr).toBe(true);
  });
});
