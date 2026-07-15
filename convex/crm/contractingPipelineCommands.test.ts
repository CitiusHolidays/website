import { describe, expect, test } from "bun:test";
import { handleMoveContractingPipelineStage } from "./contractingPipelineCommands";

interface Row {
  _id: string;
  [key: string]: any;
}
type Tables = Record<string, Row[]>;

function makeCtx({
  proposalCount = 1,
  queryType = "MICE",
  role = "Contracting",
}: {
  proposalCount?: number;
  queryType?: string;
  role?: string;
} = {}) {
  const actorId = "staff_actor";
  const tables: Tables = {
    activityLogs: [],
    notifications: [],
    proposalQueryLinks: Array.from({ length: proposalCount }, (_, index) => ({
      _id: `link_${index + 1}`,
      createdAt: 100,
      createdBy: "auth_actor",
      proposalId: `proposal_${index + 1}`,
      queryId: "query_1",
    })),
    proposals: Array.from({ length: proposalCount }, (_, index) => ({
      _id: `proposal_${index + 1}`,
      clientName: "Acme Ltd",
      costPrice: 70_000,
      createdAt: 100 + index,
      createdBy: "auth_actor",
      preparedBy: "Workflow User",
      proposalCode: `P-000${index + 1}`,
      queryId: "query_1",
      sellingPrice: 100_000,
      status: "Draft",
      updatedAt: 110 + index,
    })),
    queries: [
      {
        _id: "query_1",
        clientName: "Acme Ltd",
        contractingOwnerId: role.startsWith("Contracting") ? actorId : "staff_contracting",
        contractingStatus: "Proposal in progress",
        createdAt: 90,
        createdBy: "auth_sales",
        queryCode: "Q-0001",
        queryType,
        salesOwnerId: "staff_sales",
        salesStatus: "Proposal in discussion",
        ticketingOwnerId: role === "Ticketing" ? actorId : "staff_ticketing",
        updatedAt: 95,
      },
    ],
    staffUsers: [
      {
        _id: actorId,
        active: true,
        authUserId: "auth_actor",
        email: "actor@citius.in",
        emailNormalized: "actor@citius.in",
        name: "Workflow User",
        roles: [role],
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

  const rowsFor = (table: string) => tables[table] ?? [];
  const findById = (id: string) =>
    Object.values(tables)
      .flat()
      .find((row) => row._id === id) ?? null;
  const queryBuilder = (table: string) => {
    let rows = rowsFor(table);
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
        rows = rows.filter((row) => filters.every(({ field, value }) => row[field] === value));
        return builder;
      },
    };
    return builder;
  };

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "actor@citius.in",
        name: "Workflow User",
        subject: "auth_actor",
      }),
    },
    db: {
      get: findById,
      insert: (table: string, document: Record<string, unknown>) => {
        const id = `${table}_${rowsFor(table).length + 1}`;
        tables[table] = [...rowsFor(table), { _id: id, ...document }];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: (id: string, document: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...document };
            return;
          }
        }
      },
      query: queryBuilder,
    },
    scheduler: { runAfter: async () => undefined },
  };

  return { ctx, tables };
}

const moveArgs = {
  expectedContractingStatus: "Proposal in progress",
  queryId: "query_1",
  targetStage: "Proposal sent" as const,
};

describe("Contracting Pipeline Command", () => {
  test("dispatches the existing Send to Sales workflow", async () => {
    const { ctx, tables } = makeCtx();
    const result = await handleMoveContractingPipelineStage(ctx as any, moveArgs);

    expect(result).toMatchObject({
      fromStage: "Proposal in progress",
      id: "query_1",
      proposalId: "proposal_1",
      toStage: "Proposal sent",
    });
    expect(tables.proposals[0].status).toBe("Sent");
    expect(tables.proposals[0].sentToSalesAt).toBeNumber();
    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
    expect(tables.activityLogs.map((row) => row.action)).toEqual(["sent_to_sales"]);
    expect(tables.notifications.length).toBeGreaterThan(0);
  });

  test("allows the assigned Ticketing SPOC", async () => {
    const { ctx, tables } = makeCtx({ role: "Ticketing" });
    await handleMoveContractingPipelineStage(ctx as any, moveArgs);
    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
  });

  test("rejects stale source status", async () => {
    const { ctx, tables } = makeCtx();
    tables.queries[0].contractingStatus = "Proposal sent";
    await expect(handleMoveContractingPipelineStage(ctx as any, moveArgs)).rejects.toThrow(
      "Pipeline card is out of date"
    );
  });

  test("rejects missing and ambiguous draft proposals", async () => {
    const missing = makeCtx({ proposalCount: 0 });
    await expect(handleMoveContractingPipelineStage(missing.ctx as any, moveArgs)).rejects.toThrow(
      "No draft proposal"
    );

    const ambiguous = makeCtx({ proposalCount: 2 });
    await expect(
      handleMoveContractingPipelineStage(ambiguous.ctx as any, moveArgs)
    ).rejects.toThrow("More than one draft proposal");
  });

  test("rejects a role without Contracting handoff authority", async () => {
    const { ctx } = makeCtx({ role: "Sales" });
    await expect(handleMoveContractingPipelineStage(ctx as any, moveArgs)).rejects.toThrow(
      "FORBIDDEN"
    );
  });

  test("enforces Cement query scope", async () => {
    const { ctx } = makeCtx({ queryType: "MICE", role: "Contracting Cement" });
    await expect(handleMoveContractingPipelineStage(ctx as any, moveArgs)).rejects.toThrow(
      "FORBIDDEN"
    );

    const allowed = makeCtx({ queryType: "Cement Bidding", role: "Contracting Cement" });
    await handleMoveContractingPipelineStage(allowed.ctx as any, moveArgs);
    expect(allowed.tables.queries[0].contractingStatus).toBe("Proposal sent");
  });
});
