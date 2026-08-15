import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { assertE2eSecret } from "./lib/e2eAuth";
import { insertE2eFixtureWithOwnership, patchE2eFixtureWithOwnership } from "./lib/e2eOwnership";
import { buildProposalListSearchText, buildQueryListSearchText } from "./listSearch";
import { PROPOSAL_ATTACHMENT_SUMMARY_VERSION } from "./proposalAttachmentSummary";
import { proposalLinkedQuerySummary, proposalLinkProjection } from "./proposalLinkProjection";

const fixtureResultValidator = v.object({
  cementClientName: v.string(),
  clientName: v.string(),
  nonCementClientName: v.string(),
  proposalId: v.id("proposals"),
  queryCode: v.string(),
  queryId: v.id("queries"),
});

const customerJourneyFixtureResultValidator = v.object({
  destination: v.string(),
  email: v.string(),
  name: v.string(),
  queryCode: v.string(),
});

async function staffByKey(ctx: MutationCtx, localPart: string) {
  return await ctx.db
    .query("staffUsers")
    .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", `${localPart}@citius-e2e.test`))
    .unique();
}

function assertCustomerFixtureIdentity(args: {
  authUserId: string;
  canonicalAuthUserId: string;
  email: string;
}) {
  if (
    !(args.email.endsWith("@citius-e2e.test") && args.canonicalAuthUserId.includes("|")) ||
    args.authUserId.includes("|")
  ) {
    throw new ConvexError("Invalid E2E Customer Account identity");
  }
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
      attachmentSummaryGeneration: 0,
      attachmentSummaryState: "ready" as const,
      attachmentSummaryVersion: PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
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
    const linkedQuery = await ctx.db.get("queries", queryId);
    if (!linkedQuery) {
      throw new ConvexError("E2E proposal fixture query was not found");
    }
    const linkPayload = {
      ...proposalLinkProjection(linkedQuery),
      createdAt: now,
      createdBy: contracting.authUserId,
      proposalId,
      queryId,
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
    await patchE2eFixtureWithOwnership(
      ctx,
      args.runId,
      "proposals",
      proposalId,
      proposalLinkedQuerySummary([linkedQuery])
    );

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
      operationsOwnerId: operations._id,
      operationsOwnerName: operations.name,
      status: "Open",
      updatedAt: now,
    });
    return { cementClientName, clientName, nonCementClientName, proposalId, queryCode, queryId };
  },
  returns: fixtureResultValidator,
});

