import { describe, expect, test } from "bun:test";
import { create, markSent, sendToSales, update } from "./proposals";

interface Row {
  _id: string;
  [key: string]: any;
}
type Tables = Record<string, Row[]>;

function makeProposalHandoffCtx() {
  const tables: Tables = {
    activityLogs: [],
    commandReceipts: [],
    notifications: [],
    proposalQueryHandoffs: [],
    proposalQueryLinks: [
      {
        _id: "proposalQueryLinks_1",
        createdAt: 120,
        createdBy: "auth_contracting",
        proposalId: "proposals_1",
        queryId: "queries_1",
      },
      {
        _id: "proposalQueryLinks_2",
        createdAt: 140,
        createdBy: "auth_contracting",
        proposalId: "proposals_2",
        queryId: "queries_1",
      },
    ],
    proposals: [
      {
        _id: "proposals_1",
        clientName: "Acme Ltd",
        costPrice: 0,
        createdAt: 120,
        createdBy: "auth_contracting",
        preparedBy: "Contracting SPOC",
        proposalCode: "P-0001",
        proposalRevision: 1,
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
        proposalRevision: 1,
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
        contractingStatus: "Query Received",
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
      {
        _id: "staff_other_contracting",
        active: true,
        authUserId: "auth_other_contracting",
        email: "other-contracting@citius.in",
        emailNormalized: "other-contracting@citius.in",
        name: "Other Contracting SPOC",
        roles: ["Contracting"],
      },
    ],
  };
  let identity = {
    email: "contracting@citius.in",
    name: "Contracting SPOC",
    subject: "auth_contracting",
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
      take: async (limit: number) => rows.slice(0, limit),
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
      getUserIdentity: async () => identity,
    },
    db: {
      get: (_table: string, ...args: string[]) => findById(args.at(-1) ?? ""),
      insert: (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: (_table: string, id: string, patch: Record<string, unknown>) => {
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

  return {
    ctx,
    setIdentity: (nextIdentity: typeof identity) => {
      identity = nextIdentity;
    },
    tables,
  };
}

describe("Proposal Handoff", () => {
  test("proposal creation advances Query Received to Proposal in progress", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();

    await (create as any)._handler(ctx, { queryId: "queries_1" });

    expect(tables.queries[0].contractingStatus).toBe("Proposal in progress");
    expect(tables.proposals.at(-1)?.status).toBe("Draft");
  });

  test("proposal creation does not overwrite a Sales Decision outcome", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();
    tables.queries[0].contractingStatus = "Order Confirmed";
    tables.queries[0].salesStatus = "Order Confirmed";

    await (create as any)._handler(ctx, { queryId: "queries_1" });

    expect(tables.queries[0].contractingStatus).toBe("Order Confirmed");
  });

  test("blocks Send to Sales until Proposal Pricing Complete", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();

    await expect(
      (sendToSales as any)._handler(ctx, {
        commandId: "11111111-1111-4111-8111-111111111111",
        proposalId: "proposals_1",
        proposalRevision: 1,
        queryId: "queries_1",
      })
    ).rejects.toThrow(
      "Enter selling price and cost price on the proposal before sending it to Sales."
    );

    expect(tables.proposals[0].status).toBe("Draft");
  });

  test("removes the legacy Mark client sent transition", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();

    await expect((markSent as any)._handler(ctx, { proposalId: "proposals_1" })).rejects.toThrow(
      "Mark client sent is no longer available. Use Send to Sales."
    );

    expect(tables.proposals[0].status).toBe("Draft");
  });

  test("allows Proposal Handoff when pricing is complete", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();

    await (sendToSales as any)._handler(ctx, {
      commandId: "22222222-2222-4222-8222-222222222222",
      proposalId: "proposals_2",
      proposalRevision: 1,
      queryId: "queries_1",
    });

    expect(tables.proposals[1].status).toBe("Sent");
    expect(tables.proposals[1].sentToSalesAt).toBeNumber();
    expect(tables.proposals[1].sentAt).toBeUndefined();
    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
    expect(tables.proposalQueryHandoffs).toEqual([
      expect.objectContaining({
        commandId: "22222222-2222-4222-8222-222222222222",
        proposalId: "proposals_2",
        proposalRevision: 1,
        queryId: "queries_1",
        sellingPrice: 100_000,
      }),
    ]);
    expect(tables.proposalQueryLinks[1]).toMatchObject({
      handedOffRevision: 1,
    });
  });

  test("keeps Send to Sales as the only proposal handoff transition", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();
    await (sendToSales as any)._handler(ctx, {
      commandId: "33333333-3333-4333-8333-333333333333",
      proposalId: "proposals_2",
      proposalRevision: 1,
      queryId: "queries_1",
    });

    expect(tables.proposals[1].sentToSalesAt).toBeNumber();
    expect(tables.proposals[1].sentToClientAt).toBeUndefined();
    expect(tables.proposals[1].sentAt).toBeUndefined();
  });

  test("editing a sent Proposal creates a fresh Draft revision", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();
    tables.proposals[1].sentToSalesAt = 160;
    tables.proposals[1].status = "Sent";

    await (update as any)._handler(ctx, {
      proposalId: "proposals_2",
      sellingPrice: 110_000,
    });

    expect(tables.proposals[1]).toMatchObject({
      proposalRevision: 2,
      sellingPrice: 110_000,
      status: "Draft",
    });
    expect(tables.proposals[1].sentToSalesAt).toBeUndefined();
  });

  test("replays an identical Proposal Handoff without duplicate effects", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();
    const args = {
      commandId: "44444444-4444-4444-8444-444444444444",
      proposalId: "proposals_2",
      proposalRevision: 1,
      queryId: "queries_1",
    };

    const first = await (sendToSales as any)._handler(ctx, args);
    const replay = await (sendToSales as any)._handler(ctx, args);

    expect(replay).toEqual(first);
    expect(tables.commandReceipts).toHaveLength(1);
    expect(tables.proposalQueryHandoffs).toHaveLength(1);
    expect(tables.activityLogs.filter((entry) => entry.action === "sent_to_sales")).toHaveLength(1);
    expect(tables.notifications).toHaveLength(1);
    expect(tables.proposals[1].status).toBe("Sent");
  });

  test("rejects conflicting Proposal Handoff command reuse", async () => {
    const { ctx } = makeProposalHandoffCtx();
    const commandId = "55555555-5555-4555-8555-555555555555";

    await (sendToSales as any)._handler(ctx, {
      commandId,
      proposalId: "proposals_2",
      proposalRevision: 1,
      queryId: "queries_1",
    });

    await expect(
      (sendToSales as any)._handler(ctx, {
        commandId,
        proposalId: "proposals_1",
        proposalRevision: 1,
        queryId: "queries_1",
      })
    ).rejects.toThrow("Command ID was already used with different input");
  });

  test("rejects a different command for an already handed pair and revision", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();
    const target = {
      proposalId: "proposals_2",
      proposalRevision: 1,
      queryId: "queries_1",
    };
    await (sendToSales as any)._handler(ctx, {
      ...target,
      commandId: "99999999-9999-4999-8999-999999999991",
    });

    await expect(
      (sendToSales as any)._handler(ctx, {
        ...target,
        commandId: "99999999-9999-4999-8999-999999999992",
      })
    ).rejects.toThrow("already handed to Sales");
    expect(tables.proposalQueryHandoffs).toHaveLength(1);
  });

  test("rejects a stale Proposal revision before creating effects", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();
    tables.proposals[1].proposalRevision = 2;

    await expect(
      (sendToSales as any)._handler(ctx, {
        commandId: "99999999-9999-4999-8999-999999999993",
        proposalId: "proposals_2",
        proposalRevision: 1,
        queryId: "queries_1",
      })
    ).rejects.toThrow("Proposal revision is out of date");
    expect(tables.proposalQueryHandoffs).toHaveLength(0);
    expect(tables.activityLogs).toHaveLength(0);
    expect(tables.notifications).toHaveLength(0);
  });

  test("hands off only the selected Query when a Proposal has multiple links", async () => {
    const { ctx, tables } = makeProposalHandoffCtx();
    tables.queries.push({
      ...tables.queries[0],
      _id: "queries_2",
      contractingStatus: "Proposal in progress",
      queryCode: "Q-0002",
    });
    tables.proposalQueryLinks.push({
      _id: "proposalQueryLinks_3",
      createdAt: 160,
      createdBy: "auth_contracting",
      proposalId: "proposals_2",
      queryId: "queries_2",
    });

    await (sendToSales as any)._handler(ctx, {
      commandId: "99999999-9999-4999-8999-999999999994",
      proposalId: "proposals_2",
      proposalRevision: 1,
      queryId: "queries_1",
    });

    expect(tables.queries[0].contractingStatus).toBe("Proposal sent");
    expect(tables.queries[1].contractingStatus).toBe("Proposal in progress");
    expect(tables.proposalQueryLinks[1].handedOffRevision).toBe(1);
    expect(tables.proposalQueryLinks[2].handedOffRevision).toBeUndefined();
    expect(tables.proposalQueryHandoffs.map((row) => row.queryId)).toEqual(["queries_1"]);
  });

  test("rechecks current record access before returning an identical replay", async () => {
    const { ctx, setIdentity, tables } = makeProposalHandoffCtx();
    const args = {
      commandId: "77777777-7777-4777-8777-777777777777",
      proposalId: "proposals_2",
      proposalRevision: 1,
      queryId: "queries_1",
    };
    await (sendToSales as any)._handler(ctx, args);
    setIdentity({
      email: "other-contracting@citius.in",
      name: "Other Contracting SPOC",
      subject: "auth_other_contracting",
    });

    await expect((sendToSales as any)._handler(ctx, args)).rejects.toThrow("FORBIDDEN");
    expect(tables.activityLogs.filter((entry) => entry.action === "sent_to_sales")).toHaveLength(1);
  });
});
