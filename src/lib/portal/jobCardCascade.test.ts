import { describe, expect, test } from "bun:test";
import { deleteJobCardCascade } from "../../../convex/crm/lib";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;
  const deletedStorageIds: string[] = [];

  const ctx = {
    db: {
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
          collect: async () => [...rows],
        };
      },
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) return row;
        }
        return null;
      },
      delete: async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
        }
      },
    },
    storage: {
      delete: async (storageId: string) => {
        deletedStorageIds.push(storageId);
      },
    },
  };

  return { ctx, tables, deletedStorageIds };
}

describe("deleteJobCardCascade", () => {
  test("removes all job-card descendants, linked expense approvals, and stored files", async () => {
    const jobCardId = "job_1";
    const { ctx, tables, deletedStorageIds } = makeCtx({
      jobCards: [{ _id: jobCardId }],
      travellers: [{ _id: "traveller_1", jobCardId }],
      passportDetails: [
        {
          _id: "passport_1",
          travellerId: "traveller_1",
          storageId: "passport_storage_1",
        },
      ],
      mealPreferences: [{ _id: "meal_1", travellerId: "traveller_1" }],
      flightGroups: [{ _id: "flight_group_1", jobCardId }],
      flightSegments: [{ _id: "flight_segment_1", jobCardId, flightGroupId: "flight_group_1" }],
      visaRecords: [{ _id: "visa_1", jobCardId, travellerId: "traveller_1" }],
      pnrs: [{ _id: "pnr_1", jobCardId }],
      tickets: [{ _id: "ticket_1", jobCardId, travellerId: "traveller_1" }],
      seatAllocations: [{ _id: "seat_1", jobCardId, travellerId: "traveller_1" }],
      hotels: [{ _id: "hotel_1", jobCardId }],
      roomingListEntries: [{ _id: "room_1", jobCardId, travellerId: "traveller_1" }],
      tourManagerAssignments: [{ _id: "tour_manager_1", jobCardId }],
      vendors: [{ _id: "vendor_1", jobCardId }],
      itineraries: [{ _id: "itinerary_1", jobCardId }],
      eventFlows: [{ _id: "event_flow_1", jobCardId }],
      checklistTasks: [{ _id: "checklist_1", jobCardId }],
      invoices: [{ _id: "invoice_1", jobCardId }],
      additionalServices: [{ _id: "service_1", jobCardId }],
      attachments: [
        {
          _id: "expense_attachment_1",
          entityType: "expense",
          entityId: "expense_1",
          storageId: "expense_storage_1",
        },
      ],
      expenseEntries: [{ _id: "expense_1", jobCardId, proofAttachmentId: "expense_attachment_1" }],
      approvalRequests: [{ _id: "approval_1", entityType: "expense", entityId: "expense_1" }],
      notifications: [
        { _id: "notification_job", entityType: "jobCard", entityId: jobCardId },
        { _id: "notification_traveller", entityType: "traveller", entityId: "traveller_1" },
        { _id: "notification_expense", entityType: "expense", entityId: "expense_1" },
      ],
      activityLogs: [{ _id: "activity_1", entityType: "jobCard", entityId: jobCardId }],
    });

    await deleteJobCardCascade(ctx as never, jobCardId as never);

    expect(tables.flightSegments).toEqual([]);
    expect(tables.approvalRequests).toEqual([]);
    expect(tables.notifications).toEqual([]);
    expect(tables.activityLogs).toHaveLength(1);
    expect(deletedStorageIds).toEqual(["passport_storage_1", "expense_storage_1"]);

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
      { _id: "activity_job", entityType: "jobCard", entityId: jobCardId },
      { _id: "activity_other", entityType: "query", entityId: "query_1" },
    ];
    const { ctx, tables } = makeCtx({
      jobCards: [{ _id: jobCardId }],
      activityLogs: [...activityLogs],
    });

    await deleteJobCardCascade(ctx as never, jobCardId as never);

    expect(tables.jobCards).toEqual([]);
    expect(tables.activityLogs).toEqual(activityLogs);
  });
});