export const createCustomerAccountJourney = internalMutation({
  args: {
    authUserId: v.string(),
    canonicalAuthUserId: v.string(),
    email: v.string(),
    name: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    assertE2eSecret();
    assertCustomerFixtureIdentity(args);
    const [sales, contracting] = await Promise.all([
      staffByKey(ctx, "e2e-sales"),
      staffByKey(ctx, "e2e-contracting"),
    ]);
    if (!(sales?.authUserId && contracting?.authUserId)) {
      throw new ConvexError("E2E staff profiles must be provisioned before customer fixtures");
    }

    const now = Date.now();
    const existingProfileRows = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", args.canonicalAuthUserId))
        .unique(),
      ctx.db
        .query("userProfiles")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", args.authUserId))
        .unique(),
      ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique(),
    ]);
    const existingProfiles = Array.from(
      new Map(
        existingProfileRows
          .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
          .map((profile) => [profile._id, profile])
      ).values()
    );
    if (existingProfiles.length > 1) {
      throw new ConvexError("E2E Customer Account profile identity is ambiguous");
    }
    const [existingProfile] = existingProfiles;
    const profilePayload = {
      authUserId: args.canonicalAuthUserId,
      email: args.email,
      emailNormalized: args.email,
      name: args.name,
      updatedAt: now,
    };
    const accountHolderProfileId = existingProfile
      ? existingProfile._id
      : await insertE2eFixtureWithOwnership(ctx, args.runId, "userProfiles", {
          ...profilePayload,
          createdAt: now,
        });
    if (existingProfile) {
      await patchE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "userProfiles",
        existingProfile._id,
        profilePayload
      );
    }

    const identityLinks = await ctx.db
      .query("authIdentityLinks")
      .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", args.authUserId))
      .take(3);
    if (
      identityLinks.some((link) => link.canonicalAuthUserId !== args.canonicalAuthUserId) ||
      identityLinks.length > 1
    ) {
      throw new ConvexError("E2E Customer Account identity link is ambiguous");
    }
    const [existingIdentityLink] = identityLinks;
    const identityLinkPayload = {
      canonicalAuthUserId: args.canonicalAuthUserId,
      legacyAuthUserId: args.authUserId,
      status: "linked" as const,
      updatedAt: now,
    };
    if (existingIdentityLink) {
      await patchE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "authIdentityLinks",
        existingIdentityLink._id,
        identityLinkPayload
      );
    } else {
      await insertE2eFixtureWithOwnership(ctx, args.runId, "authIdentityLinks", {
        ...identityLinkPayload,
        createdAt: now,
      });
    }

    const destination = "E2E Customer Journey";
    const queryCode = "Q-E2E-CUSTOMER-ACCOUNT";
    const queryId = await upsertQuery(ctx, {
      clientName: args.name,
      contractingOwnerId: contracting.authUserId,
      contractingOwnerName: contracting.name,
      createdBy: sales.authUserId,
      queryCode,
      queryType: "MICE",
      runId: args.runId,
      salesOwnerId: sales.authUserId,
      salesOwnerName: sales.name,
    });
    const proposalCode = "P-E2E-CUSTOMER-ACCOUNT";
    const proposalPayload = {
      airfarePerPax: 500,
      attachmentCount: 0,
      attachmentPreview: [],
      attachmentSummaryGeneration: 0,
      attachmentSummaryState: "ready" as const,
      attachmentSummaryVersion: PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
      clientName: args.name,
      costPrice: 2200,
      itinerarySummary: "Explicit Customer Account entitlement fixture",
      landCostPerPax: 1500,
      listSearchText: buildProposalListSearchText({
        clientName: args.name,
        preparedBy: contracting.name,
        proposalCode,
      }),
      preparedBy: contracting.name,
      pricingEnteredAt: now,
      proposalCode,
      proposalRevision: 1,
      queryId,
      sellingPrice: 2500,
      sentToSalesAt: now,
      status: "Accepted" as const,
      taxRate: 5,
      updatedAt: now,
      visaCostPerPax: 200,
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
      await patchE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "proposals",
        existingProposal._id,
        proposalPayload
      );
    }

    const queryRow = await ctx.db.get("queries", queryId);
    if (!queryRow) {
      throw new ConvexError("E2E Customer Account query was not found");
    }
    const existingLink = await ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_proposalId_and_queryId", (q) =>
        q.eq("proposalId", proposalId).eq("queryId", queryId)
      )
      .unique();
    const proposalQueryLinkPayload = {
      ...proposalLinkProjection(queryRow),
      createdAt: now,
      createdBy: contracting.authUserId,
      proposalId,
      queryId,
    };
    if (existingLink) {
      await patchE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "proposalQueryLinks",
        existingLink._id,
        proposalQueryLinkPayload
      );
    } else {
      await insertE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "proposalQueryLinks",
        proposalQueryLinkPayload
      );
    }
    await patchE2eFixtureWithOwnership(
      ctx,
      args.runId,
      "proposals",
      proposalId,
      proposalLinkedQuerySummary([queryRow])
    );

    const existingOffer = await ctx.db
      .query("confirmedOffers")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .first();
    const offerPayload = {
      airfarePerPax: 500,
      confirmedAt: now,
      confirmedPax: 2,
      destination,
      landCostPerPax: 1500,
      profitPerPax: 300,
      proposalId,
      proposalRevision: 1,
      queryId,
      sellingPricePerPax: 2500,
      source: "Client" as const,
      taxRate: 5,
      travelEndDate: "2026-12-06",
      travelStartDate: "2026-12-01",
      updatedAt: now,
      visaCostPerPax: 200,
    };
    const confirmedOfferId = existingOffer
      ? existingOffer._id
      : await insertE2eFixtureWithOwnership(ctx, args.runId, "confirmedOffers", {
          ...offerPayload,
          createdAt: now,
          createdBy: sales.authUserId,
        });
    if (existingOffer) {
      await patchE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "confirmedOffers",
        existingOffer._id,
        offerPayload
      );
    }
    await patchE2eFixtureWithOwnership(ctx, args.runId, "queries", queryId, {
      confirmedOfferId,
      destination,
      updatedAt: now,
    });

    const existingEntitlement = await ctx.db
      .query("customerJourneyEntitlements")
      .withIndex("by_confirmedOfferId_authUserId", (q) =>
        q.eq("confirmedOfferId", confirmedOfferId).eq("authUserId", args.canonicalAuthUserId)
      )
      .first();
    const entitlementPayload = {
      accountHolderProfileId,
      authUserId: args.canonicalAuthUserId,
      capabilities: ["view_confirmed_trip" as const],
      confirmedOfferId,
      grantedByStaffId: sales._id,
      queryId,
      revokedAt: undefined,
      role: "organizer" as const,
      source: "crm_operator_grant" as const,
      updatedAt: now,
    };
    if (existingEntitlement) {
      await patchE2eFixtureWithOwnership(
        ctx,
        args.runId,
        "customerJourneyEntitlements",
        existingEntitlement._id,
        entitlementPayload
      );
    } else {
      await insertE2eFixtureWithOwnership(ctx, args.runId, "customerJourneyEntitlements", {
        ...entitlementPayload,
        createdAt: now,
      });
    }

    return { destination, email: args.email, name: args.name, queryCode };
  },
  returns: customerJourneyFixtureResultValidator,
});
