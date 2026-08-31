import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  canSeeProposalRecord,
  canSeeQueryRecord,
  hasRole,
  isCementQueryType,
  type PortalAccess,
  shouldApplyCementScope,
} from "./lib";

type ProposalLink = Doc<"proposalQueryLinks">;
type ProposalVisibility = Pick<
  Doc<"proposals">,
  "_id" | "collaboratorStaffIds" | "createdBy" | "preparedBy" | "preparedByStaffId" | "queryId"
> & {
  linkedQueryPreview?: Doc<"proposals">["linkedQueryPreview"];
};

function normalizeOwnerName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

async function firstVisibleLink(
  ctx: QueryCtx,
  access: PortalAccess,
  proposal: ProposalVisibility,
  candidates: Array<ProposalLink | null>
) {
  const currentQueries = await Promise.all(
    candidates.flatMap((candidate) => (candidate ? [ctx.db.get("queries", candidate.queryId)] : []))
  );
  return currentQueries.find(
    (query) =>
      query && canSeeQueryRecord(access, query) && canSeeProposalRecord(access, proposal, query)
  );
}

async function regularVisibilityCandidates(
  ctx: QueryCtx,
  access: PortalAccess,
  proposalId: Id<"proposals">
) {
  const authUserId = access.authUserId ?? "";
  const staffId = access.staffId ? String(access.staffId) : "";
  const ownerName = normalizeOwnerName(access.name);
  const candidates = await Promise.all([
    authUserId
      ? firstIndexedLink(ctx, "by_proposalId_and_queryCreatedBy", [
          ["proposalId", proposalId],
          ["queryCreatedBy", authUserId],
        ])
      : null,
    authUserId
      ? firstIndexedLink(ctx, "by_proposalId_and_salesOwnerId", [
          ["proposalId", proposalId],
          ["salesOwnerId", authUserId],
        ])
      : null,
    staffId
      ? firstIndexedLink(ctx, "by_proposalId_and_salesOwnerId", [
          ["proposalId", proposalId],
          ["salesOwnerId", staffId],
        ])
      : null,
    staffId
      ? firstIndexedLink(ctx, "by_proposalId_and_contractingOwnerId", [
          ["proposalId", proposalId],
          ["contractingOwnerId", staffId],
        ])
      : null,
    staffId
      ? firstIndexedLink(ctx, "by_proposalId_and_ticketingOwnerId", [
          ["proposalId", proposalId],
          ["ticketingOwnerId", staffId],
        ])
      : null,
    ownerName
      ? firstIndexedLink(ctx, "by_proposalId_and_salesOwnerName", [
          ["proposalId", proposalId],
          ["salesOwnerNameNormalized", ownerName],
        ])
      : null,
    ownerName
      ? firstIndexedLink(ctx, "by_proposalId_and_contractingOwnerName", [
          ["proposalId", proposalId],
          ["contractingOwnerNameNormalized", ownerName],
        ])
      : null,
    ownerName
      ? firstIndexedLink(ctx, "by_proposalId_and_ticketingOwnerName", [
          ["proposalId", proposalId],
          ["ticketingOwnerNameNormalized", ownerName],
        ])
      : null,
    hasRole(access, "Accounts") || hasRole(access, "Accounts Head")
      ? firstIndexedLink(ctx, "by_proposalId_and_salesStatus", [
          ["proposalId", proposalId],
          ["salesStatus", "Order Confirmed"],
        ])
      : null,
    hasRole(access, "Accounts") || hasRole(access, "Accounts Head")
      ? firstIndexedLink(ctx, "by_proposalId_and_contractingStatus", [
          ["proposalId", proposalId],
          ["contractingStatus", "Order Confirmed"],
        ])
      : null,
  ]);
  return candidates.filter((candidate): candidate is ProposalLink => candidate !== null);
}

