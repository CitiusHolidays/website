import { describe, expect, test } from "bun:test";
import { getNotificationEmailDetails } from "./notificationEmailDetails";
import { createTourManagerForTest, updateTourManagerForTest } from "./ops";

type Row = { _id: string; [key: string]: any };
type Tables = Record<string, Row[]>;

const opsHeadAccess = {
  allowed: true,
  staffId: "staff_ops_head",
  authUserId: "auth_ops_head",
  email: "ops-head@example.com",
  name: "Ops Head",
  roles: ["Operations Head"],
  permissions: ["manage:tourManagers"],
};

function makeTourManagerCtx(initialTables: Tables = {}) {
  const tables = {
    staffUsers: [
      {
        _id: "staff_ops_head",
        authUserId: "auth_ops_head",
        email: "ops-head@example.com",
        emailNormalized: "ops-head@example.com",
        name: "Ops Head",
        roles: ["Operations Head"],
        active: true,
      },
      {
        _id: "staff_tm",
        authUserId: "auth_tm",
        email: "tour.manager@example.com",
        emailNormalized: "tour.manager@example.com",
        mobile: "+91 99999 00000",
        name: "Tour Manager",
        roles: ["Tour Manager"],
        active: true,
      },
    ],
    jobCards: [
      {
        _id: "jobCards_1",
        jobCode: "JC-0001-NS",
        clientName: "Acme Annual Offsite",
        destination: "Dubai",
        confirmedPax: 24,
        travelStartDate: "2026-08-01",
        travelEndDate: "2026-08-05",
        status: "Open",
        createdBy: "auth_accounts",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    travelBatches: [
      {
        _id: "travelBatches_1",
        jobCardId: "jobCards_1",
        batchCode: "B01",
        batchReference: "JC-0001-NS / B01",
        destination: "Abu Dhabi",
        confirmedPax: 12,
        travelStartDate: "2026-08-02",
        travelEndDate: "2026-08-04",
        status: "Open",
        createdBy: "auth_ops_head",
        createdAt: 1100,
        updatedAt: 1100,
      },
      {
        _id: "travelBatches_other",
        jobCardId: "jobCards_other",
        batchCode: "B01",
        batchReference: "JC-9999-ZZ / B01",
        destination: "Bali",
        confirmedPax: 8,
        status: "Open",
        createdBy: "auth_ops_head",
        createdAt: 1100,
        updatedAt: 1100,
      },
    ],
    tourManagerAssignments: [],
    activityLogs: [],
    notifications: [],
    ...Object.fromEntries(
      Object.entries(initialTables).map(([table, rows]) => [
        table,
        rows.map((row) => ({ ...row })),
      ]),
    ),
  } as Tables;
  const scheduledEmails: any[] = [];

  const getRows = (table: string) => tables[table] ?? [];
  const findById = async (id: string) => {
    for (const rows of Object.values(tables)) {
      const row = rows.find((entry) => entry._id === id);
      if (row) return row;
    }
    return null;
  };
  const queryBuilder = (table: string) => {
    let rows = getRows(table);
    const builder = {
      withIndex(_indexName: string, callback: (q: any) => unknown) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: unknown) {
            filters.push({ field, value });
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => filters.every((filter) => row[filter.field] === filter.value));
        return builder;
      },
      collect: async () => rows.map((row) => ({ ...row })),
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
    };
    return builder;
  };

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        subject: "auth_ops_head",
        email: "ops-head@example.com",
        name: "Ops Head",
      }),
    },
    scheduler: {
      runAfter: async (_delay: number, fn: unknown, args: unknown) => {
        scheduledEmails.push({ fn, args });
      },
    },
    db: {
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      get: findById,
      query: (table: string) => queryBuilder(table),
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
        return id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
    },
  };

  return { ctx, tables, scheduledEmails };
}

