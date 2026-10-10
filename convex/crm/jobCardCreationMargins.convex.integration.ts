import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { propertiesWhen } from "../lib/runtimeValues";
import schema from "../schema";
import { modules } from "../test.setup";

async function seedMargins(
  role: Doc<"staffUsers">["roles"][number],
  enabled = false,
  approxMargin?: number
) {
  const t = convexTest({ modules, schema });
  const actor = "https://auth.citius.test|margin_creator";
  const ids = await t.run(async (ctx) => {
    const [staffId, queryId] = await Promise.all([
      ctx.db.insert("staffUsers", {
        active: true,
        authUserId: actor,
        createdAt: 100,
        email: "margin@citius.test",
        emailNormalized: "margin@citius.test",
        jobCardCreatorEnabled: enabled,
        name: "Margin Creator",
        roles: [role],
        updatedAt: 100,
      }),
      ctx.db.insert("queries", {
        approxMargin: 99_999,
        clientName: "Acme",
        contractingStatus: "Order Confirmed",
        createdAt: 100,
        createdBy: actor,
        paxCount: 10,
        queryCode: "Q-margin",
        queryType: "MICE",
        salesStatus: "Order Confirmed",
        travelType: "Domestic Travel",
        updatedAt: 100,
      }),
      ctx.db.insert("staffUsers", {
        active: true,
        authUserId: "https://auth.citius.test|margin_observer",
        createdAt: 100,
        email: "margin-observer@citius.test",
        emailNormalized: "margin-observer@citius.test",
        name: "Margin Observer",
        roles: ["Admin"],
        updatedAt: 100,
      }),
    ]);
    const proposalId = await ctx.db.insert("proposals", {
      clientName: "Acme",
      createdAt: 100,
      createdBy: actor,
      itinerarySummary: "Goa",
      preparedBy: actor,
      proposalCode: "P-margin",
      queryId,
      sellingPrice: 80_000,
      status: "Sent",
      updatedAt: 100,
    });
    const offerId = await ctx.db.insert("confirmedOffers", {
      airfarePerPax: 20_000,
      ...propertiesWhen(approxMargin !== undefined, () => ({ approxMargin })),
      confirmedPax: 10,
      createdAt: 100,
      createdBy: actor,
      landCostPerPax: 45_000,
      profitPerPax: 12_000,
      proposalId,
      queryId,
      sellingPricePerPax: 80_000,
      travelStartDate: "2026-11-02",
      updatedAt: 100,
      visaCostPerPax: 3000,
    });
    await ctx.db.patch("queries", queryId, { confirmedOfferId: offerId });
    return { offerId, proposalId, queryId, staffId };
  });
  const caller = t.withIdentity({
    issuer: "https://auth.citius.test",
    subject: "margin_creator",
    tokenIdentifier: actor,
  });
  const observer = t.withIdentity({
    issuer: "https://auth.citius.test",
    subject: "margin_observer",
    tokenIdentifier: "https://auth.citius.test|margin_observer",
  });
  return { caller, ids, observer, t };
}

