import { beforeAll, describe, expect, mock, spyOn, test } from "bun:test";

beforeAll(() => {
  mock.module("../_generated/server", () => ({
    mutation: (definition: { handler: unknown }) => definition.handler,
    query: (definition: { handler: unknown }) => definition.handler,
  }));
  mock.module("../_generated/api", () => ({
    internal: {
      crm: {
        notificationEmails: {
          sendNotificationEmail: "internal.crm.notificationEmails.sendNotificationEmail",
        },
      },
    },
  }));
  mock.module("../_generated/dataModel", () => ({}));
});

type LeaveModule = typeof import("./leave");
type LeaveApproversModule = typeof import("./leaveApprovers");

let createLeaveRequest: LeaveModule["createLeaveRequest"];
let decideLeaveRequest: LeaveModule["decideLeaveRequest"];
let leaveApprovers: LeaveApproversModule;

beforeAll(async () => {
  ({ createLeaveRequest, decideLeaveRequest } = await import("./leave"));
  leaveApprovers = await import("./leaveApprovers");
});

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeLeaveCtx(
  initialTables: Tables,
  identity: { subject: string; email: string; name: string }
) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;
  let currentIdentity = identity;

  const ctx = {
    auth: {
      getUserIdentity: async () => currentIdentity,
    },
    db: {
      delete: async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table].splice(index, 1);
            return;
          }
        }
      },
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
      normalizeId(_tableName: string, id: string) {
        return id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          first: async () => rows[0] ?? null,
          unique: async () => (rows.length === 1 ? rows[0] : null),
          withIndex(_indexName: string, callback: (q: unknown) => unknown) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return this;
          },
        };
      },
    },
    scheduler: {
      runAfter: async () => undefined,
    },
  };

  return {
    ctx,
    setIdentity(next: { subject: string; email: string; name: string }) {
      currentIdentity = next;
    },
    tables,
  };
}

const hrStaff = {
  _id: "staff_hr",
  active: true,
  authUserId: "auth_hr",
  email: "hr@citius.in",
  emailNormalized: "hr@citius.in",
  employmentStatus: "Confirmed",
  name: "HR User",
  roles: ["HR"],
};

const headStaff = {
  _id: "staff_head",
  active: true,
  authUserId: "auth_head",
  email: "head@citius.in",
  emailNormalized: "head@citius.in",
  employmentStatus: "Confirmed",
  name: "Department Head",
  roles: ["Operations Head"],
};

const workbookHeadStaff = {
  _id: "staff_workbook_head",
  active: true,
  authUserId: "auth_workbook_head",
  email: "workbook-head@citius.in",
  emailNormalized: "workbook-head@citius.in",
  employmentStatus: "Confirmed",
  name: "Workbook Head",
  roles: ["Operations Head"],
};

const finalAuthorityStaff = {
  _id: "staff_final",
  active: true,
  authUserId: "auth_final",
  email: "final@citius.in",
  emailNormalized: "final@citius.in",
  employmentStatus: "Confirmed",
  name: "Final Authority",
  roles: ["Directors"],
};

const employeeStaff = {
  _id: "staff_employee",
  active: true,
  authUserId: "auth_employee",
  email: "employee@citius.in",
  emailNormalized: "employee@citius.in",
  employmentStatus: "Confirmed",
  leaveHeadApproverId: "staff_head",
  name: "Employee User",
  roles: ["Operations"],
};

const workbookEmployeeStaff = {
  ...employeeStaff,
  leaveFinalAuthorityName: "Workbook Head",
  leaveFinalAuthorityStaffId: "staff_workbook_head",
  leaveHeadApproverId: undefined,
  leaveHrCopyName: "HR User",
  leaveHrCopyStaffId: "staff_hr",
  leaveLevel1ApproverName: "Workbook Head",
  leaveLevel1ApproverStaffId: "staff_workbook_head",
};

