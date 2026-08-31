import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { handleMoveContractingPipelineStage } from "./contractingPipelineCommands";
import { handleSendProposalToSales } from "./proposalHandoffCommands";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
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
  const tables = {
    activityLogs: [],
    commandReceipts: [],
    notifications: [],
    operationalControlStates: [
      { _id: "control_bell", key: "notifications.crm_bell", state: "default" },
      { _id: "control_email", key: "email.crm_workflow", state: "default" },
    ],
    operationalEffectReceipts: [],
    proposalQueryHandoffs: [],
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
      proposalRevision: 1,
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
  } satisfies Tables;

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
      take: async (limit: number) => rows.slice(0, limit),
      unique: async () => rows[0] ?? null,
      withIndex(_indexName: string, callback: (q: any) => RuntimeValue) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
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

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "actor@citius.in",
        name: "Workflow User",
        subject: "auth_actor",
      }),
    },
    db: {
      get: (_table: string, ...args: string[]) => findById(args.at(-1) ?? ""),
      insert: (table: string, document: RuntimeObject) => {
        const id = `${table}_${rowsFor(table).length + 1}`;
        tables[table] = [...rowsFor(table), { _id: id, ...document }];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: (_table: string, id: string, document: RuntimeObject) => {
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
  commandId: "88888888-8888-4888-8888-888888888888",
  expectedContractingStatus: "Proposal in progress",
  proposalId: "proposal_1",
  proposalRevision: 1,
  queryId: "query_1",
  targetStage: "Proposal sent" as const,
};

describe("Contracting Pipeline Command", () => {
  test("Dispatches the existing Send to Sales workflow", async () => {
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await handleMoveContractingPipelineStage(fromAny<any, unknown>(ctx), moveArgs);

    expect(result).toMatchObject({
      fromStage: "Proposal in progress",
      id: "query_1",
      proposalId: "proposal_1",
      toStage: "Proposal sent",
    });
    expect(tables.proposals[0].status).toBe("Draft");
    expect(tables.proposals[0].sentToSalesAt).toBeNumber();
    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
    expect(tables.activityLogs.map((row) => row.action)).toEqual(["sent_to_sales"]);
    expect(tables.notifications.length).toBeGreaterThan(0);
  });

  test("Uses the Query pair instead of legacy Proposal-global status", async () => {
    const { ctx, tables } = makeCtx();
    tables.proposals[0].status = "Rejected";

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await handleMoveContractingPipelineStage(fromAny<any, unknown>(ctx), moveArgs);

    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
    expect(tables.proposalQueryHandoffs).toHaveLength(1);
  });

  test("Allows the assigned Ticketing SPOC", async () => {
    const { ctx, tables } = makeCtx({ role: "Ticketing" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await handleMoveContractingPipelineStage(fromAny<any, unknown>(ctx), moveArgs);
    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
  });

  test("Rejects stale source status", async () => {
    const { ctx, tables } = makeCtx();
    tables.queries[0].contractingStatus = "Proposal sent";
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(
      handleMoveContractingPipelineStage(fromAny<any, unknown>(ctx), moveArgs)
    ).rejects.toThrow("Pipeline card is out of date");
  });

  test("Rejects missing and ambiguous Proposal targets", async () => {
    const missing = makeCtx({ proposalCount: 0 });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(
      handleMoveContractingPipelineStage(fromAny<any, unknown>(missing.ctx), moveArgs)
    ).rejects.toThrow("Proposal not found");

    const ambiguous = makeCtx({ proposalCount: 2 });
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      handleMoveContractingPipelineStage(fromAny<any, unknown>(ambiguous.ctx), moveArgs)
    ).rejects.toThrow("More than one Proposal");
  });

  test("Rejects a role without Contracting handoff authority", async () => {
    const { ctx } = makeCtx({ role: "Sales" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(
      handleMoveContractingPipelineStage(fromAny<any, unknown>(ctx), moveArgs)
    ).rejects.toThrow("FORBIDDEN");
  });

  test("Enforces Cement query scope", async () => {
    const { ctx } = makeCtx({ queryType: "MICE", role: "Contracting Cement" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(
      handleMoveContractingPipelineStage(fromAny<any, unknown>(ctx), moveArgs)
    ).rejects.toThrow("FORBIDDEN");

    const allowed = makeCtx({ queryType: "Cement Bidding", role: "Contracting Cement" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await handleMoveContractingPipelineStage(fromAny<any, unknown>(allowed.ctx), moveArgs);
    expect(allowed.tables.queries[0].contractingStatus).toBe("Proposal sent");
  });

  test("Replays one command through either public adapter without duplicate effects", async () => {
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const pipelineResult = await handleMoveContractingPipelineStage(
      fromAny<any, unknown>(ctx),
      moveArgs
    );
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const directResult = await handleSendProposalToSales(fromAny<any, unknown>(ctx), {
      commandId: moveArgs.commandId,
      proposalId: moveArgs.proposalId,
      proposalRevision: moveArgs.proposalRevision,
      queryId: moveArgs.queryId,
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const pipelineReplay = await handleMoveContractingPipelineStage(
      fromAny<any, unknown>(ctx),
      moveArgs
    );

    expect(pipelineResult.proposalId).toBe(directResult.id);
    expect(pipelineReplay).toEqual(pipelineResult);
    expect(tables.commandReceipts).toHaveLength(1);
    expect(tables.proposalQueryHandoffs).toHaveLength(1);
    expect(tables.activityLogs.filter((row) => row.action === "sent_to_sales")).toHaveLength(1);
    expect(tables.notifications).toHaveLength(1);
  });
});
