import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { notifyRoles, notifyStaffMember } from "./lib";

const PREFERRED_STATUSES = new Set(["Accepted", "Sent"]);
const STATUS_RANK: Record<string, number> = { Accepted: 0, Sent: 1 };

export type ProposalDocumentRecord = {
  fileName: string;
  proposalId: Id<"proposals">;
  uploadedAt: string | null;
};

export function toProposalDocument(proposal: {
  _id: Id<"proposals">;
  finalizedPdfFileName?: string;
  finalizedPdfStorageId?: Id<"_storage">;
  finalizedPdfUploadedAt?: number;
}): ProposalDocumentRecord | null {
  if (!proposal.finalizedPdfStorageId) {
    return null;
  }
  return {
    fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
    proposalId: proposal._id,
    uploadedAt: proposal.finalizedPdfUploadedAt
      ? new Date(proposal.finalizedPdfUploadedAt).toISOString()
      : null,
  };
}

function compareProposalDocuments(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftRank = STATUS_RANK[String(left.status)] ?? 99;
  const rightRank = STATUS_RANK[String(right.status)] ?? 99;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const leftUploaded = Number(left.finalizedPdfUploadedAt ?? left.updatedAt ?? 0);
  const rightUploaded = Number(right.finalizedPdfUploadedAt ?? right.updatedAt ?? 0);
  if (leftUploaded !== rightUploaded) {
    return rightUploaded - leftUploaded;
  }
  return Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0);
}

export function pickBestProposalDocument(
  proposals: Array<Record<string, unknown>>
): ProposalDocumentRecord | null {
  const candidates = proposals
    .filter(
      (proposal) =>
        proposal.finalizedPdfStorageId && PREFERRED_STATUSES.has(String(proposal.status))
    )
    .sort(compareProposalDocuments);
  const best = candidates[0];
  return best ? toProposalDocument(best as Parameters<typeof toProposalDocument>[0]) : null;
}

export async function resolveProposalDocumentsByQueryId(
  ctx: QueryCtx,
  queryIds: Id<"queries">[]
): Promise<Map<string, ProposalDocumentRecord | null>> {
  const result = new Map<string, ProposalDocumentRecord | null>();
  if (queryIds.length === 0) {
    return result;
  }

  const uniqueQueryIds = [...new Set(queryIds.map(String))];
  for (const queryId of uniqueQueryIds) {
    result.set(queryId, null);
  }

  const linksByQuery = new Map<string, Array<{ proposalId: Id<"proposals"> }>>();
  const legacyProposalsByQuery = new Map<string, Array<Record<string, unknown>>>();
  const proposalIdsToLoad = new Set<string>();

  await Promise.all(
    queryIds.map(async (queryId) => {
      const queryKey = String(queryId);
      const [links, legacyProposals] = await Promise.all([
        ctx.db
          .query("proposalQueryLinks")
          .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
          .collect(),
        ctx.db
          .query("proposals")
          .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
          .collect(),
      ]);
      linksByQuery.set(queryKey, links);
      legacyProposalsByQuery.set(queryKey, legacyProposals);
      for (const link of links) {
        proposalIdsToLoad.add(String(link.proposalId));
      }
      for (const proposal of legacyProposals) {
        proposalIdsToLoad.add(String(proposal._id));
      }
    })
  );

  const proposalsById = new Map<string, Record<string, unknown>>();
  for (const legacyList of legacyProposalsByQuery.values()) {
    for (const proposal of legacyList) {
      proposalsById.set(String(proposal._id), proposal);
    }
  }

  const missingProposalIds = [...proposalIdsToLoad].filter(
    (proposalId) => !proposalsById.has(proposalId)
  );
  const loadedProposals = await Promise.all(
    missingProposalIds.map((proposalId) => ctx.db.get(proposalId as Id<"proposals">))
  );
  for (const proposal of loadedProposals) {
    if (proposal) {
      proposalsById.set(String(proposal._id), proposal);
    }
  }

  for (const queryId of uniqueQueryIds) {
    const linkedProposals: Array<Record<string, unknown>> = [];
    const seenProposalIds = new Set<string>();
    for (const link of linksByQuery.get(queryId) ?? []) {
      const proposal = proposalsById.get(String(link.proposalId));
      if (proposal && !seenProposalIds.has(String(proposal._id))) {
        seenProposalIds.add(String(proposal._id));
        linkedProposals.push(proposal);
      }
    }
    for (const proposal of legacyProposalsByQuery.get(queryId) ?? []) {
      if (!seenProposalIds.has(String(proposal._id))) {
        seenProposalIds.add(String(proposal._id));
        linkedProposals.push(proposal);
      }
    }
    result.set(queryId, pickBestProposalDocument(linkedProposals));
  }

  return result;
}