describe("leaveCreateApproval", () => {
  test("leave requests notify workbook-derived level 1 approver and configured HR copy", async () => {
    const { ctx, tables } = makeLeaveCtx(
      {
        activityLogs: [],
        notifications: [],
        staffLeaveBalances: [],
        staffLeaveLedger: [],
        staffLeaveRecords: [],
        staffUsers: [hrStaff, headStaff, workbookHeadStaff, workbookEmployeeStaff],
      },
      { email: "hr@citius.in", name: "HR User", subject: "auth_hr" }
    );

    await createLeaveRequest(ctx as never, {
      endDate: "2026-07-01",
      leaveType: "Casual",
      reason: "Personal",
      staffId: "staff_employee",
      startDate: "2026-07-01",
    });

    const leave = tables.staffLeaveRecords[0];
    expect(leave?.headApproverStaffId).toBe("staff_workbook_head");
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: "auth_workbook_head",
          title: "Leave awaiting your approval",
        }),
        expect.objectContaining({
          recipientUserId: "auth_hr",
          title: "Leave submitted (HR copy)",
        }),
      ])
    );
  });

  test("manual leave head override takes precedence over workbook level 1 approver", async () => {
    const overriddenEmployee = {
      ...workbookEmployeeStaff,
      leaveHeadApproverId: "staff_head",
    };
    const { ctx, tables } = makeLeaveCtx(
      {
        activityLogs: [],
        notifications: [],
        staffLeaveBalances: [],
        staffLeaveLedger: [],
        staffLeaveRecords: [],
        staffUsers: [hrStaff, headStaff, workbookHeadStaff, overriddenEmployee],
      },
      { email: "hr@citius.in", name: "HR User", subject: "auth_hr" }
    );

    await createLeaveRequest(ctx as never, {
      endDate: "2026-07-01",
      leaveType: "Casual",
      reason: "Personal",
      staffId: "staff_employee",
      startDate: "2026-07-01",
    });

    const leave = tables.staffLeaveRecords[0];
    expect(leave?.headApproverStaffId).toBe("staff_head");
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: "auth_head",
          title: "Leave awaiting your approval",
        }),
      ])
    );
    expect(tables.notifications.some((row) => row.recipientUserId === "auth_workbook_head")).toBe(
      false
    );
  });

  test("different level 1 and final authority values require final authority before HR review", async () => {
    const threeStageEmployee = {
      ...workbookEmployeeStaff,
      leaveFinalAuthorityName: "Final Authority",
      leaveFinalAuthorityStaffId: "staff_final",
    };
    const { ctx, tables, setIdentity } = makeLeaveCtx(
      {
        activityLogs: [],
        notifications: [],
        staffLeaveBalances: [],
        staffLeaveLedger: [],
        staffLeaveRecords: [],
        staffUsers: [hrStaff, workbookHeadStaff, finalAuthorityStaff, threeStageEmployee],
      },
      { email: "hr@citius.in", name: "HR User", subject: "auth_hr" }
    );

    const { id } = await createLeaveRequest(ctx as never, {
      endDate: "2026-07-01",
      leaveType: "Casual",
      reason: "Personal",
      staffId: "staff_employee",
      startDate: "2026-07-01",
    });

    setIdentity({
      email: "workbook-head@citius.in",
      name: "Workbook Head",
      subject: "auth_workbook_head",
    });
    await decideLeaveRequest(ctx as never, {
      decisionNote: "Level 1 ok",
      leaveId: id,
      status: "Approved",
    });

    const afterLevel1 = tables.staffLeaveRecords.find((row) => row._id === id);
    expect(afterLevel1?.status).toBe("Pending");
    expect(afterLevel1?.headReviewStatus).toBe("Approved");
    expect(afterLevel1?.finalReviewStatus).toBe("Pending");
    expect(afterLevel1?.hrReviewStatus).toBe("Pending");
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: "auth_final",
          title: "Leave awaiting final authority approval",
        }),
      ])
    );

    setIdentity({ email: "hr@citius.in", name: "HR User", subject: "auth_hr" });
    await expect(
      decideLeaveRequest(ctx as never, {
        decisionNote: "Too early",
        leaveId: id,
        status: "Approved",
      })
    ).rejects.toThrow("Final authority approval is required before HR review");

    setIdentity({ email: "final@citius.in", name: "Final Authority", subject: "auth_final" });
    await decideLeaveRequest(ctx as never, {
      decisionNote: "Final ok",
      leaveId: id,
      status: "Approved",
    });

    const afterFinal = tables.staffLeaveRecords.find((row) => row._id === id);
    expect(afterFinal?.status).toBe("Pending");
    expect(afterFinal?.finalReviewStatus).toBe("Approved");
    expect(afterFinal?.hrReviewStatus).toBe("Pending");
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: "auth_hr",
          title: "Leave ready for HR approval",
        }),
      ])
    );

    setIdentity({ email: "hr@citius.in", name: "HR User", subject: "auth_hr" });
    await decideLeaveRequest(ctx as never, {
      decisionNote: "HR ok",
      leaveId: id,
      status: "Approved",
    });

    const afterHr = tables.staffLeaveRecords.find((row) => row._id === id);
    expect(afterHr?.status).toBe("Approved");
    expect(afterHr?.hrReviewStatus).toBe("Approved");
    expect(tables.staffLeaveLedger.some((entry) => entry.entryType === "usage")).toBe(true);
  });

  test("HR create with Approved still inserts Pending reviews and no ledger usage", async () => {
    const notifySpy = spyOn(leaveApprovers, "notifyLeaveRequestSubmitted").mockResolvedValue(
      undefined
    );
    try {
      const { ctx, tables } = makeLeaveCtx(
        {
          activityLogs: [],
          notifications: [],
          staffLeaveBalances: [],
          staffLeaveLedger: [],
          staffLeaveRecords: [],
          staffUsers: [hrStaff, headStaff, employeeStaff],
        },
        { email: "hr@citius.in", name: "HR User", subject: "auth_hr" }
      );

      await createLeaveRequest(ctx as never, {
        endDate: "2026-07-01",
        leaveType: "Casual",
        reason: "Personal",
        staffId: "staff_employee",
        startDate: "2026-07-01",
        status: "Approved",
      });

      const leave = tables.staffLeaveRecords[0];
      expect(leave?.status).toBe("Pending");
      expect(leave?.headReviewStatus).toBe("Pending");
      expect(leave?.hrReviewStatus).toBe("Pending");
      expect(leave?.headReviewedBy).toBeUndefined();
      expect(leave?.hrReviewedBy).toBeUndefined();
      expect(tables.staffLeaveLedger).toHaveLength(0);
      expect(notifySpy).toHaveBeenCalled();
    } finally {
      notifySpy.mockRestore();
    }
  });

  test("decide completes head approval then HR approval with ledger usage", async () => {
    const notifySpy = spyOn(leaveApprovers, "notifyLeaveRequestSubmitted").mockResolvedValue(
      undefined
    );
    try {
      const { ctx, tables, setIdentity } = makeLeaveCtx(
        {
          activityLogs: [],
          notifications: [],
          staffLeaveBalances: [],
          staffLeaveLedger: [],
          staffLeaveRecords: [],
          staffUsers: [hrStaff, headStaff, employeeStaff],
        },
        { email: "hr@citius.in", name: "HR User", subject: "auth_hr" }
      );

      const { id } = await createLeaveRequest(ctx as never, {
        endDate: "2026-07-01",
        leaveType: "Casual",
        reason: "Personal",
        staffId: "staff_employee",
        startDate: "2026-07-01",
      });

      setIdentity({ email: "head@citius.in", name: "Department Head", subject: "auth_head" });
      await decideLeaveRequest(ctx as never, {
        decisionNote: "Head ok",
        leaveId: id,
        status: "Approved",
      });

      const afterHead = tables.staffLeaveRecords.find((row) => row._id === id);
      expect(afterHead?.status).toBe("Pending");
      expect(afterHead?.headReviewStatus).toBe("Approved");
      expect(afterHead?.hrReviewStatus).toBe("Pending");
      expect(tables.staffLeaveLedger).toHaveLength(0);

      setIdentity({ email: "hr@citius.in", name: "HR User", subject: "auth_hr" });
      await decideLeaveRequest(ctx as never, {
        decisionNote: "HR ok",
        leaveId: id,
        status: "Approved",
      });

      const afterHr = tables.staffLeaveRecords.find((row) => row._id === id);
      expect(afterHr?.status).toBe("Approved");
      expect(afterHr?.hrReviewStatus).toBe("Approved");
      expect(tables.staffLeaveLedger.some((entry) => entry.entryType === "usage")).toBe(true);
    } finally {
      notifySpy.mockRestore();
    }
  });
});
