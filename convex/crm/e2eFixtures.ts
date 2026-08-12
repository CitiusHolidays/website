import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { assertE2eSecret } from "./lib/e2eAuth";
import { insertE2eFixtureWithOwnership, patchE2eFixtureWithOwnership } from "./lib/e2eOwnership";
import { buildProposalListSearchText, buildQueryListSearchText } from "./listSearch";

const fixtureResultValidator = v.object({
  cementClientName: v.string(),
  clientName: v.string(),
  nonCementClientName: v.string(),
  proposalId: v.id("proposals"),
  queryCode: v.string(),
  queryId: v.id("queries"),
});

async function staffByKey(ctx: MutationCtx, localPart: string) {
  return await ctx.db
    .query("staffUsers")
    .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", `${localPart}@citius-e2e.test`))
    .unique();
}

async function upsertQuery(
  ctx: MutationCtx,
  args: {
    clientName: string;
    contractingOwnerId: string;
    contractingOwnerName: string;
    createdBy: string;
    queryCode: string;
    queryType: "Cement" | "MICE";
    salesOwnerId: string;
    salesOwnerName: string;
    runId: string;
  }
) {
  const now = Date.now();
  const payload = {
    attachmentCount: 0,
    attachmentPreview: [],
    batchingNotes: "",
    budgetAmount: 75_000,
    clientName: args.clientName,
    contactMobile: "",
    contactPerson: "",
    contractingOwnerId: args.contractingOwnerId,
    contractingOwnerName: args.contractingOwnerName,
    contractingStatus: "Proposal in progress" as const,
    destination: "Fixture Destination",
    leadStage: "Proposal" as const,
    listSearchText: buildQueryListSearchText(args),
    notes: "E2E role semantics fixture",
    paxCount: 2,
    queryCode: args.queryCode,
    queryType: args.queryType,
    salesOwnerId: args.salesOwnerId,
    salesOwnerName: args.salesOwnerName,
    salesStatus: "Proposal in discussion" as const,
    source: "Client" as const,
    submittedToContractingAt: now,
    ticketingScope: "Not required" as const,
    travelEndDate: "2026-12-06",
    travelInBatches: false,
    travelStartDate: "2026-12-01",
    travelType: "International Travel" as const,
    updatedAt: now,
  };
  const existing = await ctx.db
    .query("queries")
    .withIndex("by_queryCode", (q) => q.eq("queryCode", args.queryCode))
    .unique();
  if (existing) {
    await patchE2eFixtureWithOwnership(ctx, args.runId, "queries", existing._id, payload);
    return existing._id;
  }
  return await insertE2eFixtureWithOwnership(ctx, args.runId, "queries", {
    ...payload,
    createdAt: now,
    createdBy: args.createdBy,
  });
}

