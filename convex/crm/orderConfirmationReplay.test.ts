import { describe, expect, test } from "bun:test";
import { applySalesDecision } from "./queries";

interface Row {
  _id: string;
  [key: string]: any;
}

function makeOrderConfirmationCtx() {
  const tables: Record<string, Row[]> = {
    activityLogs: [],
    commandReceipts: [],
    confirmedOffers: [],
    notificationEmailDeliveries: [],
    notifications: [],
    proposalQueryHandoffs: [
      {
        _id: "proposalQueryHandoffs_1",
        airfarePerPax: 100,
        landCostPerPax: 300,
        proposalId: "proposals_1",
        proposalRevision: 1,
        queryId: "queries_1",
        sellingPrice: 500,
        taxRate: 5,
        visaCostPerPax: 25,
      },
    ],
    proposalQueryLinks: [
      {
        _id: "proposalQueryLinks_1",
        handedOffRevision: 1,
        proposalId: "proposals_1",
        queryId: "queries_1",
      },
    ],
    proposals: [
      {
        _id: "proposals_1",
        clientName: "Example Client",
        createdAt: 1,
        preparedBy: "Contracting",
        proposalCode: "P-0001",
        proposalRevision: 1,
        queryId: "queries_1",
        status: "Sent",
        taxRate: 5,
        updatedAt: 2,
      },
    ],
    queries: [
      {
        _id: "queries_1",
        clientName: "Example Client",
        contractingStatus: "Proposal sent",
        createdAt: 1,
        destination: "Baku",
        leadStage: "Negotiation",
        paxCount: 2,
        queryCode: "Q-0001",
        queryType: "MICE",
        salesOwnerId: "staff_sales",
        salesOwnerName: "Sales Owner",
        salesStatus: "Under Discussion",
        ticketingScope: "Both",
        travelEndDate: "2026-10-08",
        travelStartDate: "2026-10-02",
        travelType: "International",
        updatedAt: 2,
      },
    ],
    staffUsers: [
      {
        _id: "staff_sales",
        active: true,
        authUserId: "auth_sales",
        email: "sales@example.com",
        emailNormalized: "sales@example.com",
        name: "Sales Owner",
        roles: ["Sales"],
      },
      {
        _id: "staff_other_sales",
        active: true,
        authUserId: "auth_other_sales",
        email: "other-sales@example.com",
        emailNormalized: "other-sales@example.com",
        name: "Other Sales User",
        roles: ["Sales"],
      },
    ],
  };
  let identity = {
    email: "sales@example.com",
    name: "Sales Owner",
    subject: "auth_sales",
  };
  const getRows = (table: string) => tables[table] ?? [];
  const findById = (id: string) => {
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
      order: () => builder,
      take: async (limit: number) => rows.slice(0, limit),
      unique: async () => rows[0] ?? null,
      withIndex(_name: string, callback: (q: any) => unknown) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: unknown) {
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
  const ctx = {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      get: (_tableOrId: string, maybeId?: string) => findById(maybeId ?? _tableOrId),
      insert: (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        tables[table] = [...getRows(table), { _id: id, ...doc }];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: (id: string, patch: Record<string, unknown>) => {
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
    scheduler: { runAfter: () => undefined },
  };
  return {
    ctx,
    setIdentity: (nextIdentity: typeof identity) => {
      identity = nextIdentity;
    },
    tables,
  };
}

const CONFIRM_ARGS = {
  commandId: "66666666-6666-4666-8666-666666666666",
  confirmedPax: 2,
  proposalId: "proposals_1",
  proposalRevision: 1,
  queryId: "queries_1",
  salesStatus: "Order Confirmed",
  travelEndDate: "2026-10-08",
  travelStartDate: "2026-10-02",
};

describe("Order Confirmed replay", () => {
  test("returns the original result without duplicating the Confirmed Offer", async () => {
    const { ctx, tables } = makeOrderConfirmationCtx();

    const first = await (applySalesDecision as any)._handler(ctx, CONFIRM_ARGS);
    const replay = await (applySalesDecision as any)._handler(ctx, CONFIRM_ARGS);

    expect(replay).toEqual(first);
    expect(tables.confirmedOffers).toHaveLength(1);
    expect(tables.commandReceipts).toHaveLength(1);
    expect(tables.activityLogs.filter((entry) => entry.action === "confirmed")).toHaveLength(1);
  });

  test("rejects a conflicting confirmation payload for the same command ID", async () => {
    const { ctx } = makeOrderConfirmationCtx();
    await (applySalesDecision as any)._handler(ctx, CONFIRM_ARGS);

    await expect(
      (applySalesDecision as any)._handler(ctx, { ...CONFIRM_ARGS, confirmedPax: 3 })
    ).rejects.toThrow("Command ID was already used with different input");
  });

  test("rejects caller-supplied prices and stale Proposal revisions before any write", async () => {
    const { ctx, tables } = makeOrderConfirmationCtx();

    await expect(
      (applySalesDecision as any)._handler(ctx, {
        ...CONFIRM_ARGS,
        sellingPricePerPax: 1,
      })
    ).rejects.toThrow("Sales Decision does not accept sellingPricePerPax");
    await expect(
      (applySalesDecision as any)._handler(ctx, { ...CONFIRM_ARGS, proposalRevision: 2 })
    ).rejects.toThrow("not the current revision handed to Sales");
    expect(tables.confirmedOffers).toHaveLength(0);
    expect(tables.commandReceipts).toHaveLength(0);
  });

  test("rechecks current Query access before returning an identical replay", async () => {
    const { ctx, setIdentity, tables } = makeOrderConfirmationCtx();
    await (applySalesDecision as any)._handler(ctx, CONFIRM_ARGS);
    setIdentity({
      email: "other-sales@example.com",
      name: "Other Sales User",
      subject: "auth_other_sales",
    });

    await expect((applySalesDecision as any)._handler(ctx, CONFIRM_ARGS)).rejects.toThrow(
      "FORBIDDEN"
    );
    expect(tables.confirmedOffers).toHaveLength(1);
  });
});