for (const [role, enabled] of [
  ["Accounts", false],
  ["Accounts Head", false],
  ["Admin", false],
  ["Directors", false],
  ["Director Cement", false],
  ["Operations Head", true],
] as const) {
  test(`${role} enabled=${enabled} can read the immutable creation margins and create its linked Job Card`, async () => {
    const { caller, ids, t } = await seedMargins(role, enabled, 25_000);
    const detail = await caller.query(api.crm.queries.getDetail, { queryId: ids.queryId });
    expect(detail?.confirmedOffer).toMatchObject({ approxMargin: 25_000, profitPerPax: 12_000 });
    expect(detail?.approxMargin).toBe(99_999);
    const created = await caller.mutation(api.crm.jobCards.createFromQuery, {
      confirmedPax: 12,
      proposalId: ids.proposalId,
      queryId: ids.queryId,
      travelStartDate: "2026-11-05",
    });
    const retrieved = await caller.query(api.crm.jobCards.getListRow, { queryId: ids.queryId });
    expect(retrieved).toMatchObject({
      confirmedPax: 12,
      id: created.id,
      jobCode: created.jobCode,
      proposalId: ids.proposalId,
      queryId: ids.queryId,
      travelStartDate: "2026-11-05",
    });
    const operationalDetail = await caller.query(api.crm.jobCards.getDetail, {
      jobCardId: created.id,
    });
    expect(operationalDetail).toMatchObject({ id: created.id, queryId: ids.queryId });
    expect(operationalDetail).not.toHaveProperty("approxMargin");
    expect(operationalDetail).not.toHaveProperty("profitPerPax");
    // Operational DTOs intentionally redact money; the stored snapshot is the durability oracle.
    await t.run(async (ctx) => {
      expect(await ctx.db.get("jobCards", created.id)).toMatchObject({
        approxMargin: 25_000,
        confirmedOfferId: ids.offerId,
        profitPerPax: 12_000,
      });
    });
  });
}
for (const [role, enabled, rejection] of [
  ["Sales", false, "FORBIDDEN"],
  ["Finance", false, "FORBIDDEN"],
  ["Operations Head", false, "Only Accounts can create Job Cards after order confirmation"],
  ["Operations", true, "FORBIDDEN"],
] as const) {
  test(`${role} enabled=${enabled} cannot read the new creation-only snapshot margin or create`, async () => {
    const { caller, ids, observer } = await seedMargins(role, enabled, 25_000);
    const detail = await caller.query(api.crm.queries.getDetail, { queryId: ids.queryId });
    expect(detail?.confirmedOffer?.approxMargin).toBeNull();
    await expect(
      caller.mutation(api.crm.jobCards.createFromQuery, {
        confirmedPax: 10,
        proposalId: ids.proposalId,
        queryId: ids.queryId,
        travelStartDate: "2026-11-02",
      })
    ).rejects.toThrow(rejection);
    expect(await observer.query(api.crm.jobCards.getListRow, { queryId: ids.queryId })).toBeNull();
    expect(
      (
        await observer.query(api.crm.jobCards.listPage, {
          paginationOpts: { cursor: null, numItems: 25 },
        })
      ).page
    ).toEqual([]);
  });
}
for (const example of [
  { detailMargin: 0, label: "zero", margin: 0 },
  { detailMargin: null, label: "legacy missing", margin: undefined },
]) {
  test(`${example.label} snapshot margin remains unchanged through reading and creation`, async () => {
    const { caller, ids, t } = await seedMargins("Accounts", false, example.margin);
    const detail = await caller.query(api.crm.queries.getDetail, { queryId: ids.queryId });
    expect(detail?.confirmedOffer?.approxMargin).toBe(example.detailMargin);
    const created = await caller.mutation(api.crm.jobCards.createFromQuery, {
      confirmedPax: 10,
      proposalId: ids.proposalId,
      queryId: ids.queryId,
      travelStartDate: "2026-11-02",
    });
    // The public operational record deliberately redacts money; inspect the persisted immutable value.
    await t.run(async (ctx) => {
      const saved = await ctx.db.get("jobCards", created.id);
      if (example.label === "zero") {
        expect(saved?.approxMargin).toBe(0);
      } else {
        expect(saved).not.toHaveProperty("approxMargin");
      }
      expect(saved?.profitPerPax).toBe(12_000);
    });
  });
}
test("Creation margin detail retains record ownership and Cement scope", async () => {
  const { caller, ids, observer, t } = await seedMargins("Accounts", false, 25_000);
  const createArgs = { confirmedPax: 10, queryId: ids.queryId, travelStartDate: "2026-11-02" };
  await t.run(async (ctx) => {
    await ctx.db.patch("staffUsers", ids.staffId, { roles: ["Accounts", "Sales Cement"] });
  });
  expect(await caller.query(api.crm.queries.getDetail, { queryId: ids.queryId })).toBeNull();
  await expect(caller.mutation(api.crm.jobCards.createFromQuery, createArgs)).rejects.toThrow(
    "FORBIDDEN"
  );
  expect(await observer.query(api.crm.jobCards.getListRow, { queryId: ids.queryId })).toBeNull();
  await t.run(async (ctx) => ctx.db.patch("queries", ids.queryId, { queryType: "Cement" }));
  expect(
    (await caller.query(api.crm.queries.getDetail, { queryId: ids.queryId }))?.confirmedOffer
      ?.approxMargin
  ).toBe(25_000);
  await t.run(async (ctx) => ctx.db.patch("queries", ids.queryId, { createdBy: "other" }));
  expect(await caller.query(api.crm.queries.getDetail, { queryId: ids.queryId })).toBeNull();
  await expect(caller.mutation(api.crm.jobCards.createFromQuery, createArgs)).rejects.toThrow(
    "FORBIDDEN"
  );
  expect(await observer.query(api.crm.jobCards.getListRow, { queryId: ids.queryId })).toBeNull();
  await expect(t.query(api.crm.queries.getDetail, { queryId: ids.queryId })).rejects.toThrow(
    "FORBIDDEN"
  );
  const owned = await seedMargins("Accounts", false, 25_000);
  await owned.t.run(async (ctx) => {
    await Promise.all([
      ctx.db.patch("staffUsers", owned.ids.staffId, { roles: ["Accounts", "Sales Cement"] }),
      ctx.db.patch("queries", owned.ids.queryId, { queryType: "Cement" }),
    ]);
  });
  const created = await owned.caller.mutation(api.crm.jobCards.createFromQuery, {
    confirmedPax: 10,
    queryId: owned.ids.queryId,
    travelStartDate: "2026-11-02",
  });
  expect(
    await owned.caller.query(api.crm.jobCards.getListRow, { queryId: owned.ids.queryId })
  ).toMatchObject({ id: created.id, queryId: owned.ids.queryId, queryType: "Cement" });
});
test("Creation still requires confirmation, a Confirmed Offer and no existing Job Card", async () => {
  const unconfirmed = await seedMargins("Accounts", false, 25_000);
  await unconfirmed.t.run(async (ctx) =>
    ctx.db.patch("queries", unconfirmed.ids.queryId, {
      contractingStatus: "Proposal sent",
      salesStatus: "Proposal in discussion",
    })
  );
  await expect(
    unconfirmed.caller.mutation(api.crm.jobCards.createFromQuery, {
      confirmedPax: 10,
      queryId: unconfirmed.ids.queryId,
      travelStartDate: "2026-11-02",
    })
  ).rejects.toThrow("confirmation");
  const missing = await seedMargins("Accounts", false, 25_000);
  await missing.t.run(async (ctx) => {
    await ctx.db.patch("queries", missing.ids.queryId, { confirmedOfferId: undefined });
    await ctx.db.delete("confirmedOffers", missing.ids.offerId);
  });
  await expect(
    missing.caller.mutation(api.crm.jobCards.createFromQuery, {
      confirmedPax: 10,
      queryId: missing.ids.queryId,
      travelStartDate: "2026-11-02",
    })
  ).rejects.toThrow("Confirmed Offer");
  const duplicate = await seedMargins("Accounts", false, 25_000);
  const args = { confirmedPax: 10, queryId: duplicate.ids.queryId, travelStartDate: "2026-11-02" };
  await duplicate.caller.mutation(api.crm.jobCards.createFromQuery, args);
  await expect(duplicate.caller.mutation(api.crm.jobCards.createFromQuery, args)).rejects.toThrow(
    "already"
  );
});
