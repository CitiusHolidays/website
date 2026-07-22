import { describe, expect, test } from "bun:test";
import { getNotificationEmailDetails } from "./notificationEmailDetails";
import { createTourManagerForTest, updateTourManagerForTest } from "./ops";

type Row = { _id: string; [key: string]: any };
type Tables = Record<string, Row[]>;

const opsHeadAccess = {
  allowed: true,
  authUserId: "auth_ops_head",
  email: "ops-head@example.com",
  name: "Ops Head",
  permissions: ["manage:tourManagers"],
  roles: ["Operations Head"],
  staffId: "staff_ops_head",
};

function makeTourManagerCtx(initialTables: Tables = {}) {
  const tables = {
    activityLogs: [],
    jobCards: [
      {
        _id: "jobCards_1",
        clientName: "Acme Annual Offsite",
        confirmedPax: 24,
        createdAt: 1000,
        createdBy: "auth_accounts",
        destination: "Dubai",
        jobCode: "JC-0001-NS",
        status: "Open",
        travelEndDate: "2026-08-05",
        travelStartDate: "2026-08-01",
        updatedAt: 1000,
      },
    ],
    notifications: [],
    staffUsers: [
      {
        _id: "staff_ops_head",
        active: true,
        authUserId: "auth_ops_head",
        email: "ops-head@example.com",
        emailNormalized: "ops-head@example.com",
        name: "Ops Head",
        roles: ["Operations Head"],
      },
      {
        _id: "staff_tm",
        active: true,
        authUserId: "auth_tm",
        email: "tour.manager@example.com",
        emailAlertRoles: ["Tour Manager"],
        emailNormalized: "tour.manager@example.com",
        mobile: "+91 99999 00000",
        name: "Tour Manager",
        roles: ["Tour Manager"],
      },
    ],
    tourManagerAssignments: [],
    travelBatches: [
      {
        _id: "travelBatches_1",
        batchCode: "B01",
        batchReference: "JC-0001-NS / B01",
        confirmedPax: 12,
        createdAt: 1100,
        createdBy: "auth_ops_head",
        destination: "Abu Dhabi",
        jobCardId: "jobCards_1",
        status: "Open",
        travelEndDate: "2026-08-04",
        travelStartDate: "2026-08-02",
        updatedAt: 1100,
      },
      {
        _id: "travelBatches_other",
        batchCode: "B01",
        batchReference: "JC-9999-ZZ / B01",
        confirmedPax: 8,
        createdAt: 1100,
        createdBy: "auth_ops_head",
        destination: "Bali",
        jobCardId: "jobCards_other",
        status: "Open",
        updatedAt: 1100,
      },
    ],
    ...Object.fromEntries(
      Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
    ),
  } as Tables;
  const scheduledEmails: any[] = [];

  const getRows = (table: string) => tables[table] ?? [];
  const findById = async (id: string) => {
    for (const rows of Object.values(tables)) {
      const row = rows.find((entry) => entry._id === id);
      if (row) {
        return row;
      }
    }
    return null;
  };
  const queryBuilder = (table: string) => {
    let rows = getRows(table);
    const builder = {
      collect: async () => rows.map((row) => ({ ...row })),
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
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
    };
    return builder;
  };

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "ops-head@example.com",
        name: "Ops Head",
        subject: "auth_ops_head",
      }),
    },
    db: {
      get: findById,
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query: (table: string) => queryBuilder(table),
    },
    scheduler: {
      runAfter: async (_delay: number, fn: unknown, args: unknown) => {
        scheduledEmails.push({ args, fn });
      },
    },
  };

  return { ctx, scheduledEmails, tables };
}

