import { describe, expect, test } from "bun:test";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import { updateTicket, updateTicketStatus } from "./ticketing";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

function makeCtx() {
  const tables = {
    activityLogs: [],
    jobCards: [{ _id: "job_1", jobCode: "JC-0001-NS" }],
    notifications: [],
    notificationTargetCounts: [],
    operationalControlStates: [
      { _id: "control_bell", key: "notifications.crm_bell", state: "default" },
      { _id: "control_email", key: "email.crm_workflow", state: "default" },
    ],
    operationalEffectReceipts: [],
    pnrs: [
      { _id: "pnr_1", issuedSeats: 0, jobCardId: "job_1" },
      { _id: "pnr_2", issuedSeats: 0, jobCardId: "job_1" },
    ],
    staffUsers: [
      {
        _id: "staff_1",
        active: true,
        authUserId: "auth_1",
        email: "admin@example.com",
        name: "Admin",
        roles: ["Admin"],
      },
    ],
    tickets: [
      {
        _id: "ticket_1",
        jobCardId: "job_1",
        pnrId: "pnr_1",
        ticketNumber: "TKT-1",
        ticketStatus: "Pending Issue",
        travellerId: "traveller_1",
      },
    ],
    travellers: [{ _id: "traveller_1", jobCardId: "job_1", ticketStatus: "Pending Issue" }],
  } satisfies Record<string, Row[]>;
  const find = (id: string) =>
    Object.values(tables)
      .flat()
      .find((row) => row._id === id) ?? null;
  const query = (table: string) => {
    let rows = tables[table] ?? [];
    const builder = {
      collect: async () => rows,
      take: async (limit: number) => rows.slice(0, limit),
      unique: async () => rows[0] ?? null,
      withIndex: (_name: string, callback: (q: TestIndexQuery) => TestIndexQuery) => {
        const filters: Array<{ field: string; value: RuntimeValue }> = [];
        const q: TestIndexQuery = {
          eq(field: string, value: RuntimeValue) {
            filters.push({ field, value });
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => filters.every(({ field, value }) => row[field] === value));
        return builder;
      },
    };
    return builder;
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () => ({ email: "admin@example.com", subject: "auth_1" }),
      },
      db: {
        get: async (_table: string, id: string) => find(id),
        insert: (table: string, value: RuntimeObject) => {
          const id = `${table}_${(tables[table] ?? []).length + 1}`;
          tables[table] = [...(tables[table] ?? []), { _id: id, ...value }];
          return id;
        },
        normalizeId: (_table: string, id: string) => id,
        patch: (_table: string, id: string, value: RuntimeObject) => {
          for (const [table, rows] of Object.entries(tables)) {
            const index = rows.findIndex((row) => row._id === id);
            if (index >= 0) {
              tables[table][index] = { ...rows[index], ...value };
              return;
            }
          }
        },
        query,
      },
      scheduler: { runAfter: async () => undefined },
    },
    tables,
  };
}

describe("Authenticated ticket status mutation", () => {
  test("Applies Traveller, PNR capacity, and attention effects in the status-only path", async () => {
    const { ctx, tables } = makeCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (updateTicketStatus as any)._handler(ctx, {
      ticketId: "ticket_1",
      ticketStatus: "Issued",
    });
    expect(tables.travellers[0].ticketStatus).toBe("Issued");
    expect(tables.pnrs[0].issuedSeats).toBe(1);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (updateTicketStatus as any)._handler(ctx, {
      ticketId: "ticket_1",
      ticketStatus: "Name Change Required",
    });
    expect(tables.travellers[0].ticketStatus).toBe("Name Change Required");
    expect(tables.pnrs[0].issuedSeats).toBe(0);
    expect(tables.notifications.map((row) => row.recipientRole)).toEqual([
      "Operations",
      "Operations Head",
    ]);
  });

  test("Moves one issued seat when an issued ticket is reassigned to another PNR", async () => {
    const { ctx, tables } = makeCtx();
    tables.tickets[0].ticketStatus = "Issued";
    tables.travellers[0].ticketStatus = "Issued";
    tables.pnrs[0].issuedSeats = 1;

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (updateTicket as any)._handler(ctx, {
      pnrId: "pnr_2",
      ticketId: "ticket_1",
    });

    expect(tables.pnrs.map((pnr) => pnr.issuedSeats)).toEqual([0, 1]);
    expect(tables.tickets[0].pnrId).toBe("pnr_2");
  });
});