describe("Tour Manager allocation notifications", () => {
  test("notifies assigned Tour Manager by bell and email with Job Card and Travel Batch context", async () => {
    const { ctx, tables, scheduledEmails } = makeTourManagerCtx();

    const result = await createTourManagerForTest(
      ctx as never,
      {
        jobCardId: "jobCards_1",
        travelBatchId: "travelBatches_1",
        staffId: "staff_tm",
        name: "Manual Name",
        reportingInstructions: "Report at Terminal 3, Gate 5.",
      },
      opsHeadAccess as never,
    );

    expect(result).toEqual({ id: "tourManagerAssignments_1" });
    expect(tables.tourManagerAssignments[0]).toMatchObject({
      jobCardId: "jobCards_1",
      travelBatchId: "travelBatches_1",
      staffId: "staff_tm",
      name: "Tour Manager",
      reportingInstructions: "Report at Terminal 3, Gate 5.",
    });
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: "auth_tm",
          title: "Tour Manager allocated",
          entityType: "tourManager",
          entityId: "tourManagerAssignments_1",
        }),
      ]),
    );
    expect(scheduledEmails).toEqual([
      expect.objectContaining({
        args: expect.objectContaining({
          recipients: ["tour.manager@example.com"],
          title: "Tour Manager allocated",
          entityType: "tourManager",
          entityId: "tourManagerAssignments_1",
        }),
      }),
    ]);
  });

  test("notification details include trip, pax, destination, and reporting instructions", async () => {
    const { ctx } = makeTourManagerCtx({
      tourManagerAssignments: [
        {
          _id: "tourManagerAssignments_1",
          jobCardId: "jobCards_1",
          travelBatchId: "travelBatches_1",
          staffId: "staff_tm",
          name: "Tour Manager",
          email: "tour.manager@example.com",
          phone: "+91 99999 00000",
          status: "Assigned",
          languages: [],
          callingStatus: "Pending",
          reportingInstructions: "Report at Terminal 3, Gate 5.",
          createdBy: "auth_ops_head",
          createdAt: 1200,
          updatedAt: 1200,
        },
      ],
    });

    const details = await (getNotificationEmailDetails as any)._handler(ctx, {
      entityType: "tourManager",
      entityId: "tourManagerAssignments_1",
    });

    expect(details).toMatchObject({
      title: "Tour manager details",
      rows: expect.arrayContaining([
        { label: "Job Card", value: "JC-0001-NS" },
        { label: "Travel Batch", value: "JC-0001-NS / B01" },
        { label: "Tour name", value: "Acme Annual Offsite" },
        { label: "Travel dates", value: "02/08/2026 to 04/08/2026" },
        { label: "Destination", value: "Abu Dhabi" },
        { label: "Pax", value: "12" },
        { label: "Reporting instructions", value: "Report at Terminal 3, Gate 5." },
      ]),
    });
  });

  test("notifies when an existing Tour Manager assignment is allocated to a Job Card", async () => {
    const { ctx, tables, scheduledEmails } = makeTourManagerCtx({
      tourManagerAssignments: [
        {
          _id: "tourManagerAssignments_1",
          staffId: "staff_tm",
          name: "Tour Manager",
          email: "tour.manager@example.com",
          phone: "+91 99999 00000",
          status: "Available",
          languages: [],
          callingStatus: "Pending",
          createdBy: "auth_ops_head",
          createdAt: 1200,
          updatedAt: 1200,
        },
      ],
    });

    await updateTourManagerForTest(
      ctx as never,
      {
        tourManagerId: "tourManagerAssignments_1",
        jobCardId: "jobCards_1",
        reportingInstructions: "Meet the group at hotel lobby.",
      },
      opsHeadAccess as never,
    );

    expect(tables.tourManagerAssignments[0]).toMatchObject({
      jobCardId: "jobCards_1",
      status: "Assigned",
      reportingInstructions: "Meet the group at hotel lobby.",
    });
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: "auth_tm",
          title: "Tour Manager allocation updated",
          entityType: "tourManager",
          entityId: "tourManagerAssignments_1",
        }),
      ]),
    );
    expect(scheduledEmails[0].args).toMatchObject({
      recipients: ["tour.manager@example.com"],
      title: "Tour Manager allocation updated",
      entityType: "tourManager",
      entityId: "tourManagerAssignments_1",
    });
  });

  test("rejects a Travel Batch that does not belong to the selected Job Card", async () => {
    const { ctx } = makeTourManagerCtx();

    await expect(
      createTourManagerForTest(
        ctx as never,
        {
          jobCardId: "jobCards_1",
          travelBatchId: "travelBatches_other",
          staffId: "staff_tm",
          name: "Tour Manager",
        },
        opsHeadAccess as never,
      ),
    ).rejects.toThrow("Travel Batch must belong to the selected Job Card");
  });
});
