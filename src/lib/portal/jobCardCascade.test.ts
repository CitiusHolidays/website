import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import {
  continueApprovalCleanup,
  continueJobCardCascade,
  continueTravellerWorkerQueue,
} from "../../../convex/crm/jobCardDeletion";
import { deleteJobCardCascade } from "../../../convex/crm/lib";
import { deleteNotificationPage } from "../../../convex/crm/notificationCleanup";
import { continueTravellerCleanup } from "../../../convex/crm/travellers";
import type { RuntimeObject, RuntimeValue } from "../../../convex/lib/runtimeValues";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}
interface Tables {
  [table: string]: Row[];
}

function makeCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  );
  const deletedStorageIds: string[] = [];
  const takeCalls: Array<{ count: number; tableName: string }> = [];
  let insertedId = 0;
  let maxRunningTravellerWorkers = 0;
  const recordWorkerConcurrency = () => {
    maxRunningTravellerWorkers = Math.max(
      maxRunningTravellerWorkers,
      (tables.jobCardDeletionWorkers ?? []).filter(
        (worker) => worker.kind === "traveller" && worker.status === "running"
      ).length
    );
  };

  const ctx = {
    db: {
      delete: (tableOrId: string, maybeId?: string) => {
        const id = maybeId ?? tableOrId;
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
        }
      },
      get: (tableOrId: string, maybeId?: string) => {
        const id = maybeId ?? tableOrId;
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: (tableName: string, value: RuntimeObject) => {
        insertedId += 1;
        const id = `${tableName}_${insertedId}`;
        tables[tableName] = [...(tables[tableName] ?? []), { _id: id, ...value }];
        recordWorkerConcurrency();
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: (tableOrId: string, idOrValue: RuntimeObject | string, maybeValue?: RuntimeObject) => {
        // SAFETY: This test controls the asserted value at the framework boundary below.
        const id = maybeValue ? fromAny<string, unknown>(idOrValue) : tableOrId;
        // SAFETY: This test controls the asserted value at the framework boundary below.
        const value = maybeValue ?? fromAny<RuntimeObject, unknown>(idOrValue);
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.map((row) => (row._id === id ? { ...row, ...value } : row));
        }
        recordWorkerConcurrency();
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
          take: (count: number) => {
            takeCalls.push({ count, tableName });
            return rows.slice(0, count);
          },
          unique: async () => rows[0] ?? null,
          withIndex(
            _indexName: string,
            callback: (query: { eq: (field: string, value: RuntimeValue) => object }) => object
          ) {
            const filters: { field: string; value: RuntimeValue }[] = [];
            const q = {
              eq(field: string, value: RuntimeValue) {
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
    runMutation: async (
      _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
      _args: RuntimeObject
    ) => undefined,
    scheduler: {
      runAfter: async (
        _delay: number,
        _functionReference: FunctionReference<
          "query" | "mutation" | "action",
          "public" | "internal"
        >,
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
          // SAFETY: This test controls the asserted value at the framework boundary below.
          await fromAny<any, unknown>(continueJobCardCascade)._handler(ctx, args);
          return;
        }
        if (args.travellerId && args.stage && args.mode) {
          // SAFETY: This test controls the asserted value at the framework boundary below.
          await fromAny<any, unknown>(continueTravellerCleanup)._handler(ctx, args);
          return;
        }
        if (args.approvalEntityId && args.approvalEntityType) {
          // SAFETY: This test controls the asserted value at the framework boundary below.
          await fromAny<any, unknown>(continueApprovalCleanup)._handler(ctx, args);
          return;
        }
        if (args.operationId && !args.entityId && !args.identities) {
          // SAFETY: This test controls the asserted value at the framework boundary below.
          await fromAny<any, unknown>(continueTravellerWorkerQueue)._handler(ctx, args);
          return;
        }
        const identities =
          args.identities ??
          (args.entityId && args.entityType
            ? [{ entityId: args.entityId, entityType: args.entityType }]
            : []);
        await Promise.all(
          identities.map((identity) =>
            // SAFETY: This test controls the asserted value at the framework boundary below.
            deleteNotificationPage(
              fromAny<never, unknown>(ctx),
              identity.entityType,
              identity.entityId
            )
          )
        );
      },
    },
    storage: {
      delete: (storageId: string) => {
        deletedStorageIds.push(storageId);
      },
    },
  };

  return {
    ctx,
    deletedStorageIds,
    getMaxRunningTravellerWorkers: () => maxRunningTravellerWorkers,
    tables,
    takeCalls,
  };
}

describe("DeleteJobCardCascade", () => {
  test("fails before operation creation while canonical file custody remains", async () => {
    const jobCardId = "job_with_file";
    const { ctx, tables } = makeCtx({
      commercialFiles: [
        {
          _id: "commercial_file_1",
          sourceId: jobCardId,
          sourceType: "jobCard",
        },
      ],
      jobCards: [{ _id: jobCardId }],
    });

    await expect(
      deleteJobCardCascade(fromAny<never, unknown>(ctx), fromAny<never, unknown>(jobCardId), {
        initiatedBy: "auth_accounts",
        jobCode: "JC-FILE-AA",
      })
    ).rejects.toThrow(
      "This record still owns Commercial Files. Delete them in Commercial Files, then retry after the 14-day recovery window ends."
    );
    expect(tables.jobCards).toEqual([{ _id: jobCardId }]);
    expect(tables.jobCardDeletionOperations).toBeUndefined();
  });

  test("Removes all job-card descendants, linked expense approvals, and stored files", async () => {
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

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await deleteJobCardCascade(fromAny<never, unknown>(ctx), fromAny<never, unknown>(jobCardId), {
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

  test("Deletes an empty job card without touching activity log history", async () => {
    const jobCardId = "job_empty";
    const activityLogs = [
      { _id: "activity_job", entityId: jobCardId, entityType: "jobCard" },
      { _id: "activity_other", entityId: "query_1", entityType: "query" },
    ];
    const { ctx, tables } = makeCtx({
      activityLogs: [...activityLogs],
      jobCards: [{ _id: jobCardId }],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await deleteJobCardCascade(fromAny<never, unknown>(ctx), fromAny<never, unknown>(jobCardId), {
      initiatedBy: "auth_accounts",
      jobCode: "JC-0002-AA",
    });

    expect(tables.jobCards).toEqual([]);
    expect(tables.activityLogs).toEqual(activityLogs);
  });

  test("Continues a large child cascade in fixed-size worker pages", async () => {
    const jobCardId = "job_large";
    const { ctx, tables, takeCalls } = makeCtx({
      jobCards: [{ _id: jobCardId }],
      notifications: [],
      tickets: Array.from({ length: 65 }, (_, index) => ({
        _id: `ticket_${index}`,
        jobCardId,
      })),
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const operationId = await deleteJobCardCascade(
      fromAny<never, unknown>(ctx),
      fromAny<never, unknown>(jobCardId),
      {
        initiatedBy: "auth_accounts",
        jobCode: "JC-0003-AA",
      }
    );

    expect(tables.tickets).toEqual([]);
    const ticketPages = takeCalls.filter((call) => call.tableName === "tickets");
    expect(ticketPages).toHaveLength(3);
    expect(ticketPages.every((call) => call.count === 32)).toBe(true);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await fromAny<any, unknown>(continueJobCardCascade)._handler(ctx, {
      jobCardId,
      operationId,
      stage: "travellers",
    });
    expect(tables.jobCardDeletionOperations[0]).toEqual(
      expect.objectContaining({ deletedCount: 65, status: "complete" })
    );
  });

  test("Finishes more than 100 traveller workers without orphaned private descendants", async () => {
    const jobCardId = "job_many_travellers";
    const travellers = Array.from({ length: 105 }, (_, index) => ({
      _id: `traveller_${index}`,
      jobCardId,
    }));
    const { ctx, tables, deletedStorageIds, getMaxRunningTravellerWorkers } = makeCtx({
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

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await deleteJobCardCascade(fromAny<never, unknown>(ctx), fromAny<never, unknown>(jobCardId), {
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
    expect(getMaxRunningTravellerWorkers()).toBeLessThanOrEqual(1);
    expect(tables.jobCardDeletionOperations[0]).toEqual(
      expect.objectContaining({ deletedCount: 105, stage: "complete", status: "complete" })
    );
  });
});
