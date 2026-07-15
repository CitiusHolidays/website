import { describe, expect, test } from "bun:test";
import {
  continueApprovalCleanup,
  continueJobCardCascade,
} from "../../../convex/crm/jobCardDeletion";
import { deleteJobCardCascade } from "../../../convex/crm/lib";
import { deleteNotificationPage } from "../../../convex/crm/notificationCleanup";
import { continueTravellerCleanup } from "../../../convex/crm/travellers";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;
  const deletedStorageIds: string[] = [];
  const takeCalls: Array<{ count: number; tableName: string }> = [];
  let insertedId = 0;

  const ctx = {
    db: {
      delete: async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
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
      insert: async (tableName: string, value: Record<string, unknown>) => {
        insertedId += 1;
        const id = `${tableName}_${insertedId}`;
        tables[tableName] = [...(tables[tableName] ?? []), { _id: id, ...value }];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: async (id: string, value: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.map((row) => (row._id === id ? { ...row, ...value } : row));
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        const query = {
          collect: async () => [...rows],
          first: async () => rows[0] ?? null,
          order(direction: "asc" | "desc") {
            if (direction === "desc") {
              rows = [...rows].reverse();
            }
            return query;
          },
          take: async (count: number) => {
            takeCalls.push({ count, tableName });
            return rows.slice(0, count);
          },
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
            return query;
          },
        };
        return query;
      },
    },
    scheduler: {
      runAfter: async (
        _delay: number,
        _functionReference: unknown,
        args: {
          approvalEntityId?: string;
          approvalEntityType?: string;
          entityId?: string;
          entityType?: string;
          identities?: Array<{ entityId: string; entityType: string }>;
          jobCardId?: string;
          mode?: "all" | "private";
          operationId?: string;
          stage?: string;
          travellerId?: string;
          workerId?: string;
        }
      ) => {
        if (args.jobCardId && args.stage) {
          await (continueJobCardCascade as any)._handler(ctx, args);
          return;
        }
        if (args.travellerId && args.stage && args.mode) {
          await (continueTravellerCleanup as any)._handler(ctx, args);
          return;
        }
        if (args.approvalEntityId && args.approvalEntityType) {
          await (continueApprovalCleanup as any)._handler(ctx, args);
          return;
        }
        const identities =
          args.identities ??
          (args.entityId && args.entityType
            ? [{ entityId: args.entityId, entityType: args.entityType }]
            : []);
        await Promise.all(
          identities.map((identity) =>
            deleteNotificationPage(ctx as never, identity.entityType, identity.entityId)
          )
        );
      },
    },
    storage: {
      delete: async (storageId: string) => {
        deletedStorageIds.push(storageId);
      },
    },
  };

  return { ctx, deletedStorageIds, tables, takeCalls };
}

