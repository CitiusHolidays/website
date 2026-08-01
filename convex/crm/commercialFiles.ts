import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "../_generated/server";
import {
  COMMERCIAL_FILE_RETENTION_MS,
  type CommercialFileCategory,
  type CommercialFileSourceType,
  type CommercialFileTeamArea,
  canManageCommercialSource,
  canReadCommercialSource,
  defaultTeamAreaForSource,
  shouldAllowHistoryOverride,
  teamAreaLabel,
  writableTeamAreasForSource,
} from "./commercialFilePolicy";
import { linkedQueriesForProposal, resolveCommercialChain } from "./commercialRecordChainReads";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  createActivity,
  getPortalAccess,
  PERMISSIONS,
  type PortalAccess,
  requireAnyPermission,
} from "./lib";

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 25;
const UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;

const sourceTypeValidator = v.union(
  v.literal("query"),
  v.literal("proposal"),
  v.literal("jobCard")
);
const categoryValidator = v.union(v.literal("workingFile"), v.literal("proposalDoc"));
const teamAreaValidator = v.union(
  v.literal("sales"),
  v.literal("contracting"),
  v.literal("ticketing"),
  v.literal("accounts"),
  v.literal("operations"),
  v.literal("tourManager")
);

const sourceOptionValidator = v.object({
  code: v.string(),
  id: v.string(),
  label: v.string(),
  sourceType: sourceTypeValidator,
  teamAreas: v.array(teamAreaValidator),
});

const commercialFileRowValidator = v.object({
  attachmentId: v.string(),
  canDelete: v.boolean(),
  canEditNote: v.boolean(),
  canRestore: v.boolean(),
  canRestoreHistory: v.boolean(),
  category: categoryValidator,
  createdAt: v.number(),
  createdBy: v.string(),
  deletedAt: v.optional(v.number()),
  fileKind: v.union(v.literal("attachment"), v.literal("proposalDoc")),
  fileName: v.string(),
  fileSize: v.number(),
  id: v.string(),
  lifecycle: v.union(v.literal("active"), v.literal("history"), v.literal("deleted")),
  mimeType: v.string(),
  note: v.optional(v.string()),
  readOnly: v.boolean(),
  sourceCode: v.string(),
  sourceId: v.string(),
  sourceLabel: v.string(),
  sourceType: sourceTypeValidator,
  teamArea: teamAreaValidator,
  teamLabel: v.string(),
  uploaderTeam: v.string(),
});

const listResultValidator = v.object({
  items: v.array(commercialFileRowValidator),
  nextCursor: v.union(v.string(), v.null()),
  sourceOptions: v.array(sourceOptionValidator),
  total: v.number(),
  writableSources: v.array(sourceOptionValidator),
});

type QueryRow = Doc<"queries">;
type ProposalRow = Doc<"proposals">;
type JobCardRow = Doc<"jobCards">;

type SourceDescriptor =
  | {
      code: string;
      id: string;
      label: string;
      linkedQueries: QueryRow[];
      query: QueryRow;
      sourceType: "query";
    }
  | {
      code: string;
      id: string;
      label: string;
      linkedQueries: QueryRow[];
      proposal: ProposalRow;
      sourceType: "proposal";
    }
  | {
      code: string;
      id: string;
      jobCard: JobCardRow;
      label: string;
      linkedQuery?: QueryRow;
      linkedQueries: QueryRow[];
      sourceType: "jobCard";
    };