describe("Tour Manager allocation notifications", () => {
  test("notifies assigned Tour Manager by bell and email with Job Card and Travel Batch context", async () => {
    const { ctx, tables, scheduledEmails } = makeTourManagerCtx();

    const result = await createTourManagerForTest(
      ctx as never,
      {
        jobCardId: "jobCards_1",
        name: "Manual Name",
        reportingInstructions: "Report at Terminal 3, Gate 5.",
        staffId: "staff_tm",
        travelBatchId: "travelBatches_1",
      },
      opsHeadAccess as never
    );

    expect(result).toEqual({ id: "tourManagerAssignments_1" });
    expect(tables.tourManagerAssignments[0]).toMatchObject({
      jobCardId: "jobCards_1",
      name: "Tour Manager",
      reportingInstructions: "Report at Terminal 3, Gate 5.",
      staffId: "staff_tm",
      travelBatchId: "travelBatches_1",
    });
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "tourManagerAssignments_1",
          entityType: "tourManager",
          recipientUserId: "auth_tm",
          title: "Tour Manager allocated",
        }),
      ])
    );
    expect(scheduledEmails).toEqual([
      expect.objectContaining({
        args: expect.objectContaining({
          entityId: "tourManagerAssignments_1",
          entityType: "tourManager",
          recipients: ["tour.manager@example.com"],
          title: "Tour Manager allocated",
        }),
      }),
    ]);
  });

  test("notification details include trip, pax, destination, and reporting instructions", async () => {
    const { ctx } = makeTourManagerCtx({
      tourManagerAssignments: [
        {
          _id: "tourManagerAssignments_1",
          callingStatus: "Pending",
          createdAt: 1200,
          createdBy: "auth_ops_head",
          email: "tour.manager@example.com",
          jobCardId: "jobCards_1",
          languages: [],
          name: "Tour Manager",
          phone: "+91 99999 00000",
          reportingInstructions: "Report at Terminal 3, Gate 5.",
          staffId: "staff_tm",
          status: "Assigned",
          travelBatchId: "travelBatches_1",
          updatedAt: 1200,
        },
      ],
    });

    const details = await (getNotificationEmailDetails as any)._handler(ctx, {
      entityId: "tourManagerAssignments_1",
      entityType: "tourManager",
    });

    expect(details).toMatchObject({
      rows: expect.arrayContaining([
        { label: "Job Card", value: "JC-0001-NS" },
        { label: "Travel Batch", value: "JC-0001-NS / B01" },
        { label: "Tour name", value: "Acme Annual Offsite" },
        { label: "Travel dates", value: "02/08/2026 to 04/08/2026" },
        { label: "Destination", value: "Abu Dhabi" },
        { label: "Pax", value: "12" },
        { label: "Reporting instructions", value: "Report at Terminal 3, Gate 5." },
      ]),
      title: "Tour manager details",
    });
  });

  test("keeps the Tour Manager bell notification but sends no email without opt-in", async () => {
    const { ctx, tables, scheduledEmails } = makeTourManagerCtx();
    const tourManager = tables.staffUsers.find((staff) => staff._id === "staff_tm");
    if (tourManager) {
      tourManager.emailAlertRoles = [];
    }

    await createTourManagerForTest(
      ctx as never,
      {
        jobCardId: "jobCards_1",
        name: "Manual Name",
        staffId: "staff_tm",
      },
      opsHeadAccess as never
    );

    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: "auth_tm",
          title: "Tour Manager allocated",
        }),
      ])
    );
    expect(scheduledEmails).toHaveLength(0);
  });

  test("notifies when an existing Tour Manager assignment is allocated to a Job Card", async () => {
    const { ctx, tables, scheduledEmails } = makeTourManagerCtx({
      tourManagerAssignments: [
        {
          _id: "tourManagerAssignments_1",
          callingStatus: "Pending",
          createdAt: 1200,
          createdBy: "auth_ops_head",
          email: "tour.manager@example.com",
          languages: [],
          name: "Tour Manager",
          phone: "+91 99999 00000",
          staffId: "staff_tm",
          status: "Available",
          updatedAt: 1200,
        },
      ],
    });

    await updateTourManagerForTest(
      ctx as never,
      {
        jobCardId: "jobCards_1",
        reportingInstructions: "Meet the group at hotel lobby.",
        tourManagerId: "tourManagerAssignments_1",
      },
      opsHeadAccess as never
    );

    expect(tables.tourManagerAssignments[0]).toMatchObject({
      jobCardId: "jobCards_1",
      reportingInstructions: "Meet the group at hotel lobby.",
      status: "Assigned",
    });
    expect(tables.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "tourManagerAssignments_1",
          entityType: "tourManager",
          recipientUserId: "auth_tm",
          title: "Tour Manager allocation updated",
        }),
      ])
    );
    expect(scheduledEmails[0].args).toMatchObject({
      entityId: "tourManagerAssignments_1",
      entityType: "tourManager",
      recipients: ["tour.manager@example.com"],
      title: "Tour Manager allocation updated",
    });
  });

  test("rejects a Travel Batch that does not belong to the selected Job Card", async () => {
    const { ctx } = makeTourManagerCtx();

    await expect(
      createTourManagerForTest(
        ctx as never,
        {
          jobCardId: "jobCards_1",
          name: "Tour Manager",
          staffId: "staff_tm",
          travelBatchId: "travelBatches_other",
        },
        opsHeadAccess as never
      )
    ).rejects.toThrow("Travel Batch must belong to the selected Job Card");
  });
});