describe("deleteJobCardCascade", () => {
  test("removes all job-card descendants, linked expense approvals, and stored files", async () => {
    const jobCardId = "job_1";
    const { ctx, tables, deletedStorageIds } = makeCtx({
      activityLogs: [{ _id: "activity_1", entityId: jobCardId, entityType: "jobCard" }],
      additionalServices: [{ _id: "service_1", jobCardId }],
      approvalRequests: [{ _id: "approval_1", entityId: "expense_1", entityType: "expense" }],
      attachments: [
        {
          _id: "expense_attachment_1",
          entityId: "expense_1",
          entityType: "expense",
          storageId: "expense_storage_1",
        },
      ],
      checklistTasks: [{ _id: "checklist_1", jobCardId }],
      eventFlows: [{ _id: "event_flow_1", jobCardId }],
      expenseEntries: [{ _id: "expense_1", jobCardId, proofAttachmentId: "expense_attachment_1" }],
      flightGroups: [{ _id: "flight_group_1", jobCardId }],
      flightSegments: [{ _id: "flight_segment_1", flightGroupId: "flight_group_1", jobCardId }],
      hotels: [{ _id: "hotel_1", jobCardId }],
      invoices: [{ _id: "invoice_1", jobCardId }],
      itineraries: [{ _id: "itinerary_1", jobCardId }],
      jobCards: [{ _id: jobCardId }],
      mealPreferences: [{ _id: "meal_1", travellerId: "traveller_1" }],
      notifications: [
        { _id: "notification_job", entityId: jobCardId, entityType: "jobCard" },
        { _id: "notification_traveller", entityId: "traveller_1", entityType: "traveller" },
        { _id: "notification_expense", entityId: "expense_1", entityType: "expense" },
      ],
      passportDetails: [
        {
          _id: "passport_1",
          storageId: "passport_storage_1",
          travellerId: "traveller_1",
        },
      ],
      pnrs: [{ _id: "pnr_1", jobCardId }],
      roomingListEntries: [{ _id: "room_1", jobCardId, travellerId: "traveller_1" }],
      seatAllocations: [{ _id: "seat_1", jobCardId, travellerId: "traveller_1" }],
      tickets: [{ _id: "ticket_1", jobCardId, travellerId: "traveller_1" }],
      tourManagerAssignments: [{ _id: "tour_manager_1", jobCardId }],
      travelBatches: [{ _id: "travel_batch_1", jobCardId }],
      travellers: [{ _id: "traveller_1", jobCardId }],
      vendors: [{ _id: "vendor_1", jobCardId }],
      visaRecords: [{ _id: "visa_1", jobCardId, travellerId: "traveller_1" }],
    });

    await deleteJobCardCascade(ctx as never, jobCardId as never, {
      initiatedBy: "auth_accounts",
      jobCode: "JC-0001-AA",
    });

    expect(tables.flightSegments).toEqual([]);
    expect(tables.approvalRequests).toEqual([]);
    expect(tables.notifications).toEqual([]);
    expect(tables.activityLogs).toHaveLength(1);
    expect(deletedStorageIds).toEqual(["passport_storage_1", "expense_storage_1"]);
    expect(tables.jobCardDeletionOperations).toEqual([
      expect.objectContaining({
        deletedCount: 18,
        jobCode: "JC-0001-AA",
        stage: "complete",
        status: "complete",
      }),
    ]);

    for (const tableName of [
      "jobCards",
      "travellers",
      "passportDetails",
      "mealPreferences",
      "flightGroups",
      "visaRecords",
      "pnrs",
      "tickets",
      "seatAllocations",
      "hotels",
      "roomingListEntries",
      "tourManagerAssignments",
      "travelBatches",
      "vendors",
      "itineraries",
      "eventFlows",
      "checklistTasks",
      "invoices",
      "additionalServices",
      "attachments",
      "expenseEntries",
    ]) {
      expect(tables[tableName], tableName).toEqual([]);
    }
  });

  test("deletes an empty job card without touching activity log history", async () => {
    const jobCardId = "job_empty";
    const activityLogs = [
      { _id: "activity_job", entityId: jobCardId, entityType: "jobCard" },
      { _id: "activity_other", entityId: "query_1", entityType: "query" },
    ];
    const { ctx, tables } = makeCtx({
      activityLogs: [...activityLogs],
      jobCards: [{ _id: jobCardId }],
    });

    await deleteJobCardCascade(ctx as never, jobCardId as never, {
      initiatedBy: "auth_accounts",
      jobCode: "JC-0002-AA",
    });

    expect(tables.jobCards).toEqual([]);
    expect(tables.activityLogs).toEqual(activityLogs);
  });

  test("continues a large child cascade in fixed-size worker pages", async () => {
    const jobCardId = "job_large";
    const { ctx, tables, takeCalls } = makeCtx({
      jobCards: [{ _id: jobCardId }],
      notifications: [],
      tickets: Array.from({ length: 65 }, (_, index) => ({
        _id: `ticket_${index}`,
        jobCardId,
      })),
    });

    const operationId = await deleteJobCardCascade(ctx as never, jobCardId as never, {
      initiatedBy: "auth_accounts",
      jobCode: "JC-0003-AA",
    });

    expect(tables.tickets).toEqual([]);
    const ticketPages = takeCalls.filter((call) => call.tableName === "tickets");
    expect(ticketPages).toHaveLength(3);
    expect(ticketPages.every((call) => call.count === 32)).toBe(true);

    await (continueJobCardCascade as any)._handler(ctx, {
      jobCardId,
      operationId,
      stage: "travellers",
    });
    expect(tables.jobCardDeletionOperations[0]).toEqual(
      expect.objectContaining({ deletedCount: 65, status: "complete" })
    );
  });

  test("finishes more than 100 traveller workers without orphaned private descendants", async () => {
    const jobCardId = "job_many_travellers";
    const travellers = Array.from({ length: 105 }, (_, index) => ({
      _id: `traveller_${index}`,
      jobCardId,
    }));
    const { ctx, tables, deletedStorageIds } = makeCtx({
      jobCardDeletionOperations: [],
      jobCardDeletionWorkers: [],
      jobCards: [{ _id: jobCardId }],
      mealPreferences: travellers.map((traveller, index) => ({
        _id: `meal_${index}`,
        travellerId: traveller._id,
      })),
      notifications: [],
      passportDetails: travellers.map((traveller, index) => ({
        _id: `passport_${index}`,
        storageId: `passport_storage_${index}`,
        travellerId: traveller._id,
      })),
      travellers,
    });

    await deleteJobCardCascade(ctx as never, jobCardId as never, {
      initiatedBy: "auth_accounts",
      jobCode: "JC-0105-AA",
    });

    expect(tables.travellers).toEqual([]);
    expect(tables.passportDetails).toEqual([]);
    expect(tables.mealPreferences).toEqual([]);
    expect(deletedStorageIds).toHaveLength(105);
    expect(tables.jobCardDeletionWorkers).toHaveLength(105);
    expect(tables.jobCardDeletionWorkers.every((worker) => worker.status === "complete")).toBe(
      true
    );
    expect(tables.jobCardDeletionOperations[0]).toEqual(
      expect.objectContaining({ deletedCount: 105, stage: "complete", status: "complete" })
    );
  });
});
