import { describe, expect, test } from "bun:test";
import { markSent, sendToSales } from "./proposals";

interface Row {
  _id: string;
  [key: string]: any;
}
type Tables = Record<string, Row[]>;

function makeProposalHandoffCtx() {
  const tables: Tables = {
    activityLogs: [],
    notifications: [],
    proposalQueryLinks: [],
    proposals: [
      {
        _id: "proposals_1",
        clientName: "Acme Ltd",
        costPrice: 0,
        createdAt: 120,
        createdBy: "auth_contracting",
        preparedBy: "Contracting SPOC",
        proposalCode: "P-0001",
        queryId: "queries_1",
        sellingPrice: 100_000,
        status: "Draft",
        updatedAt: 130,
      },
      {
        _id: "proposals_2",
        clientName: "Beta Ltd",
        costPrice: 70_000,
        createdAt: 140,
        createdBy: "auth_contracting",
        preparedBy: "Contracting SPOC",
        proposalCode: "P-0002",
        queryId: "queries_1",
        sellingPrice: 100_000,
        status: "Draft",
        updatedAt: 150,
      },
    ],
    queries: [
      {
        _id: "queries_1",
        clientName: "Acme Ltd",
        contractingOwnerId: "staff_contracting",
        contractingOwnerName: "Contracting SPOC",
        createdAt: 100,
        createdBy: "auth_sales",
        paxCount: 24,
        queryCode: "Q-0001",
        queryType: "MICE",
        salesOwnerId: "staff_sales",
        salesOwnerName: "Sales Owner",
        salesStatus: "Proposal in discussion",
        updatedAt: 100,
      },
    ],
    staffUsers: [
      {
        _id: "staff_contracting",
        active: true,
        authUserId: "auth_contracting",
        email: "contracting@citius.in",
        emailNormalized: "contracting@citius.in",
        name: "Contracting SPOC",
        roles: ["Contracting"],
      },
      {
        _id: "staff_sales",
        active: true,
        authUserId: "auth_sales",
        email: "sales@citius.in",
        emailNormalized: "sales@citius.in",
        name: "Sales Owner",
        roles: ["Sales"],
      },
    ],
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
        email: "contracting@citius.in",
        name: "Contracting SPOC",
        subject: "auth_contracting",
      }),
    },
    db: {
      get: findById,
      insert: (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
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
    scheduler: {
      runAfter: () => undefined,
    },
  };

  return { ctx, tables };
}

describe("Proposal Handoff", () => {
  test("blocks Send to Sales until Proposal Pricing Complete", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();

    await expect((sendToSales as any)._handler(ctx, { proposalId: "proposals_1" })).rejects.toThrow(
      "Enter selling price and cost price on the proposal before sending it to Sales."
    );

    expect(tables.proposals[0].status).toBe("Draft");
  });

  test("blocks Mark Sent until Proposal Pricing Complete", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();

    await expect((markSent as any)._handler(ctx, { proposalId: "proposals_1" })).rejects.toThrow(
      "Enter selling price and cost price on the proposal before marking it sent."
    );

    expect(tables.proposals[0].status).toBe("Draft");
  });

  test("allows Proposal Handoff when pricing is complete", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();

    await (sendToSales as any)._handler(ctx, { proposalId: "proposals_2" });

    expect(tables.proposals[1].status).toBe("Sent");
    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
  });
});