export const createIncompleteProposalHandoff = internalMutation({
  args: { label: v.string(), runId: v.string() },
  handler: async (ctx, args) => {
    assertE2eSecret();
    const label = args.label.trim();
    if (!label.startsWith("E2E ")) {
      throw new ConvexError("E2E fixture labels must begin with E2E");
    }
    const [sales, contracting, salesCement, contractingCement, operations] = await Promise.all([
      staffByKey(ctx, "e2e-sales"),
      staffByKey(ctx, "e2e-contracting"),
      staffByKey(ctx, "e2e-sales-cement"),
      staffByKey(ctx, "e2e-contracting-cement"),
      staffByKey(ctx, "e2e-operations"),
    ]);
    if (
      !(
        sales?.authUserId &&
        contracting?.authUserId &&
        salesCement?.authUserId &&
        contractingCement?.authUserId &&
        operations?.authUserId
      )
    ) {
      throw new ConvexError("E2E staff profiles must be provisioned before workflow fixtures");
    }
    const now = Date.now();
    const queryCode = "Q-E2E-INCOMPLETE-HANDOFF";
    const clientName = label;
    const queryId = await upsertQuery(ctx, {
      clientName,
      contractingOwnerId: contracting.authUserId,
      contractingOwnerName: contracting.name,
      createdBy: sales.authUserId,
      queryCode,
      queryType: "MICE",
      runId: args.runId,
      salesOwnerId: sales.authUserId,
      salesOwnerName: sales.name,
    });
    const proposalCode = "P-E2E-INCOMPLETE-HANDOFF";
    const proposalPayload = {
      attachmentCount: 0,
      attachmentPreview: [],
      clientName,
      itinerarySummary: "Incomplete pricing fixture",
      listSearchText: buildProposalListSearchText({
        clientName,
        preparedBy: contracting.name,
        proposalCode,
      }),
      preparedBy: contracting.name,
      proposalCode,
      queryId,
      status: "Draft" as const,
      updatedAt: now,
    };
    const existingProposal = await ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .first();
    const proposalId = existingProposal
      ? existingProposal._id
      : await insertE2eFixtureWithOwnership(ctx, args.runId, "proposals", {
          ...proposalPayload,
          createdAt: now,
          createdBy: contracting.authUserId,
        });
    if (existingProposal) {
      await patchE2eFixtureWithOwnership(ctx, args.runId, "proposals", existingProposal._id, {
        ...proposalPayload,
        airfarePerPax: undefined,
        costPrice: undefined,
        landCostPerPax: undefined,
        pricingEnteredAt: undefined,
        sellingPrice: undefined,
        sentToSalesAt: undefined,
        visaCostPerPax: undefined,
      });
    }
    const linkPayload = {
      clientName,
      contractingOwnerId: contracting.authUserId,
      contractingOwnerName: contracting.name,
      contractingStatus: "Proposal in progress",
      createdAt: now,
      createdBy: contracting.authUserId,
      paxCount: 2,
      proposalId,
      queryCode,
      queryCreatedBy: sales.authUserId,
      queryId,
      queryType: "MICE",
      salesOwnerId: sales.authUserId,
      salesOwnerName: sales.name,
      salesStatus: "Proposal in discussion",
      ticketingOwnerId: "",
      ticketingOwnerName: "",
      ticketingScope: "Not required",
    };
    const existingLink = await ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_proposalId_and_queryId", (q) =>
        q.eq("proposalId", proposalId).eq("queryId", queryId)
      )
      .unique();
    if (existingLink) {
      await patchE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "proposalQueryLinks",
        existingLink._id,
        linkPayload
      );
    } else {
      await insertE2eFixtureWithOwnership(ctx, args.runId, "proposalQueryLinks", linkPayload);
    }

    const cementClientName = "E2E Cement Visible";
    await upsertQuery(ctx, {
      clientName: cementClientName,
      contractingOwnerId: contractingCement.authUserId,
      contractingOwnerName: contractingCement.name,
      createdBy: salesCement.authUserId,
      queryCode: "Q-E2E-CEMENT-VISIBLE",
      queryType: "Cement",
      runId: args.runId,
      salesOwnerId: salesCement.authUserId,
      salesOwnerName: salesCement.name,
    });
    const nonCementClientName = "E2E Non Cement Hidden";
    await upsertQuery(ctx, {
      clientName: nonCementClientName,
      contractingOwnerId: contractingCement.authUserId,
      contractingOwnerName: contractingCement.name,
      createdBy: salesCement.authUserId,
      queryCode: "Q-E2E-NON-CEMENT-HIDDEN",
      queryType: "MICE",
      runId: args.runId,
      salesOwnerId: salesCement.authUserId,
      salesOwnerName: salesCement.name,
    });
    await insertE2eFixtureWithOwnership(ctx, args.runId, "jobCards", {
      clientName: "E2E Workflow Job Card",
      confirmedPax: 2,
      createdAt: now,
      createdBy: operations.authUserId,
      destination: "Fixture Destination",
      jobCode: "JC-E2E-WORKFLOW-EO",
      operationsOwnerId: operations.authUserId,
      operationsOwnerName: operations.name,
      status: "Open",
      updatedAt: now,
    });
    return { cementClientName, clientName, nonCementClientName, proposalId, queryCode, queryId };
  },
  returns: fixtureResultValidator,
});