function toNumber(value: string | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampPageSize(value?: number) {
  return Math.min(Math.max(Math.floor(value ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
}

function encodeCursor(offset: number) {
  return offset > 0 ? String(offset) : null;
}

function decodeCursor(cursor?: string) {
  return Math.max(0, Math.floor(toNumber(cursor)));
}

function isLegacyFileId(fileId: string) {
  return (
    fileId.startsWith("legacy-query:") ||
    fileId.startsWith("legacy-proposal:") ||
    fileId.startsWith("legacy-proposal-doc:")
  );
}

function parseLegacyFileId(fileId: string) {
  if (fileId.startsWith("legacy-query:")) {
    return { id: fileId.slice("legacy-query:".length), kind: "query" as const };
  }
  if (fileId.startsWith("legacy-proposal:")) {
    return { id: fileId.slice("legacy-proposal:".length), kind: "proposal" as const };
  }
  if (fileId.startsWith("legacy-proposal-doc:")) {
    return { id: fileId.slice("legacy-proposal-doc:".length), kind: "proposalDoc" as const };
  }
  return null;
}

async function descriptorForSource(
  ctx: QueryCtx | MutationCtx,
  sourceType: CommercialFileSourceType,
  sourceId: string
): Promise<SourceDescriptor | null> {
  if (sourceType === "query") {
    const queryId = ctx.db.normalizeId("queries", sourceId);
    const queryRow = queryId ? await ctx.db.get(queryId) : null;
    return queryRow
      ? {
          code: queryRow.queryCode,
          id: String(queryRow._id),
          label: `Query ${queryRow.queryCode}`,
          linkedQueries: [queryRow],
          query: queryRow,
          sourceType,
        }
      : null;
  }

  if (sourceType === "proposal") {
    const proposalId = ctx.db.normalizeId("proposals", sourceId);
    const proposal = proposalId ? await ctx.db.get(proposalId) : null;
    if (!proposal) {
      return null;
    }
    return {
      code: proposal.proposalCode,
      id: String(proposal._id),
      label: `Proposal ${proposal.proposalCode}`,
      linkedQueries: await linkedQueriesForProposal(ctx, proposal),
      proposal,
      sourceType,
    };
  }

  const jobCardId = ctx.db.normalizeId("jobCards", sourceId);
  const jobCard = jobCardId ? await ctx.db.get(jobCardId) : null;
  if (!jobCard) {
    return null;
  }
  const linkedQuery = jobCard.queryId ? await ctx.db.get(jobCard.queryId) : null;
  return {
    code: jobCard.jobCode,
    id: String(jobCard._id),
    jobCard,
    label: `Job Card ${jobCard.jobCode}`,
    linkedQueries: linkedQuery ? [linkedQuery] : [],
    linkedQuery: linkedQuery ?? undefined,
    sourceType,
  };
}

function policySource(source: SourceDescriptor) {
  if (source.sourceType === "query") {
    return { query: source.query, sourceType: source.sourceType } as const;
  }
  if (source.sourceType === "proposal") {
    return {
      linkedQueries: source.linkedQueries,
      proposal: source.proposal,
      sourceType: source.sourceType,
    } as const;
  }
  return {
    jobCard: source.jobCard,
    linkedQuery: source.linkedQuery,
    sourceType: source.sourceType,
  } as const;
}

function sourceCanRead(access: PortalAccess, source: SourceDescriptor) {
  return canReadCommercialSource(access, policySource(source));
}

function sourceCanManage(
  access: PortalAccess,
  source: SourceDescriptor,
  teamArea: CommercialFileTeamArea
) {
  return canManageCommercialSource(access, policySource(source), teamArea);
}

async function canReadFileThroughChain(
  ctx: QueryCtx,
  access: PortalAccess,
  source: SourceDescriptor
) {
  if (sourceCanRead(access, source)) {
    return true;
  }
  const chain = await resolveCommercialChain(ctx, source.sourceType, source.id);
  const queries = Array.from(chain.queries.values());
  if (queries.some((queryRow) => canSeeQueryRecord(access, queryRow))) {
    return true;
  }
  if (
    Array.from(chain.proposals.values()).some((proposal) =>
      canSeeProposalRecord(access, proposal, queries)
    )
  ) {
    return true;
  }
  return Array.from(chain.jobCards.values()).some((jobCard) => {
    const linkedQuery = jobCard.queryId ? chain.queries.get(String(jobCard.queryId)) : undefined;
    return canSeeJobCardRecord(access, jobCard, linkedQuery);
  });
}

async function authorizeEntryPoint(
  ctx: QueryCtx,
  access: PortalAccess,
  entryPoint: CommercialFileSourceType,
  entityId: string
) {
  const chain = await resolveCommercialChain(ctx, entryPoint, entityId);
  const source = await descriptorForSource(ctx, entryPoint, entityId);
  if (!(source && sourceCanRead(access, source))) {
    return null;
  }
  return { chain, source };
}

async function chainSources(ctx: QueryCtx, entryPoint: CommercialFileSourceType, entityId: string) {
  const chain = await resolveCommercialChain(ctx, entryPoint, entityId);
  const [querySources, proposalSources, jobCardSources] = await Promise.all([
    Promise.all(
      Array.from(chain.queries.values(), (queryRow) =>
        descriptorForSource(ctx, "query", String(queryRow._id))
      )
    ),
    Promise.all(
      Array.from(chain.proposals.values(), (proposal) =>
        descriptorForSource(ctx, "proposal", String(proposal._id))
      )
    ),
    Promise.all(
      Array.from(chain.jobCards.values(), (jobCard) =>
        descriptorForSource(ctx, "jobCard", String(jobCard._id))
      )
    ),
  ]);
  return [...querySources, ...proposalSources, ...jobCardSources].filter(
    (source): source is SourceDescriptor => source !== null
  );
}

function sourceOption(access: PortalAccess, source: SourceDescriptor) {
  const teamAreas = writableTeamAreasForSource(access, policySource(source));
  return {
    code: source.code,
    id: source.id,
    label: source.label,
    sourceType: source.sourceType,
    teamAreas,
  };
}

function rowFromRegistry(
  row: Doc<"commercialFiles">,
  access: PortalAccess,
  source: SourceDescriptor,
  includeHistory: boolean
) {
  const canManage = sourceCanManage(access, source, row.teamArea);
  const canOverride = shouldAllowHistoryOverride(access);
  const canRestore = row.lifecycle === "deleted" && (canManage || canOverride);
  const canRestoreHistory = row.lifecycle === "history" && (canManage || canOverride);
  const fileKind: "proposalDoc" | "attachment" =
    row.category === "proposalDoc" ? "proposalDoc" : "attachment";
  if (row.lifecycle === "history" && !(includeHistory && canRestoreHistory)) {
    return null;
  }
  return {
    attachmentId: String(row._id),
    canDelete: row.lifecycle !== "deleted" && canManage,
    canEditNote: row.lifecycle === "active" && canManage,
    canRestore,
    canRestoreHistory,
    category: row.category,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    deletedAt: row.deletedAt,
    fileKind,
    fileName: row.fileName,
    fileSize: row.fileSize,
    id: String(row._id),
    lifecycle: row.lifecycle,
    mimeType: row.mimeType,
    note: row.note,
    readOnly: !canManage,
    sourceCode: row.sourceCode,
    sourceId: row.sourceId,
    sourceLabel: row.sourceLabel,
    sourceType: row.sourceType,
    teamArea: row.teamArea,
    teamLabel: teamAreaLabel(row.teamArea),
    uploaderTeam: row.uploaderTeam,
  };
}

function rowFromLegacy(
  file: {
    createdAt: number;
    createdBy: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    id: string;
    storageId: string;
    category: CommercialFileCategory;
  },
  source: SourceDescriptor,
  access: PortalAccess
) {
  const teamArea = defaultTeamAreaForSource(source.sourceType);
  const canManage = sourceCanManage(access, source, teamArea);
  return {
    attachmentId: file.id,
    canDelete: canManage,
    canEditNote: canManage,
    canRestore: false,
    canRestoreHistory: false,
    category: file.category,
    createdAt: file.createdAt,
    createdBy: file.createdBy,
    fileKind: file.category === "proposalDoc" ? ("proposalDoc" as const) : ("attachment" as const),
    fileName: file.fileName,
    fileSize: file.fileSize,
    id: file.id,
    lifecycle: "active" as const,
    mimeType: file.mimeType,
    note: undefined,
    readOnly: !canManage,
    sourceCode: source.code,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceType: source.sourceType,
    teamArea,
    teamLabel: teamAreaLabel(teamArea),
    uploaderTeam: teamAreaLabel(teamArea),
  };
}

async function legacyRowsForSource(ctx: QueryCtx, source: SourceDescriptor) {
  if (source.sourceType === "query") {
    const rows = await ctx.db
      .query("queryAttachments")
      .withIndex("by_queryId_createdAt", (q) => q.eq("queryId", source.query._id))
      .collect();
    return rows.map((row) => ({
      category: "workingFile" as const,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      fileName: row.fileName,
      fileSize: row.fileSize,
      id: `legacy-query:${row._id}`,
      mimeType: row.mimeType,
      storageId: String(row.storageId),
    }));
  }
  if (source.sourceType === "proposal") {
    const rows = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", source.proposal._id))
      .collect();
    const files: Array<{
      category: CommercialFileCategory;
      createdAt: number;
      createdBy: string;
      fileName: string;
      fileSize: number;
      id: string;
      mimeType: string;
      storageId: string;
    }> = rows.map((row) => ({
      category: "workingFile" as const,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      fileName: row.fileName,
      fileSize: row.fileSize,
      id: `legacy-proposal:${row._id}`,
      mimeType: row.mimeType,
      storageId: String(row.storageId),
    }));
    if (source.proposal.finalizedPdfStorageId && source.proposal.finalizedPdfFileName) {
      files.push({
        category: "proposalDoc" as const,
        createdAt: source.proposal.finalizedPdfUploadedAt ?? source.proposal.updatedAt,
        createdBy: source.proposal.finalizedPdfUploadedBy ?? source.proposal.createdBy,
        fileName: source.proposal.finalizedPdfFileName,
        fileSize: 0,
        id: `legacy-proposal-doc:${source.proposal._id}`,
        mimeType: "application/pdf",
        storageId: String(source.proposal.finalizedPdfStorageId),
      });
    }
    return files;
  }
  return [];
}

async function registryRowsForSource(ctx: QueryCtx, source: SourceDescriptor) {
  return await ctx.db
    .query("commercialFiles")
    .withIndex("by_source", (q) => q.eq("sourceType", source.sourceType).eq("sourceId", source.id))
    .collect();
}

function sourceForFileRow(ctx: QueryCtx | MutationCtx, row: Doc<"commercialFiles">) {
  return descriptorForSource(ctx, row.sourceType, row.sourceId);
}

function sourceReference(
  source: SourceDescriptor,
  args: {
    category: CommercialFileCategory;
    fileName: string;
    fileSize: number;
    mimeType: string;
    note?: string;
    storageId: Id<"_storage">;
    teamArea: CommercialFileTeamArea;
    createdBy: string;
    uploaderTeam: string;
  },
  timestamp: number
) {
  return {
    category: args.category,
    createdAt: timestamp,
    createdBy: args.createdBy,
    fileName: args.fileName,
    fileSize: args.fileSize,
    jobCardId: source.sourceType === "jobCard" ? source.jobCard._id : undefined,
    lifecycle: "active" as const,
    mimeType: args.mimeType,
    note: args.note?.trim() || undefined,
    proposalId: source.sourceType === "proposal" ? source.proposal._id : undefined,
    queryId: source.sourceType === "query" ? source.query._id : undefined,
    sourceCode: source.code,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceType: source.sourceType,
    storageId: args.storageId,
    teamArea: args.teamArea,
    updatedAt: timestamp,
    uploaderTeam: args.uploaderTeam,
  };
}

async function archiveCurrentProposalDoc(
  ctx: MutationCtx,
  source: Extract<SourceDescriptor, { sourceType: "proposal" }>,
  timestamp: number,
  access?: PortalAccess
) {
  const currentStorageId = source.proposal.finalizedPdfStorageId;
  if (!(currentStorageId && source.proposal.finalizedPdfFileName)) {
    return;
  }
  const existing = await ctx.db
    .query("commercialFiles")
    .withIndex("by_proposal_lifecycle", (q) =>
      q.eq("proposalId", source.proposal._id).eq("lifecycle", "active")
    )
    .collect();
  const active = existing.find(
    (row) => String(row.storageId) === String(currentStorageId) && row.category === "proposalDoc"
  );
  if (active) {
    await ctx.db.patch(active._id, { lifecycle: "history", updatedAt: timestamp });
    if (access) {
      await createActivity(ctx, access, {
        action: "proposal_doc_history_created",
        entityId: source.id,
        entityType: "proposal",
        message: `${active.fileName} moved to Proposal Doc History`,
        metadata: { fileId: String(active._id) },
      });
    }
    return;
  }
  const historyId = await ctx.db.insert(
    "commercialFiles",
    sourceReference(
      source,
      {
        category: "proposalDoc",
        createdBy: source.proposal.finalizedPdfUploadedBy ?? source.proposal.createdBy,
        fileName: source.proposal.finalizedPdfFileName,
        fileSize: 0,
        mimeType: "application/pdf",
        storageId: currentStorageId,
        teamArea: "contracting",
        uploaderTeam: "Contracting",
      },
      source.proposal.finalizedPdfUploadedAt ?? timestamp
    )
  );
  await ctx.db.patch(historyId, { lifecycle: "history", updatedAt: timestamp });
  if (access) {
    await createActivity(ctx, access, {
      action: "proposal_doc_history_created",
      entityId: source.id,
      entityType: "proposal",
      message: `${source.proposal.finalizedPdfFileName} moved to Proposal Doc History`,
      metadata: { fileId: String(historyId) },
    });
  }
}

async function materializeLegacyFile(
  ctx: MutationCtx,
  access: PortalAccess,
  fileId: string,
  timestamp: number
) {
  const parsed = parseLegacyFileId(fileId);
  if (!parsed) {
    return ctx.db.normalizeId("commercialFiles", fileId);
  }
  if (parsed.kind === "query") {
    const attachmentId = ctx.db.normalizeId("queryAttachments", parsed.id);
    const row = attachmentId ? await ctx.db.get(attachmentId) : null;
    const source = row ? await descriptorForSource(ctx, "query", String(row.queryId)) : null;
    if (!(row && source && sourceCanManage(access, source, "sales"))) {
      throw new ConvexError("FORBIDDEN");
    }
    const id = await ctx.db.insert(
      "commercialFiles",
      sourceReference(
        source,
        {
          category: "workingFile",
          createdBy: row.createdBy,
          fileName: row.fileName,
          fileSize: row.fileSize,
          mimeType: row.mimeType,
          storageId: row.storageId,
          teamArea: "sales",
          uploaderTeam: "Sales",
        },
        row.createdAt
      )
    );
    await ctx.db.delete(row._id);
    return id;
  }
  if (parsed.kind === "proposal") {
    const attachmentId = ctx.db.normalizeId("proposalAttachments", parsed.id);
    const row = attachmentId ? await ctx.db.get(attachmentId) : null;
    const source = row ? await descriptorForSource(ctx, "proposal", String(row.proposalId)) : null;
    const teamArea = "contracting" as const;
    if (!(row && source && sourceCanManage(access, source, teamArea))) {
      throw new ConvexError("FORBIDDEN");
    }
    const id = await ctx.db.insert(
      "commercialFiles",
      sourceReference(
        source,
        {
          category: "workingFile",
          createdBy: row.createdBy,
          fileName: row.fileName,
          fileSize: row.fileSize,
          mimeType: row.mimeType,
          storageId: row.storageId,
          teamArea,
          uploaderTeam: "Contracting",
        },
        row.createdAt
      )
    );
    await ctx.db.delete(row._id);
    return id;
  }
  const proposalId = ctx.db.normalizeId("proposals", parsed.id);
  const proposal = proposalId ? await ctx.db.get(proposalId) : null;
  const source = proposal ? await descriptorForSource(ctx, "proposal", String(proposal._id)) : null;
  if (!(proposal && source && sourceCanManage(access, source, "contracting"))) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(proposal.finalizedPdfStorageId && proposal.finalizedPdfFileName)) {
    throw new ConvexError("Proposal document not found");
  }
  const id = await ctx.db.insert(
    "commercialFiles",
    sourceReference(
      source,
      {
        category: "proposalDoc",
        createdBy: proposal.finalizedPdfUploadedBy ?? proposal.createdBy,
        fileName: proposal.finalizedPdfFileName,
        fileSize: 0,
        mimeType: "application/pdf",
        storageId: proposal.finalizedPdfStorageId,
        teamArea: "contracting",
        uploaderTeam: "Contracting",
      },
      proposal.finalizedPdfUploadedAt ?? timestamp
    )
  );
  return id;
}

export async function listCommercialFiles(
  ctx: QueryCtx,
  access: PortalAccess,
  args: {
    category?: CommercialFileCategory;
    cursor?: string;
    entryPoint: CommercialFileSourceType;
    entityId: string;
    includeDeleted?: boolean;
    includeHistory?: boolean;
    limit?: number;
    search?: string;
    sourceId?: string;
    sourceType?: CommercialFileSourceType;
    teamArea?: CommercialFileTeamArea;
  }
) {
  const authorized = await authorizeEntryPoint(ctx, access, args.entryPoint, args.entityId);
  if (!authorized) {
    return {
      items: [],
      nextCursor: null,
      sourceOptions: [],
      total: 0,
      writableSources: [],
    };
  }
  const sources = await chainSources(ctx, args.entryPoint, args.entityId);
  const writableSources = sources
    .map((source) => sourceOption(access, source))
    .filter((option) => option.teamAreas.length > 0);
  const sourceOptions = sources.map((source) => ({
    code: source.code,
    id: source.id,
    label: source.label,
    sourceType: source.sourceType,
    teamAreas: [],
  }));

  const registryRows: Array<{ row: Doc<"commercialFiles">; source: SourceDescriptor }> = [];
  const legacyRows: Array<{
    file: Awaited<ReturnType<typeof legacyRowsForSource>>[number];
    source: SourceDescriptor;
  }> = [];
  for (const source of sources) {
    for (const row of await registryRowsForSource(ctx, source)) {
      registryRows.push({ row, source });
    }
    for (const file of await legacyRowsForSource(ctx, source)) {
      legacyRows.push({ file, source });
    }
  }
  const registryStorageIds = new Set(registryRows.map(({ row }) => String(row.storageId)));
  const rows = [
    ...registryRows.flatMap(({ row, source }) => {
      if (row.lifecycle === "deleted" && !args.includeDeleted) {
        return [];
      }
      if (row.lifecycle === "history" && !args.includeHistory) {
        return [];
      }
      const mapped = rowFromRegistry(row, access, source, Boolean(args.includeHistory));
      if (!mapped || (row.lifecycle === "deleted" && !mapped.canRestore)) {
        return [];
      }
      return [mapped];
    }),
    ...legacyRows
      .filter(({ file }) => !registryStorageIds.has(file.storageId))
      .map(({ file, source }) => rowFromLegacy(file, source, access)),
  ]
    .filter((row) => {
      if (args.category && row.category !== args.category) {
        return false;
      }
      if (args.sourceType && row.sourceType !== args.sourceType) {
        return false;
      }
      if (args.sourceId && row.sourceId !== args.sourceId) {
        return false;
      }
      if (args.teamArea && row.teamArea !== args.teamArea) {
        return false;
      }
      const search = args.search?.trim().toLowerCase();
      return (
        !search ||
        [row.fileName, row.note, row.sourceLabel, row.teamLabel, row.uploaderTeam]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      );
    })
    .sort(
      (left, right) =>
        right.createdAt - left.createdAt || left.fileName.localeCompare(right.fileName)
    );

  const offset = decodeCursor(args.cursor);
  const limit = clampPageSize(args.limit);
  const page = rows.slice(offset, offset + limit);
  return {
    items: page,
    nextCursor: offset + limit < rows.length ? encodeCursor(offset + limit) : null,
    sourceOptions,
    total: rows.length,
    writableSources,
  };
}

export const listForEntryPoint = query({
  args: {
    category: v.optional(categoryValidator),
    cursor: v.optional(v.string()),
    entityId: v.string(),
    entryPoint: sourceTypeValidator,
    includeDeleted: v.optional(v.boolean()),
    includeHistory: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    sourceType: v.optional(sourceTypeValidator),
    teamArea: v.optional(teamAreaValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    return await listCommercialFiles(ctx, access, args);
  },
  returns: listResultValidator,
});

export const getDownloadRecord = query({
  args: { fileId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    if (isLegacyFileId(args.fileId)) {
      return null;
    }
    const id = ctx.db.normalizeId("commercialFiles", args.fileId);
    const row = id ? await ctx.db.get(id) : null;
    if (!row || row.lifecycle === "deleted") {
      return null;
    }
    const source = await sourceForFileRow(ctx, row);
    if (!(source && (await canReadFileThroughChain(ctx, access, source)))) {
      return null;
    }
    if (
      row.lifecycle === "history" &&
      !(sourceCanManage(access, source, row.teamArea) || shouldAllowHistoryOverride(access))
    ) {
      return null;
    }
    return {
      fileName: row.fileName,
      id: row._id,
      mimeType: row.mimeType,
      storageId: row.storageId,
    };
  },
  returns: v.union(
    v.object({
      fileName: v.string(),
      id: v.id("commercialFiles"),
      mimeType: v.string(),
      storageId: v.id("_storage"),
    }),
    v.null()
  ),
});

export const createUploadSession = internalMutation({
  args: {
    authUserId: v.string(),
    category: categoryValidator,
    sourceId: v.string(),
    sourceType: sourceTypeValidator,
    teamArea: teamAreaValidator,
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("commercialFileUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (existing) {
      throw new ConvexError("Upload session already exists");
    }
    const now = Date.now();
    await ctx.db.insert("commercialFileUploadSessions", {
      authUserId: args.authUserId,
      category: args.category,
      createdAt: now,
      expiresAt: now + UPLOAD_SESSION_TTL_MS,
      sourceId: args.sourceId,
      sourceType: args.sourceType,
      teamArea: args.teamArea,
      token: args.token,
    });
    return { success: true };
  },
});

export const claimUploadSession = internalMutation({
  args: {
    accessAuthUserId: v.string(),
    category: categoryValidator,
    sourceId: v.string(),
    sourceType: sourceTypeValidator,
    storageId: v.id("_storage"),
    teamArea: teamAreaValidator,
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("commercialFileUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (
      !session ||
      session.usedAt ||
      session.expiresAt <= Date.now() ||
      session.authUserId !== args.accessAuthUserId ||
      session.category !== args.category ||
      session.sourceId !== args.sourceId ||
      session.sourceType !== args.sourceType ||
      session.teamArea !== args.teamArea
    ) {
      throw new ConvexError("Upload session is invalid or expired");
    }
    await ctx.db.patch(session._id, { storageId: args.storageId, usedAt: Date.now() });
    return { success: true };
  },
});

export const createFile = internalMutation({
  args: {
    accessAuthUserId: v.string(),
    accessEmail: v.string(),
    accessName: v.string(),
    accessPermissions: v.array(v.string()),
    accessRoles: v.array(v.string()),
    accessStaffId: v.optional(v.string()),
    category: categoryValidator,
    createdBy: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    jobCardId: v.optional(v.string()),
    mimeType: v.string(),
    note: v.optional(v.string()),
    proposalId: v.optional(v.string()),
    queryId: v.optional(v.string()),
    sourceId: v.string(),
    sourceType: sourceTypeValidator,
    storageId: v.id("_storage"),
    teamArea: teamAreaValidator,
    uploaderTeam: v.string(),
  },
  handler: async (ctx, args) => {
    const access: PortalAccess = {
      allowed: true,
      authUserId: args.accessAuthUserId,
      email: args.accessEmail,
      name: args.accessName,
      permissions: args.accessPermissions,
      roles: args.accessRoles,
      staffId: args.accessStaffId
        ? (ctx.db.normalizeId("staffUsers", args.accessStaffId) ?? undefined)
        : undefined,
    };
    const source = await descriptorForSource(ctx, args.sourceType, args.sourceId);
    if (
      !(source && sourceCanRead(access, source) && sourceCanManage(access, source, args.teamArea))
    ) {
      throw new ConvexError("FORBIDDEN");
    }
    const existingStorage = await ctx.db
      .query("commercialFiles")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    const [
      legacyQueryAttachment,
      legacyProposalAttachment,
      genericAttachment,
      passportDetail,
      proposalWithPdf,
    ] = await Promise.all([
      ctx.db
        .query("queryAttachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
        .first(),
      ctx.db
        .query("proposalAttachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
        .first(),
      ctx.db
        .query("attachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", String(args.storageId)))
        .first(),
      ctx.db
        .query("passportDetails")
        .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
        .first(),
      ctx.db
        .query("proposals")
        .withIndex("by_finalizedPdfStorageId", (q) => q.eq("finalizedPdfStorageId", args.storageId))
        .first(),
    ]);
    if (
      existingStorage ||
      legacyQueryAttachment ||
      legacyProposalAttachment ||
      genericAttachment ||
      passportDetail ||
      proposalWithPdf ||
      (source.sourceType === "proposal" &&
        String(source.proposal.finalizedPdfStorageId) === String(args.storageId))
    ) {
      throw new ConvexError("This upload is already attached to a Commercial File");
    }
    if (args.category === "proposalDoc" && args.sourceType !== "proposal") {
      throw new ConvexError("Proposal Docs must belong to a Proposal");
    }
    if (args.category === "proposalDoc" && args.teamArea !== "contracting") {
      throw new ConvexError("Proposal Docs can only be uploaded to the Contracting Team File Area");
    }
    const timestamp = Date.now();
    if (args.category === "proposalDoc" && source.sourceType === "proposal") {
      await archiveCurrentProposalDoc(ctx, source, timestamp, access);
    }
    const id = await ctx.db.insert(
      "commercialFiles",
      sourceReference(
        source,
        {
          category: args.category,
          createdBy: args.createdBy,
          fileName: args.fileName,
          fileSize: args.fileSize,
          mimeType: args.mimeType,
          note: args.note,
          storageId: args.storageId,
          teamArea: args.teamArea,
          uploaderTeam: args.uploaderTeam,
        },
        timestamp
      )
    );
    if (source.sourceType === "proposal" && args.category === "proposalDoc") {
      await ctx.db.patch(source.proposal._id, {
        finalizedPdfFileName: args.fileName,
        finalizedPdfStorageId: args.storageId,
        finalizedPdfUploadedAt: timestamp,
        finalizedPdfUploadedBy: args.createdBy,
      });
    }
    await createActivity(ctx, access, {
      action: "commercial_file_uploaded",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${args.fileName} uploaded to ${source.label}`,
      metadata: { category: args.category, teamArea: args.teamArea },
    });
    return { id };
  },
});

async function loadMutableFile(ctx: MutationCtx, access: PortalAccess, fileId: string) {
  const timestamp = Date.now();
  const id = await materializeLegacyFile(ctx, access, fileId, timestamp);
  const row = id ? await ctx.db.get(id) : null;
  if (!row) {
    throw new ConvexError("Commercial file not found");
  }
  const source = await sourceForFileRow(ctx, row);
  if (!source) {
    throw new ConvexError("Commercial file source not found");
  }
  if (!sourceCanRead(access, source)) {
    throw new ConvexError("FORBIDDEN");
  }
  return { row, source, timestamp };
}

export const updateNote = mutationWithAccess({
  args: { fileId: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args, access) => {
    const { row, source, timestamp } = await loadMutableFile(ctx, access, args.fileId);
    if (!sourceCanManage(access, source, row.teamArea) || row.lifecycle !== "active") {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch(row._id, { note: args.note?.trim() || undefined, updatedAt: timestamp });
    await createActivity(ctx, access, {
      action: "commercial_file_note_updated",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${row.fileName} note updated`,
      metadata: { fileId: String(row._id) },
    });
    return { success: true };
  },
});

export const deleteFile = mutationWithAccess({
  args: { fileId: v.string() },
  handler: async (ctx, args, access) => {
    const { row, source, timestamp } = await loadMutableFile(ctx, access, args.fileId);
    if (!sourceCanManage(access, source, row.teamArea) || row.lifecycle === "deleted") {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch(row._id, {
      deletedAt: timestamp,
      deletedBy: access.authUserId ?? access.email,
      lifecycle: "deleted",
      priorLifecycle: row.lifecycle,
      purgeAfter: timestamp + COMMERCIAL_FILE_RETENTION_MS,
      updatedAt: timestamp,
    });
    if (
      row.category === "proposalDoc" &&
      source.sourceType === "proposal" &&
      String(source.proposal.finalizedPdfStorageId) === String(row.storageId)
    ) {
      await ctx.db.patch(source.proposal._id, {
        finalizedPdfFileName: undefined,
        finalizedPdfStorageId: undefined,
        finalizedPdfUploadedAt: undefined,
        finalizedPdfUploadedBy: undefined,
      });
    }
    await createActivity(ctx, access, {
      action: "commercial_file_deleted",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${row.fileName} moved to Recoverable Deletion`,
      metadata: { fileId: String(row._id), purgeAfter: timestamp + COMMERCIAL_FILE_RETENTION_MS },
    });
    return { success: true };
  },
});

export const deleteCurrentProposalDoc = mutationWithAccess({
  args: { proposalId: v.string() },
  handler: async (ctx, args, access) => {
    const source = await descriptorForSource(ctx, "proposal", args.proposalId);
    if (!(source?.sourceType === "proposal" && sourceCanManage(access, source, "contracting"))) {
      throw new ConvexError("FORBIDDEN");
    }
    const timestamp = Date.now();
    let row = (
      await ctx.db
        .query("commercialFiles")
        .withIndex("by_proposal_lifecycle", (q) =>
          q.eq("proposalId", source.proposal._id).eq("lifecycle", "active")
        )
        .collect()
    ).find((candidate) => candidate.category === "proposalDoc");
    if (!row && source.proposal.finalizedPdfStorageId) {
      const id = await materializeLegacyFile(
        ctx,
        access,
        `legacy-proposal-doc:${source.proposal._id}`,
        timestamp
      );
      row = id ? ((await ctx.db.get(id)) ?? undefined) : undefined;
    }
    if (!row) {
      throw new ConvexError("Proposal document not found");
    }
    await ctx.db.patch(row._id, {
      deletedAt: timestamp,
      deletedBy: access.authUserId ?? access.email,
      lifecycle: "deleted",
      priorLifecycle: "active",
      purgeAfter: timestamp + COMMERCIAL_FILE_RETENTION_MS,
      updatedAt: timestamp,
    });
    await ctx.db.patch(source.proposal._id, {
      finalizedPdfFileName: undefined,
      finalizedPdfStorageId: undefined,
      finalizedPdfUploadedAt: undefined,
      finalizedPdfUploadedBy: undefined,
    });
    await createActivity(ctx, access, {
      action: "commercial_file_deleted",
      entityId: source.id,
      entityType: "proposal",
      message: `${row.fileName} moved to Recoverable Deletion`,
      metadata: { category: "proposalDoc", fileId: String(row._id) },
    });
    return { success: true };
  },
});

export const restoreFile = mutationWithAccess({
  args: { fileId: v.string() },
  handler: async (ctx, args, access) => {
    const id = ctx.db.normalizeId("commercialFiles", args.fileId);
    const row = id ? await ctx.db.get(id) : null;
    if (row?.lifecycle !== "deleted") {
      throw new ConvexError("Deleted commercial file not found");
    }
    const source = await sourceForFileRow(ctx, row);
    if (
      !(
        source &&
        (sourceCanManage(access, source, row.teamArea) || shouldAllowHistoryOverride(access))
      )
    ) {
      throw new ConvexError("FORBIDDEN");
    }
    if (row.purgeAfter && row.purgeAfter <= Date.now()) {
      throw new ConvexError("Recovery window has expired");
    }
    const lifecycle = row.priorLifecycle ?? "active";
    const timestamp = Date.now();
    if (
      row.category === "proposalDoc" &&
      source.sourceType === "proposal" &&
      lifecycle === "active"
    ) {
      await archiveCurrentProposalDoc(ctx, source, timestamp, access);
    }
    await ctx.db.patch(row._id, {
      deletedAt: undefined,
      deletedBy: undefined,
      lifecycle,
      purgeAfter: undefined,
      restoredAt: timestamp,
      updatedAt: timestamp,
    });
    if (
      row.category === "proposalDoc" &&
      source.sourceType === "proposal" &&
      lifecycle === "active"
    ) {
      await ctx.db.patch(source.proposal._id, {
        finalizedPdfFileName: row.fileName,
        finalizedPdfStorageId: row.storageId,
        finalizedPdfUploadedAt: row.createdAt,
        finalizedPdfUploadedBy: row.createdBy,
      });
    }
    await createActivity(ctx, access, {
      action: "commercial_file_restored",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${row.fileName} restored`,
      metadata: { fileId: String(row._id), lifecycle },
    });
    return { success: true };
  },
});

export const restoreProposalHistory = mutationWithAccess({
  args: { fileId: v.string() },
  handler: async (ctx, args, access) => {
    const id = ctx.db.normalizeId("commercialFiles", args.fileId);
    const row = id ? await ctx.db.get(id) : null;
    if (!(row && row.lifecycle === "history" && row.category === "proposalDoc" && row.proposalId)) {
      throw new ConvexError("Proposal history entry not found");
    }
    const source = await descriptorForSource(ctx, "proposal", String(row.proposalId));
    const proposalSource = source?.sourceType === "proposal" ? source : null;
    if (
      !(
        proposalSource &&
        (sourceCanManage(access, proposalSource, row.teamArea) ||
          shouldAllowHistoryOverride(access))
      )
    ) {
      throw new ConvexError("FORBIDDEN");
    }
    const timestamp = Date.now();
    await archiveCurrentProposalDoc(ctx, proposalSource, timestamp, access);
    await ctx.db.patch(row._id, {
      lifecycle: "active",
      restoredAt: timestamp,
      updatedAt: timestamp,
    });
    await ctx.db.patch(proposalSource.proposal._id, {
      finalizedPdfFileName: row.fileName,
      finalizedPdfStorageId: row.storageId,
      finalizedPdfUploadedAt: row.createdAt,
      finalizedPdfUploadedBy: row.createdBy,
    });
    await createActivity(ctx, access, {
      action: "proposal_doc_history_restored",
      entityId: proposalSource.id,
      entityType: "proposal",
      message: `${row.fileName} restored as the active Proposal Doc`,
      metadata: { fileId: String(row._id) },
    });
    return { success: true };
  },
});

export const markFilesDeletedForSource = internalMutation({
  args: { sourceId: v.string(), sourceType: sourceTypeValidator },
  handler: async (ctx, args) => {
    const now = Date.now();
    const source = await descriptorForSource(ctx, args.sourceType, args.sourceId);
    if (!source) {
      return { count: 0 };
    }
    const touchedFiles: Array<{ fileId: string; fileName: string }> = [];
    const rows = await ctx.db
      .query("commercialFiles")
      .withIndex("by_source", (q) =>
        q.eq("sourceType", args.sourceType).eq("sourceId", args.sourceId)
      )
      .collect();
    const storageIds = new Set(rows.map((row) => String(row.storageId)));

    if (source.sourceType === "query") {
      const legacyRows = await ctx.db
        .query("queryAttachments")
        .withIndex("by_queryId", (q) => q.eq("queryId", source.query._id))
        .collect();
      for (const legacy of legacyRows) {
        if (storageIds.has(String(legacy.storageId))) {
          continue;
        }
        const fileId = await ctx.db.insert("commercialFiles", {
          ...sourceReference(
            source,
            {
              category: "workingFile",
              createdBy: legacy.createdBy,
              fileName: legacy.fileName,
              fileSize: legacy.fileSize,
              mimeType: legacy.mimeType,
              storageId: legacy.storageId,
              teamArea: "sales",
              uploaderTeam: "Sales",
            },
            legacy.createdAt
          ),
          deletedAt: now,
          lifecycle: "deleted",
          priorLifecycle: "active",
          purgeAfter: now + COMMERCIAL_FILE_RETENTION_MS,
        });
        touchedFiles.push({ fileId: String(fileId), fileName: legacy.fileName });
        storageIds.add(String(legacy.storageId));
      }
    }

    if (source.sourceType === "proposal") {
      const legacyRows = await ctx.db
        .query("proposalAttachments")
        .withIndex("by_proposalId", (q) => q.eq("proposalId", source.proposal._id))
        .collect();
      for (const legacy of legacyRows) {
        if (storageIds.has(String(legacy.storageId))) {
          continue;
        }
        const fileId = await ctx.db.insert("commercialFiles", {
          ...sourceReference(
            source,
            {
              category: "workingFile",
              createdBy: legacy.createdBy,
              fileName: legacy.fileName,
              fileSize: legacy.fileSize,
              mimeType: legacy.mimeType,
              storageId: legacy.storageId,
              teamArea: "contracting",
              uploaderTeam: "Contracting",
            },
            legacy.createdAt
          ),
          deletedAt: now,
          lifecycle: "deleted",
          priorLifecycle: "active",
          purgeAfter: now + COMMERCIAL_FILE_RETENTION_MS,
        });
        touchedFiles.push({ fileId: String(fileId), fileName: legacy.fileName });
        storageIds.add(String(legacy.storageId));
      }
      if (
        source.proposal.finalizedPdfStorageId &&
        source.proposal.finalizedPdfFileName &&
        !storageIds.has(String(source.proposal.finalizedPdfStorageId))
      ) {
        const fileId = await ctx.db.insert("commercialFiles", {
          ...sourceReference(
            source,
            {
              category: "proposalDoc",
              createdBy: source.proposal.finalizedPdfUploadedBy ?? source.proposal.createdBy,
              fileName: source.proposal.finalizedPdfFileName,
              fileSize: 0,
              mimeType: "application/pdf",
              storageId: source.proposal.finalizedPdfStorageId,
              teamArea: "contracting",
              uploaderTeam: "Contracting",
            },
            source.proposal.finalizedPdfUploadedAt ?? now
          ),
          deletedAt: now,
          lifecycle: "deleted",
          priorLifecycle: "active",
          purgeAfter: now + COMMERCIAL_FILE_RETENTION_MS,
        });
        touchedFiles.push({
          fileId: String(fileId),
          fileName: source.proposal.finalizedPdfFileName,
        });
        storageIds.add(String(source.proposal.finalizedPdfStorageId));
      }
    }

    const currentRows = await ctx.db
      .query("commercialFiles")
      .withIndex("by_source", (q) =>
        q.eq("sourceType", args.sourceType).eq("sourceId", args.sourceId)
      )
      .collect();
    for (const row of currentRows) {
      if (row.lifecycle === "active" || row.lifecycle === "history") {
        await ctx.db.patch(row._id, {
          deletedAt: now,
          lifecycle: "deleted",
          priorLifecycle: row.lifecycle,
          purgeAfter: now + COMMERCIAL_FILE_RETENTION_MS,
          updatedAt: now,
        });
        touchedFiles.push({ fileId: String(row._id), fileName: row.fileName });
      }
    }
    if (touchedFiles.length > 0) {
      await ctx.db.insert("activityLogs", {
        action: "commercial_files_source_deleted",
        actorId: "system",
        actorName: "System",
        createdAt: now,
        entityId: args.sourceId,
        entityType: args.sourceType,
        message: `${touchedFiles.length} Commercial Files moved to Recoverable Deletion with ${source.label}`,
        metadata: {
          fileIds: touchedFiles.map((file) => file.fileId),
          fileNames: touchedFiles.map((file) => file.fileName),
          purgeAfter: now + COMMERCIAL_FILE_RETENTION_MS,
        },
      });
    }
    return { count: touchedFiles.length };
  },
});

export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("commercialFiles")
      .withIndex("by_purgeAfter", (q) => q.lt("purgeAfter", now))
      .collect();
    if (!rows.length) {
      return { purged: 0 };
    }
    const purgedRows: Doc<"commercialFiles">[] = [];
    for (const row of rows) {
      let storageGone = false;
      try {
        await ctx.storage.delete(row.storageId);
        storageGone = true;
      } catch (error) {
        console.error("Failed to purge commercial file storage; leaving it for retry:", error);
      }
      if (!storageGone) {
        continue;
      }
      try {
        await ctx.db.delete(row._id);
        purgedRows.push(row);
      } catch (error) {
        console.error("Failed to purge commercial file metadata; leaving it for retry:", error);
      }
    }
    if (!purgedRows.length) {
      return { purged: 0 };
    }
    await ctx.db.insert("activityLogs", {
      action: "commercial_files_purged",
      actorId: "system",
      actorName: "System",
      createdAt: now,
      entityType: "commercialFiles",
      message: `${purgedRows.length} Commercial Files permanently purged after the recovery window`,
      metadata: {
        fileIds: purgedRows.map((row) => String(row._id)),
        fileNames: purgedRows.map((row) => row.fileName),
        files: purgedRows.map((row) => ({
          category: row.category,
          fileId: String(row._id),
          fileName: row.fileName,
          sourceId: row.sourceId,
          sourceType: row.sourceType,
        })),
      },
    });
    return { purged: purgedRows.length };
  },
});

type MutationHandler<TResult> = (
  ctx: MutationCtx,
  args: any,
  access: PortalAccess
) => Promise<TResult>;

function mutationWithAccess<TResult>(config: { args: any; handler: MutationHandler<TResult> }) {
  return mutation({
    args: config.args,
    handler: async (ctx, args) => {
      const access = await getPortalAccess(ctx);
      if (!access.allowed) {
        throw new ConvexError("FORBIDDEN");
      }
      return await config.handler(ctx, args, access);
    },
  });
}