async function firstIndexedLink(
  ctx: QueryCtx,
  indexName: string,
  fields: [string, unknown][]
): Promise<ProposalLink | null> {
  const proposalId = ctx.db.normalizeId("proposals", String(fields[0]?.[1] ?? ""));
  const value = String(fields[1]?.[1] ?? "");
  if (!(proposalId && value)) {
    return null;
  }
  const source = ctx.db.query("proposalQueryLinks");
  switch (indexName) {
    case "by_proposalId_and_queryCreatedBy":
      return await source
        .withIndex("by_proposalId_and_queryCreatedBy", (range) =>
          range.eq("proposalId", proposalId).eq("queryCreatedBy", value)
        )
        .first();
    case "by_proposalId_and_salesOwnerId":
      return await source
        .withIndex("by_proposalId_and_salesOwnerId", (range) =>
          range.eq("proposalId", proposalId).eq("salesOwnerId", value)
        )
        .first();
    case "by_proposalId_and_contractingOwnerId":
      return await source
        .withIndex("by_proposalId_and_contractingOwnerId", (range) =>
          range.eq("proposalId", proposalId).eq("contractingOwnerId", value)
        )
        .first();
    case "by_proposalId_and_ticketingOwnerId":
      return await source
        .withIndex("by_proposalId_and_ticketingOwnerId", (range) =>
          range.eq("proposalId", proposalId).eq("ticketingOwnerId", value)
        )
        .first();
    case "by_proposalId_and_salesOwnerName":
      return await source
        .withIndex("by_proposalId_and_salesOwnerName", (range) =>
          range.eq("proposalId", proposalId).eq("salesOwnerNameNormalized", value)
        )
        .first();
    case "by_proposalId_and_contractingOwnerName":
      return await source
        .withIndex("by_proposalId_and_contractingOwnerName", (range) =>
          range.eq("proposalId", proposalId).eq("contractingOwnerNameNormalized", value)
        )
        .first();
    case "by_proposalId_and_ticketingOwnerName":
      return await source
        .withIndex("by_proposalId_and_ticketingOwnerName", (range) =>
          range.eq("proposalId", proposalId).eq("ticketingOwnerNameNormalized", value)
        )
        .first();
    case "by_proposalId_and_salesStatus":
      return await source
        .withIndex("by_proposalId_and_salesStatus", (range) =>
          range.eq("proposalId", proposalId).eq("salesStatus", value)
        )
        .first();
    case "by_proposalId_and_contractingStatus":
      return await source
        .withIndex("by_proposalId_and_contractingStatus", (range) =>
          range.eq("proposalId", proposalId).eq("contractingStatus", value)
        )
        .first();
    default:
      throw new Error(`Unsupported proposal visibility index: ${indexName}`);
  }
}

async function cementVisibilityCandidates(
  ctx: QueryCtx,
  access: PortalAccess,
  proposalId: Id<"proposals">
) {
  const authUserId = access.authUserId ?? "";
  const staffId = access.staffId ? String(access.staffId) : "";
  const ownerName = normalizeOwnerName(access.name);
  const candidates: Promise<ProposalLink | null>[] = [];
  for (const queryType of ["Cement", "Cement Bidding"]) {
    if (hasRole(access, "Director Cement")) {
      candidates.push(
        firstIndexedLink(ctx, "by_proposalId_and_queryType", [
          ["proposalId", proposalId],
          ["queryType", queryType],
        ])
      );
    }
    if (authUserId) {
      candidates.push(
        firstIndexedLink(ctx, "by_proposal_type_createdBy", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["queryCreatedBy", authUserId],
        ]),
        firstIndexedLink(ctx, "by_proposal_type_salesOwnerId", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["salesOwnerId", authUserId],
        ])
      );
    }
    if (staffId) {
      candidates.push(
        firstIndexedLink(ctx, "by_proposal_type_salesOwnerId", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["salesOwnerId", staffId],
        ]),
        firstIndexedLink(ctx, "by_proposal_type_contractingOwnerId", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["contractingOwnerId", staffId],
        ]),
        firstIndexedLink(ctx, "by_proposal_type_ticketingOwnerId", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["ticketingOwnerId", staffId],
        ])
      );
    }
    if (ownerName) {
      candidates.push(
        firstIndexedLink(ctx, "by_proposal_type_salesOwnerName", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["salesOwnerNameNormalized", ownerName],
        ]),
        firstIndexedLink(ctx, "by_proposal_type_contractingOwnerName", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["contractingOwnerNameNormalized", ownerName],
        ]),
        firstIndexedLink(ctx, "by_proposal_type_ticketingOwnerName", [
          ["proposalId", proposalId],
          ["queryType", queryType],
          ["ticketingOwnerNameNormalized", ownerName],
        ])
      );
    }
  }
  return (await Promise.all(candidates)).filter(
    (candidate): candidate is ProposalLink => candidate !== null
  );
}

export async function resolveProposalVisibility(
  ctx: QueryCtx,
  access: PortalAccess,
  proposal: ProposalVisibility
) {
  const previewQueries = await Promise.all(
    (proposal.linkedQueryPreview ?? []).map((projection) =>
      ctx.db.get("queries", projection.queryId)
    )
  );
  const previewQuery = previewQueries.find(
    (query) =>
      query && canSeeProposalRecord(access, proposal, query) && canSeeQueryRecord(access, query)
  );
  if (previewQuery) {
    return { visible: true, visibleQuery: previewQuery };
  }
  if (!shouldApplyCementScope(access) && canSeeProposalRecord(access, proposal, null)) {
    return { visible: true, visibleQuery: null };
  }
  const candidates = shouldApplyCementScope(access)
    ? await cementVisibilityCandidates(ctx, access, proposal._id)
    : await regularVisibilityCandidates(ctx, access, proposal._id);
  const visibleQuery = await firstVisibleLink(ctx, access, proposal, candidates);
  if (!visibleQuery) {
    return { visible: false, visibleQuery: null };
  }
  return {
    visible: !shouldApplyCementScope(access) || isCementQueryType(visibleQuery.queryType),
    visibleQuery,
  };
}
