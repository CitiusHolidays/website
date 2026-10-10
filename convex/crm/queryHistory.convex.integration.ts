import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

test("Sales can archive an Order Lost decision without losing its detail or Lead Stage-only Lost enquiries", async () => {
  const t = convexTest({ modules, schema });
  const actor = "https://auth.citius.test|sales_history";
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: actor,
      createdAt: 100,
      email: "sales-history@citius.test",
      emailNormalized: "sales-history@citius.test",
      name: "History Sales",
      roles: ["Sales"],
      updatedAt: 100,
    });
    const seed = {
      clientName: "Acme",
      contractingStatus: "Proposal sent" as const,
      createdAt: 100,
      createdBy: actor,
      paxCount: 10,
      queryType: "MICE" as const,
      salesStatus: "Proposal in discussion" as const,
      travelType: "Domestic Travel" as const,
      updatedAt: 100,
    };
    const active = await ctx.db.insert("queries", {
      ...seed,
      leadStage: "Proposal",
      queryCode: "Q-active",
    });
    const stageOnly = await ctx.db.insert("queries", {
      ...seed,
      leadStage: "Lost",
      queryCode: "Q-stage-only",
    });
    await ctx.db.insert("queries", {
      ...seed,
      contractingStatus: "Order Lost",
      createdBy: "https://auth.citius.test|other_sales",
      queryCode: "Q-other-owner",
      salesStatus: "Order Lost",
    });
    return { active, stageOnly };
  });
  const sales = t.withIdentity({
    issuer: "https://auth.citius.test",
    subject: "sales_history",
    tokenIdentifier: actor,
  });
  await sales.mutation(api.crm.queries.applySalesDecision, {
    lostReason: "Competition",
    queryId: ids.active,
    salesStatus: "Order Lost",
  });
  const active = await sales.query(api.crm.queries.listPage, {
    historyScope: "active",
    paginationOpts: { cursor: null, numItems: 25 },
  });
  const archive = await sales.query(api.crm.queries.listPage, {
    historyScope: "lost",
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(active.page.map((row) => row.queryCode)).toEqual(["Q-stage-only"]);
  expect(archive.page.map((row) => row.queryCode)).toEqual(["Q-active"]);
  expect(await sales.query(api.crm.queries.getDetail, { queryId: ids.active })).toMatchObject({
    lostReason: "Competition",
    queryCode: "Q-active",
    salesStatus: "Order Lost",
  });
  await expect(
    sales.mutation(api.crm.queries.applySalesDecision, {
      queryId: ids.active,
      salesStatus: "Proposal in discussion",
    })
  ).rejects.toThrow("Order Lost is final");
});

test("Archive search and cursor filters retain only matching authorized lost queries", async () => {
  const t = convexTest({ modules, schema });
  const actor = "https://auth.citius.test|cement_history";
  await t.run(async (ctx) => {
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: actor,
      createdAt: 100,
      email: "cement-history@citius.test",
      emailNormalized: "cement-history@citius.test",
      name: "Cement History",
      roles: ["Sales Cement"],
      updatedAt: 100,
    });
    await ctx.db.insert("crmListSearchReadiness", {
      ready: true,
      table: "queries",
      updatedAt: 100,
      version: 2,
    });
    const seed = {
      clientName: "Acme",
      contractingStatus: "Order Lost" as const,
      createdBy: actor,
      listSearchText: "acme",
      paxCount: 10,
      queryType: "Cement" as const,
      salesStatus: "Order Lost" as const,
      travelType: "Domestic Travel" as const,
      updatedAt: 100,
    };
    await ctx.db.insert("queries", { ...seed, createdAt: 110, queryCode: "Q-lost-1" });
    await ctx.db.insert("queries", {
      ...seed,
      contractingStatus: "Proposal sent",
      createdAt: 120,
      queryCode: "Q-lost-2",
    });
    await ctx.db.insert("queries", {
      ...seed,
      createdAt: 124,
      createdBy: "https://auth.citius.test|another_cement_sales",
      queryCode: "Q-foreign-lost",
    });
    await ctx.db.insert("queries", {
      ...seed,
      contractingStatus: "Proposal sent",
      createdAt: 122,
      queryCode: "Q-interleaved-active",
      salesStatus: "Proposal in discussion",
    });
    await ctx.db.insert("queries", {
      ...seed,
      contractingStatus: "Proposal sent",
      createdAt: 130,
      queryCode: "Q-active",
      salesStatus: "Proposal in discussion",
    });
    await ctx.db.insert("queries", { ...seed, createdAt: 90, queryCode: "Q-outside-date" });
    await ctx.db.insert("queries", {
      ...seed,
      createdAt: 140,
      queryCode: "Q-other-type",
      queryType: "MICE",
    });
    await ctx.db.insert("queries", {
      ...seed,
      createdAt: 150,
      listSearchText: "unrelated",
      queryCode: "Q-other-search",
    });
  });
  const sales = t.withIdentity({
    issuer: "https://auth.citius.test",
    subject: "cement_history",
    tokenIdentifier: actor,
  });
  const filters = {
    contractingStatus: "Order Lost" as const,
    createdAtFrom: 100,
    createdAtTo: 125,
    historyScope: "lost" as const,
    queryType: "Cement" as const,
    search: "acme",
  };
  const collect = async (search?: string) => {
    const codes: string[] = [];
    const ids: string[] = [];
    const cursors: string[] = [];
    const advance = async (cursor: string | null, remaining: number): Promise<void> => {
      expect(remaining).toBeGreaterThan(0);
      const page = await sales.query(api.crm.queries.listPage, {
        ...filters,
        paginationOpts: { cursor, numItems: 1 },
        search,
      });
      codes.push(...page.page.map((row) => row.queryCode));
      ids.push(...page.page.map((row) => row.id));
      if (!page.isDone) {
        expect(page.continueCursor).not.toBe(cursor);
        expect(cursors).not.toContain(page.continueCursor);
        cursors.push(page.continueCursor);
        await advance(page.continueCursor, remaining - 1);
      }
    };
    await advance(null, 20);
    expect(new Set(ids).size).toBe(ids.length);
    return { codes };
  };
  const indexed = await collect();
  expect(indexed.codes).toEqual(["Q-lost-2", "Q-lost-1"]);
  const searched = await collect("acme");
  expect(searched.codes.sort((a, b) => a.localeCompare(b))).toEqual(["Q-lost-1", "Q-lost-2"]);
  const activeSearch = await sales.query(api.crm.queries.listPage, {
    ...filters,
    contractingStatus: "Proposal sent",
    createdAtTo: 135,
    historyScope: "active",
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(activeSearch.page.map((row) => row.queryCode).sort((a, b) => a.localeCompare(b))).toEqual([
    "Q-active",
    "Q-interleaved-active",
  ]);
  const scoped = await sales.query(api.crm.queries.listPage, {
    historyScope: "lost",
    paginationOpts: { cursor: null, numItems: 25 },
    search: "acme",
  });
  expect(scoped.page.map((row) => row.queryCode).sort((a, b) => a.localeCompare(b))).toEqual([
    "Q-lost-1",
    "Q-lost-2",
    "Q-outside-date",
  ]);
  await expect(
    t.query(api.crm.queries.listPage, {
      historyScope: "lost",
      paginationOpts: { cursor: null, numItems: 25 },
    })
  ).rejects.toThrow("FORBIDDEN");
});