export async function linkedQueriesForProposalDocument(
  ctx: MutationCtx,
  proposal: { _id: Id<"proposals">; queryId?: Id<"queries"> }
) {
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
    .collect();
  const queryIds = new Set<string>();
  if (proposal.queryId) {
    queryIds.add(String(proposal.queryId));
  }
  for (const link of links) {
    queryIds.add(String(link.queryId));
  }
  const queries = await Promise.all(
    [...queryIds].map((queryId) => ctx.db.get(queryId as Id<"queries">))
  );
  return queries.filter((query): query is NonNullable<typeof query> => Boolean(query));
}

async function resolveActiveSalesOwnerStaff(ctx: MutationCtx, rawSalesOwnerId: string) {
  const normalizedStaffId = ctx.db.normalizeId("staffUsers", rawSalesOwnerId);
  const staffById = normalizedStaffId ? await ctx.db.get(normalizedStaffId) : null;
  if (staffById?.active) {
    return staffById;
  }
  const staffByAuthId = await ctx.db
    .query("staffUsers")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", rawSalesOwnerId))
    .unique();
  return staffByAuthId?.active ? staffByAuthId : null;
}

export async function notifyLinkedQuerySalesOwnersOfProposalDocument(
  ctx: MutationCtx,
  args: {
    isReplacement: boolean;
    proposalCode: string;
    proposalId: Id<"proposals">;
    queryId?: Id<"queries">;
  }
) {
  const proposal = await ctx.db.get(args.proposalId);
  if (!proposal) {
    return;
  }
  const linkedQueries = await linkedQueriesForProposalDocument(ctx, proposal);
  const rawOwnerIds = [
    ...new Set(
      linkedQueries.flatMap((query) => {
        const ownerId = query.salesOwnerId?.trim();
        return ownerId ? [ownerId] : [];
      })
    ),
  ];
  const ownerEntries = await Promise.all(
    rawOwnerIds.map(
      async (ownerId) => [ownerId, await resolveActiveSalesOwnerStaff(ctx, ownerId)] as const
    )
  );
  const ownerByRawId = new Map(ownerEntries);
  const notifiedOwnerIds = new Set<string>();
  const ownerNotifications: Array<Promise<void>> = [];

  for (const linkedQuery of linkedQueries) {
    const rawSalesOwnerId = linkedQuery.salesOwnerId?.trim();
    if (!rawSalesOwnerId) {
      continue;
    }
    const staff = ownerByRawId.get(rawSalesOwnerId);
    if (!(staff?.active && !notifiedOwnerIds.has(String(staff._id)))) {
      continue;
    }
    const salesOwnerId = staff._id;
    notifiedOwnerIds.add(String(salesOwnerId));
    ownerNotifications.push(
      notifyStaffMember(ctx, salesOwnerId, {
        body: args.isReplacement
          ? `${args.proposalCode} proposal document was revised for ${linkedQuery.queryCode}.`
          : `${args.proposalCode} proposal document is available for ${linkedQuery.queryCode}.`,
        entityId: linkedQuery._id,
        entityType: "query",
        title: args.isReplacement ? "Proposal document revised" : "Proposal document uploaded",
      })
    );
  }

  await Promise.all(ownerNotifications);

  if (notifiedOwnerIds.size > 0) {
    return;
  }

  const fallbackEntityId = linkedQueries[0]?._id ?? args.proposalId;
  const fallbackEntityType = linkedQueries[0] ? "query" : "proposal";
  await notifyRoles(ctx, ["Sales", "Sales Head"], {
    body: args.isReplacement
      ? `${args.proposalCode} proposal document was revised.`
      : `${args.proposalCode} proposal document is available for review.`,
    entityId: fallbackEntityId,
    entityType: fallbackEntityType,
    title: args.isReplacement ? "Proposal document revised" : "Proposal document uploaded",
  });
}
