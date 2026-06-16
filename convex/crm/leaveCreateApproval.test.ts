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
  identity: { subject: string; email: string; name: string },
) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;
  let currentIdentity = identity;

  const ctx = {
    auth: {
      getUserIdentity: async () => currentIdentity,
    },
    db: {
      normalizeId(_tableName: string, id: string) {
        return id;
      },
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) return row;
        }
        return null;
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
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
              filters.every((filter) => row[filter.field] === filter.value),
            );
            return this;
          },
          first: async () => rows[0] ?? null,
          unique: async () => (rows.length === 1 ? rows[0] : null),
          collect: async () => [...rows],
        };
      },
      insert: async (tableName: string, doc: Record<string, unknown>) => {
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
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
      delete: async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table].splice(index, 1);
            return;
          }
        }
      },
    },
    scheduler: {
      runAfter: async () => undefined,
    },
  };

  return {
    ctx,
    tables,
    setIdentity(next: { subject: string; email: string; name: string }) {
      currentIdentity = next;
    },
  };
}

const hrStaff = {
  _id: "staff_hr",
  authUserId: "auth_hr",
  email: "hr@citius.in",
  emailNormalized: "hr@citius.in",
  name: "HR User",
  roles: ["HR"],
  active: true,
  employmentStatus: "Confirmed",
};

const headStaff = {
  _id: "staff_head",
  authUserId: "auth_head",
  email: "head@citius.in",
  emailNormalized: "head@citius.in",
  name: "Department Head",
  roles: ["Operations Head"],
  active: true,
  employmentStatus: "Confirmed",
};

const employeeStaff = {
  _id: "staff_employee",
  authUserId: "auth_employee",
  email: "employee@citius.in",
  emailNormalized: "employee@citius.in",
  name: "Employee User",
  roles: ["Operations"],
  active: true,
  employmentStatus: "Confirmed",
  leaveHeadApproverId: "staff_head",
};

describe("leaveCreateApproval", () => {
  test("HR create with Approved still inserts Pending reviews and no ledger usage", async () => {
    const notifySpy = spyOn(leaveApprovers, "notifyLeaveRequestSubmitted").mockResolvedValue(
      undefined,
    );
    try {
      const { ctx, tables } = makeLeaveCtx(
        {
          staffUsers: [hrStaff, headStaff, employeeStaff],
          staffLeaveRecords: [],
          staffLeaveBalances: [],
          staffLeaveLedger: [],
          activityLogs: [],
          notifications: [],
        },
        { subject: "auth_hr", email: "hr@citius.in", name: "HR User" },
      );

      await createLeaveRequest(ctx as never, {
        staffId: "staff_employee",
        leaveType: "Casual",
        startDate: "2026-07-01",
        endDate: "2026-07-01",
        reason: "Personal",
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
      undefined,
    );
    try {
      const { ctx, tables, setIdentity } = makeLeaveCtx(
        {
          staffUsers: [hrStaff, headStaff, employeeStaff],
          staffLeaveRecords: [],
          staffLeaveBalances: [],
          staffLeaveLedger: [],
          activityLogs: [],
          notifications: [],
        },
        { subject: "auth_hr", email: "hr@citius.in", name: "HR User" },
      );

      const { id } = await createLeaveRequest(ctx as never, {
        staffId: "staff_employee",
        leaveType: "Casual",
        startDate: "2026-07-01",
        endDate: "2026-07-01",
        reason: "Personal",
      });

      setIdentity({ subject: "auth_head", email: "head@citius.in", name: "Department Head" });
      await decideLeaveRequest(ctx as never, {
        leaveId: id,
        status: "Approved",
        decisionNote: "Head ok",
      });

      const afterHead = tables.staffLeaveRecords.find((row) => row._id === id);
      expect(afterHead?.status).toBe("Pending");
      expect(afterHead?.headReviewStatus).toBe("Approved");
      expect(afterHead?.hrReviewStatus).toBe("Pending");
      expect(tables.staffLeaveLedger).toHaveLength(0);

      setIdentity({ subject: "auth_hr", email: "hr@citius.in", name: "HR User" });
      await decideLeaveRequest(ctx as never, {
        leaveId: id,
        status: "Approved",
        decisionNote: "HR ok",
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
