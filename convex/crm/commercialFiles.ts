import {
  ConvexError,
  type GenericValidator,
  type Infer,
  type JSONValue,
  type ObjectType,
  type PropertyValidators,
  v,
} from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "../_generated/server";
import { isRuntimeNumber, isRuntimeObject, isRuntimeString } from "../lib/runtimeValues";
import { resolveCommercialFileChainKey } from "./commercialFileChainIdentity";
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
import {
  continuePurgeExpiredHandler,
  getPurgeStatusHandler,
  purgeExpiredHandler,
  purgeRunResultValidator,
} from "./commercialFilePurge";
import { resolveCommercialChain } from "./commercialRecordChainReads";
import { COMMERCIAL_SOURCE_DELETION_BLOCKED_MESSAGE } from "./commercialSourceCustody";
import {
  invalidateDocumentPreviewSource,
  scheduleDocumentPreviewPreparation,
} from "./documentPreviewLifecycle";
import { scheduleCrmMetricSync } from "./financeMetricSync";
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
import {
  deleteProposalAttachmentCompatibility,
  saveProposalAttachmentCompatibility,
} from "./proposalAttachments";
import {
  deleteQueryAttachmentCompatibility,
  saveQueryAttachmentCompatibility,
} from "./queryAttachments";
import { enqueueProposalQueryCommercialProjections } from "./queryCommercialProjection";

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 25;
const UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;

const sourceTypeValidator = v.union(
  v.literal("query" as const),
  v.literal("proposal" as const),
  v.literal("jobCard")
);
const categoryValidator = v.union(
  v.literal("workingFile" as const),
  v.literal("proposalDoc" as const)
);
const teamAreaValidator = v.union(
  v.literal("sales"),
  v.literal("contracting" as const),
  v.literal("ticketing"),
  v.literal("accounts"),
  v.literal("operations"),
  v.literal("tourManager")
);
const successResultValidator = v.object({ success: v.literal(true as const) });
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
  fileKind: v.union(v.literal("attachment" as const), v.literal("proposalDoc" as const)),
  fileName: v.string(),
  fileSize: v.number(),
  id: v.string(),
  lifecycle: v.union(v.literal("active" as const), v.literal("history"), v.literal("deleted")),
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
type CommercialFilePresentedRow = Infer<typeof commercialFileRowValidator>;

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
      chainKey: string;
      code: string;
      id: string;
      label: string;
      linkedQueries: QueryRow[];
      query: QueryRow;
      sourceType: "query";
    }
  | {
      chainKey: string;
      code: string;
      id: string;
      label: string;
      linkedQueries: QueryRow[];
      proposal: ProposalRow;
      sourceType: "proposal";
    }
  | {
      chainKey: string;
      code: string;
      id: string;
      jobCard: JobCardRow;
      label: string;
      linkedQuery?: QueryRow;
      linkedQueries: QueryRow[];
      sourceType: "jobCard";
    };

function clampPageSize(value?: number) {
  return Math.min(Math.max(Math.floor(value ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
}

interface CommercialFileListCursor {
  databaseCursor: string | null;
  emitted: number;
  signature: string;
  streamKey: string;
  version: 1;
}

const COMMERCIAL_FILE_CURSOR_PREFIX = "commercial-file-v1:";

function encodeCursor(cursor: CommercialFileListCursor) {
  return `${COMMERCIAL_FILE_CURSOR_PREFIX}${encodeURIComponent(JSON.stringify(cursor))}`;
}

function parseCommercialFileCursorPayload(encoded: string) {
  try {
    // SAFETY: JSON.parse can only produce the JSONValue grammar; the cursor
    // contract below rejects every field outside its exact runtime shape.
    return JSON.parse(decodeURIComponent(encoded)) as JSONValue;
  } catch {
    return null;
  }
}

function decodeCursor(cursor: string | undefined, signature: string) {
  if (!cursor) {
    return null;
  }
  if (!cursor.startsWith(COMMERCIAL_FILE_CURSOR_PREFIX)) {
    throw new ConvexError("Commercial File cursor is no longer valid");
  }
  const parsed = parseCommercialFileCursorPayload(
    cursor.slice(COMMERCIAL_FILE_CURSOR_PREFIX.length)
  );
  if (
    !isRuntimeObject(parsed) ||
    Array.isArray(parsed) ||
    parsed.version !== 1 ||
    parsed.signature !== signature ||
    !isRuntimeString(parsed.streamKey) ||
    !(parsed.databaseCursor === null || isRuntimeString(parsed.databaseCursor)) ||
    !isRuntimeNumber(parsed.emitted) ||
    !Number.isSafeInteger(parsed.emitted) ||
    parsed.emitted < 0
  ) {
    throw new ConvexError("Commercial File cursor is no longer valid");
  }
  return {
    databaseCursor: parsed.databaseCursor,
    emitted: parsed.emitted,
    signature,
    streamKey: parsed.streamKey,
    version: 1,
  };
}

async function commercialFileCreatorName(ctx: QueryCtx, createdBy: string) {
  const reference = createdBy.trim();
  if (!reference) {
    return "Unknown team member";
  }
  const byAuthUserId = await ctx.db
    .query("staffUsers")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", reference))
    .unique();
  if (byAuthUserId?.name.trim()) {
    return byAuthUserId.name.trim();
  }
  const [canonicalLinks, legacyLinks] = await Promise.all([
    ctx.db
      .query("authIdentityLinks")
      .withIndex("by_canonicalAuthUserId", (q) => q.eq("canonicalAuthUserId", reference))
      .take(3),
    ctx.db
      .query("authIdentityLinks")
      .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", reference))
      .take(3),
  ]);
  const identityLinks = Array.from(
    new Map(
      [...canonicalLinks, ...legacyLinks].map((link) => [String(link._id), link] as const)
    ).values()
  );
  const linkedAliases =
    identityLinks.length === 1 && identityLinks[0]?.status === "linked"
      ? [identityLinks[0].canonicalAuthUserId, identityLinks[0].legacyAuthUserId].filter(
          (identityId) => identityId !== reference
        )
      : [];
  if (linkedAliases.length === 1) {
    const byLinkedAuthUserId = await ctx.db
      .query("staffUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", linkedAliases[0]))
      .unique();
    if (byLinkedAuthUserId?.name.trim()) {
      return byLinkedAuthUserId.name.trim();
    }
  }
  if (reference.includes("@")) {
    const byEmail = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", reference.toLowerCase()))
      .unique();
    if (byEmail?.name.trim()) {
      return byEmail.name.trim();
    }
  }
  return "Unknown team member";
}

async function presentCommercialFileCreators<Row extends { createdBy: string }>(
  ctx: QueryCtx,
  rows: Row[]
) {
  const uniqueCreators = [...new Set(rows.map((row) => row.createdBy))];
  const creatorNames = new Map(
    await Promise.all(
      uniqueCreators.map(
        async (createdBy) => [createdBy, await commercialFileCreatorName(ctx, createdBy)] as const
      )
    )
  );
  return rows.map((row) => ({
    ...row,
    createdBy: creatorNames.get(row.createdBy) ?? row.createdBy,
  }));
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
    const payload = fileId.slice("legacy-proposal-doc:".length);
    const versionSeparator = payload.indexOf(":");
    if (versionSeparator <= 0 || versionSeparator >= payload.length - 1) {
      return null;
    }
    return {
      id: payload.slice(0, versionSeparator),
      kind: "proposalDoc" as const,
      storageId: payload.slice(versionSeparator + 1),
    };
  }
  return null;
}

async function descriptorForProposalSource(
  ctx: QueryCtx | MutationCtx,
  sourceId: string
): Promise<Extract<SourceDescriptor, { sourceType: "proposal" }> | null> {
  const proposalId = ctx.db.normalizeId("proposals", sourceId);
  const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
  if (!proposal) {
    return null;
  }
  const primaryQuery = proposal.queryId ? await ctx.db.get("queries", proposal.queryId) : null;
  return {
    chainKey:
      (await resolveCommercialFileChainKey(ctx, "proposal", sourceId)) ??
      `proposal:${String(proposal._id)}`,
    code: proposal.proposalCode,
    id: String(proposal._id),
    label: `Proposal ${proposal.proposalCode}`,
    linkedQueries: primaryQuery ? [primaryQuery] : [],
    proposal,
    sourceType: "proposal",
  };
}

async function descriptorForSource(
  ctx: QueryCtx | MutationCtx,
  sourceType: CommercialFileSourceType,
  sourceId: string
): Promise<SourceDescriptor | null> {
  if (sourceType === "query") {
    const queryId = ctx.db.normalizeId("queries", sourceId);
    const queryRow = queryId ? await ctx.db.get("queries", queryId) : null;
    return queryRow
      ? {
          chainKey: `query:${String(queryRow._id)}`,
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
    return await descriptorForProposalSource(ctx, sourceId);
  }

  const jobCardId = ctx.db.normalizeId("jobCards", sourceId);
  const jobCard = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
  if (!jobCard) {
    return null;
  }
  const linkedQuery = jobCard.queryId ? await ctx.db.get("queries", jobCard.queryId) : null;
  return {
    chainKey:
      (await resolveCommercialFileChainKey(ctx, sourceType, sourceId)) ??
      `jobCard:${String(jobCard._id)}`,
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
    uploaderTeam: teamAreaLabel(row.teamArea),
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

interface LegacyCommercialFile {
  category: CommercialFileCategory;
  createdAt: number;
  createdBy: string;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  storageId: string;
}

type CommercialFileListStream =
  | { key: string; kind: "registry"; source: SourceDescriptor }
  | { key: string; kind: "legacyQuery"; source: Extract<SourceDescriptor, { sourceType: "query" }> }
  | {
      key: string;
      kind: "legacyProposal";
      source: Extract<SourceDescriptor, { sourceType: "proposal" }>;
    }
  | {
      key: string;
      kind: "legacyProposalDoc";
      source: Extract<SourceDescriptor, { sourceType: "proposal" }>;
    };

function sourceSortKey(source: SourceDescriptor) {
  const sourceOrder = { jobCard: "2", proposal: "1", query: "0" } as const;
  return `${sourceOrder[source.sourceType]}:${source.id}`;
}

function commercialFileListStreams(sources: SourceDescriptor[]) {
  // Keep the pre-cutover registry streams active while the canonical chain
  // index backfills in staged mode and legacy residuals remain non-zero.
  const streams: CommercialFileListStream[] = [];
  const orderedSources = [...sources].sort((left, right) =>
    sourceSortKey(left).localeCompare(sourceSortKey(right))
  );
  for (const source of orderedSources) {
    streams.push({ key: `registry:${source.sourceType}:${source.id}`, kind: "registry", source });
    if (source.sourceType === "query") {
      streams.push({ key: `legacy-query:${source.id}`, kind: "legacyQuery", source });
    } else if (source.sourceType === "proposal") {
      streams.push({ key: `legacy-proposal:${source.id}`, kind: "legacyProposal", source });
      streams.push({ key: `legacy-proposal-doc:${source.id}`, kind: "legacyProposalDoc", source });
    }
  }
  return streams;
}

async function commercialFileStreamHasCandidate(ctx: QueryCtx, stream: CommercialFileListStream) {
  if (stream.kind === "registry") {
    return Boolean(
      await ctx.db
        .query("commercialFiles")
        .withIndex("by_source", (queryBuilder) =>
          queryBuilder.eq("sourceType", stream.source.sourceType).eq("sourceId", stream.source.id)
        )
        .first()
    );
  }
  if (stream.kind === "legacyQuery") {
    return Boolean(
      await ctx.db
        .query("queryAttachments")
        .withIndex("by_queryId_createdAt", (queryBuilder) =>
          queryBuilder.eq("queryId", stream.source.query._id)
        )
        .first()
    );
  }
  if (stream.kind === "legacyProposal") {
    return Boolean(
      await ctx.db
        .query("proposalAttachments")
        .withIndex("by_proposalId_and_createdAt_and_orderId", (queryBuilder) =>
          queryBuilder.eq("proposalId", stream.source.proposal._id)
        )
        .first()
    );
  }
  return Boolean(legacyProposalDoc(stream.source));
}

async function firstPopulatedCommercialFileStream(
  ctx: QueryCtx,
  streams: CommercialFileListStream[]
) {
  const populated = await Promise.all(
    streams.map((stream) => commercialFileStreamHasCandidate(ctx, stream))
  );
  return populated.findIndex(Boolean);
}

function legacyQueryFile(row: Doc<"queryAttachments">): LegacyCommercialFile {
  return {
    category: "workingFile",
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    fileName: row.fileName,
    fileSize: row.fileSize,
    id: `legacy-query:${String(row._id)}`,
    mimeType: row.mimeType,
    storageId: String(row.storageId),
  };
}

function legacyProposalFile(row: Doc<"proposalAttachments">): LegacyCommercialFile {
  return {
    category: "workingFile",
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    fileName: row.fileName,
    fileSize: row.fileSize,
    id: `legacy-proposal:${String(row._id)}`,
    mimeType: row.mimeType,
    storageId: String(row.storageId),
  };
}

function legacyProposalDoc(
  source: Extract<SourceDescriptor, { sourceType: "proposal" }>
): LegacyCommercialFile | null {
  if (!(source.proposal.finalizedPdfStorageId && source.proposal.finalizedPdfFileName)) {
    return null;
  }
  return {
    category: "proposalDoc",
    createdAt: source.proposal.finalizedPdfUploadedAt ?? source.proposal.updatedAt,
    createdBy: source.proposal.finalizedPdfUploadedBy ?? source.proposal.createdBy,
    fileName: source.proposal.finalizedPdfFileName,
    fileSize: 0,
    id: `legacy-proposal-doc:${String(source.proposal._id)}:${String(
      source.proposal.finalizedPdfStorageId
    )}`,
    mimeType: "application/pdf",
    storageId: String(source.proposal.finalizedPdfStorageId),
  };
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
    chainKey: source.chainKey,
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
    await ctx.db.patch("commercialFiles", active._id, {
      lifecycle: "history",
      updatedAt: timestamp,
    });
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
  await ctx.db.patch("commercialFiles", historyId, { lifecycle: "history", updatedAt: timestamp });
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

async function materializeLegacyQueryFile(
  ctx: MutationCtx,
  access: PortalAccess,
  legacyId: string
) {
  const attachmentId = ctx.db.normalizeId("queryAttachments", legacyId);
  const row = attachmentId ? await ctx.db.get("queryAttachments", attachmentId) : null;
  const source = row ? await descriptorForSource(ctx, "query", String(row.queryId)) : null;
  if (!(row && source && sourceCanManage(access, source, "sales"))) {
    throw new ConvexError("FORBIDDEN");
  }
  const existing = await ctx.db
    .query("commercialFiles")
    .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", row.storageId))
    .first();
  if (existing) {
    if (!(existing.sourceType === "query" && existing.sourceId === source.id)) {
      throw new ConvexError("Commercial File storage belongs to another source");
    }
    await ctx.db.patch("commercialFiles", existing._id, {
      compatibilitySourceId: String(row._id),
      compatibilitySourceType: "queryAttachment",
    });
    return existing._id;
  }
  const id = await ctx.db.insert("commercialFiles", {
    ...sourceReference(
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
    ),
    compatibilitySourceId: String(row._id),
    compatibilitySourceType: "queryAttachment",
  });
  await scheduleDocumentPreviewPreparation(ctx, "commercialFile", String(id));
  return id;
}

async function materializeLegacyProposalAttachment(
  ctx: MutationCtx,
  access: PortalAccess,
  legacyId: string
) {
  const attachmentId = ctx.db.normalizeId("proposalAttachments", legacyId);
  const row = attachmentId ? await ctx.db.get("proposalAttachments", attachmentId) : null;
  const source = row ? await descriptorForSource(ctx, "proposal", String(row.proposalId)) : null;
  const teamArea = "contracting" as const;
  if (!(row && source && sourceCanManage(access, source, teamArea))) {
    throw new ConvexError("FORBIDDEN");
  }
  const existing = await ctx.db
    .query("commercialFiles")
    .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", row.storageId))
    .first();
  if (existing) {
    if (!(existing.sourceType === "proposal" && existing.sourceId === source.id)) {
      throw new ConvexError("Commercial File storage belongs to another source");
    }
    await ctx.db.patch("commercialFiles", existing._id, {
      compatibilitySourceId: String(row._id),
      compatibilitySourceType: "proposalAttachment",
    });
    return existing._id;
  }
  const id = await ctx.db.insert("commercialFiles", {
    ...sourceReference(
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
    ),
    compatibilitySourceId: String(row._id),
    compatibilitySourceType: "proposalAttachment",
  });
  await scheduleDocumentPreviewPreparation(ctx, "commercialFile", String(id));
  return id;
}

async function materializeLegacyProposalDocument(
  ctx: MutationCtx,
  access: PortalAccess,
  legacyId: string,
  expectedStorageId: string,
  timestamp: number
) {
  const proposalId = ctx.db.normalizeId("proposals", legacyId);
  const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
  const source = proposal ? await descriptorForSource(ctx, "proposal", String(proposal._id)) : null;
  if (!(proposal && source && sourceCanManage(access, source, "contracting"))) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(proposal.finalizedPdfStorageId && proposal.finalizedPdfFileName)) {
    throw new ConvexError("Proposal document not found");
  }
  const storageId = proposal.finalizedPdfStorageId;
  if (String(storageId) !== expectedStorageId) {
    throw new ConvexError("Proposal document changed; refresh before trying again");
  }
  const existing = await ctx.db
    .query("commercialFiles")
    .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", storageId))
    .first();
  if (existing) {
    if (
      !(
        existing.sourceType === "proposal" &&
        existing.sourceId === source.id &&
        existing.category === "proposalDoc"
      )
    ) {
      throw new ConvexError("Commercial File storage belongs to another source");
    }
    return existing._id;
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
        storageId,
        teamArea: "contracting",
        uploaderTeam: "Contracting",
      },
      proposal.finalizedPdfUploadedAt ?? timestamp
    )
  );
  await scheduleDocumentPreviewPreparation(ctx, "commercialFile", String(id));
  return id;
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
    return await materializeLegacyQueryFile(ctx, access, parsed.id);
  }
  if (parsed.kind === "proposal") {
    return await materializeLegacyProposalAttachment(ctx, access, parsed.id);
  }
  return await materializeLegacyProposalDocument(
    ctx,
    access,
    parsed.id,
    parsed.storageId,
    timestamp
  );
}

interface CommercialFileListArgs {
  category?: CommercialFileCategory;
  cursor?: string;
  entityId: string;
  entryPoint: CommercialFileSourceType;
  includeDeleted?: boolean;
  includeHistory?: boolean;
  limit?: number;
  linkedOnly?: boolean;
  search?: string;
  sourceId?: string;
  sourceType?: CommercialFileSourceType;
  teamArea?: CommercialFileTeamArea;
}

type CommercialFileListCandidate =
  | {
      kind: "registry";
      row: Doc<"commercialFiles">;
      source: SourceDescriptor;
    }
  | { file: LegacyCommercialFile; kind: "legacy"; source: SourceDescriptor };

interface CommercialFileStreamPage {
  candidates: CommercialFileListCandidate[];
  continueCursor: string | null;
  isDone: boolean;
  scanned: number;
}

function commercialFileCursorSignature(args: CommercialFileListArgs) {
  return JSON.stringify({
    category: args.category ?? null,
    entityId: args.entityId,
    entryPoint: args.entryPoint,
    includeDeleted: Boolean(args.includeDeleted),
    includeHistory: Boolean(args.includeHistory),
    linkedOnly: Boolean(args.linkedOnly),
    search: args.search?.trim().toLowerCase() || null,
    sourceId: args.sourceId ?? null,
    sourceType: args.sourceType ?? null,
    teamArea: args.teamArea ?? null,
  });
}

function commercialFileMatchesFilters(
  row: CommercialFilePresentedRow,
  args: CommercialFileListArgs
) {
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
}

function visibleRegistryRow(
  row: Doc<"commercialFiles">,
  access: PortalAccess,
  source: SourceDescriptor,
  args: CommercialFileListArgs
) {
  if (row.lifecycle === "deleted" && !args.includeDeleted) {
    return null;
  }
  if (row.lifecycle === "history" && !args.includeHistory) {
    return null;
  }
  const mapped = rowFromRegistry(row, access, source, Boolean(args.includeHistory));
  if (!mapped || (row.lifecycle === "deleted" && !mapped.canRestore)) {
    return null;
  }
  return commercialFileMatchesFilters(mapped, args) ? mapped : null;
}

async function legacyFileHasRegistryReference(ctx: QueryCtx, file: LegacyCommercialFile) {
  // SAFETY: storage IDs originate from validator-backed legacy attachment rows.
  const storageId = file.storageId as Id<"_storage">;
  return Boolean(
    await ctx.db
      .query("commercialFiles")
      .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", storageId))
      .first()
  );
}

async function loadCommercialFileStreamPage(
  ctx: QueryCtx,
  stream: CommercialFileListStream,
  databaseCursor: string | null,
  numItems: number
): Promise<CommercialFileStreamPage> {
  if (stream.kind === "registry") {
    const page = await ctx.db
      .query("commercialFiles")
      .withIndex("by_source", (queryBuilder) =>
        queryBuilder.eq("sourceType", stream.source.sourceType).eq("sourceId", stream.source.id)
      )
      .order("desc")
      .paginate({ cursor: databaseCursor, numItems });
    return {
      candidates: page.page.map((row) => ({
        kind: "registry" as const,
        row,
        source: stream.source,
      })),
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
    };
  }

  if (stream.kind === "legacyQuery") {
    const page = await ctx.db
      .query("queryAttachments")
      .withIndex("by_queryId_createdAt", (queryBuilder) =>
        queryBuilder.eq("queryId", stream.source.query._id)
      )
      .order("desc")
      .paginate({ cursor: databaseCursor, numItems });
    return {
      candidates: page.page.map((row) => ({
        file: legacyQueryFile(row),
        kind: "legacy" as const,
        source: stream.source,
      })),
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
    };
  }

  if (stream.kind === "legacyProposal") {
    const page = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_proposalId_and_createdAt_and_orderId", (queryBuilder) =>
        queryBuilder.eq("proposalId", stream.source.proposal._id)
      )
      .order("desc")
      .paginate({ cursor: databaseCursor, numItems });
    return {
      candidates: page.page.map((row) => ({
        file: legacyProposalFile(row),
        kind: "legacy" as const,
        source: stream.source,
      })),
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
    };
  }

  const file = legacyProposalDoc(stream.source);
  return {
    candidates: file ? [{ file, kind: "legacy", source: stream.source }] : [],
    continueCursor: null,
    isDone: true,
    scanned: file ? 1 : 0,
  };
}

async function presentCommercialFileCandidates(
  ctx: QueryCtx,
  access: PortalAccess,
  candidates: CommercialFileListCandidate[],
  args: CommercialFileListArgs
) {
  const rows = await Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.kind === "registry") {
        return visibleRegistryRow(candidate.row, access, candidate.source, args);
      }
      if (await legacyFileHasRegistryReference(ctx, candidate.file)) {
        return null;
      }
      const mapped = rowFromLegacy(candidate.file, candidate.source, access);
      return commercialFileMatchesFilters(mapped, args) ? mapped : null;
    })
  );
  return rows.filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function listCommercialFiles(
  ctx: QueryCtx,
  access: PortalAccess,
  args: CommercialFileListArgs
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
  const chain = await chainSources(ctx, args.entryPoint, args.entityId);
  const sources = args.linkedOnly
    ? chain.filter(
        (source) => !(source.sourceType === args.entryPoint && source.id === args.entityId)
      )
    : chain;
  const writableSources = sources.flatMap((source) => {
    const option = sourceOption(access, source);
    return option.teamAreas.length > 0 ? [option] : [];
  });
  const sourceOptions = sources.map((source) => ({
    code: source.code,
    id: source.id,
    label: source.label,
    sourceType: source.sourceType,
    teamAreas: [],
  }));

  const limit = clampPageSize(args.limit);
  const signature = commercialFileCursorSignature(args);
  const streams = commercialFileListStreams(sources);
  const cursor = decodeCursor(args.cursor, signature);
  const streamIndex = cursor
    ? streams.findIndex((candidateStream) => candidateStream.key === cursor.streamKey)
    : await firstPopulatedCommercialFileStream(ctx, streams);
  if (streamIndex < 0) {
    if (cursor) {
      throw new ConvexError("Commercial File cursor no longer matches this record chain");
    }
    return { items: [], nextCursor: null, sourceOptions, total: 0, writableSources };
  }
  const databaseCursor = cursor?.databaseCursor ?? null;
  const emitted = cursor?.emitted ?? 0;
  const stream = streams[streamIndex];
  const page = await loadCommercialFileStreamPage(ctx, stream, databaseCursor, limit);
  const pageRows = await presentCommercialFileCandidates(ctx, access, page.candidates, args);
  const nextStreamIndex = page.isDone ? streamIndex + 1 : streamIndex;
  const nextDatabaseCursor = page.isDone ? null : page.continueCursor;

  const nextCursor =
    nextStreamIndex < streams.length
      ? encodeCursor({
          databaseCursor: nextDatabaseCursor,
          emitted: emitted + pageRows.length,
          signature,
          streamKey: streams[nextStreamIndex].key,
          version: 1,
        })
      : null;
  return {
    items: await presentCommercialFileCreators(ctx, pageRows),
    nextCursor,
    sourceOptions,
    total: emitted + pageRows.length,
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
    linkedOnly: v.optional(v.boolean()),
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

/** Exact write-policy probe for upload actions; it never loads file history. */
export const canUploadToSource = internalQuery({
  args: {
    sourceId: v.string(),
    sourceType: sourceTypeValidator,
    teamArea: teamAreaValidator,
  },
  handler: async (ctx, args) => {
    const access = await getPortalAccess(ctx);
    if (!access.allowed) {
      return false;
    }
    const source = await descriptorForSource(ctx, args.sourceType, args.sourceId);
    return Boolean(source && sourceCanManage(access, source, args.teamArea));
  },
  returns: v.boolean(),
});

const legacyResidualStoreValidator = v.union(
  v.literal("registry"),
  v.literal("queryAttachments"),
  v.literal("proposalAttachments"),
  v.literal("proposalDocuments")
);

const legacyResidualPageValidator = v.object({
  isDone: v.boolean(),
  nextCursor: v.union(v.string(), v.null()),
  residualIds: v.array(v.string()),
  scanned: v.number(),
});

async function missingCanonicalReference(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  sourceType: CommercialFileSourceType,
  sourceId: string
) {
  const [expectedChainKey, registry] = await Promise.all([
    resolveCommercialFileChainKey(ctx, sourceType, sourceId),
    ctx.db
      .query("commercialFiles")
      .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", storageId))
      .first(),
  ]);
  return !(
    expectedChainKey &&
    registry?.chainKey === expectedChainKey &&
    registry.sourceType === sourceType &&
    registry.sourceId === sourceId
  );
}

/**
 * Independent, bounded readiness seam. It reports source identifiers only and
 * never changes target data or marks a cutover ready.
 */
export const verifyLegacyResidualPage = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    store: legacyResidualStoreValidator,
  },
  handler: async (ctx, args) => {
    const numItems = clampPageSize(args.limit);
    if (args.store === "registry") {
      const page = await ctx.db
        .query("commercialFiles")
        .order("asc")
        .paginate({ cursor: args.cursor ?? null, numItems });
      const residualIds = (
        await Promise.all(
          page.page.map(async (row) => {
            const expected = await resolveCommercialFileChainKey(ctx, row.sourceType, row.sourceId);
            return expected && row.chainKey === expected ? null : String(row._id);
          })
        )
      ).filter((id): id is string => id !== null);
      return {
        isDone: page.isDone,
        nextCursor: page.isDone ? null : page.continueCursor,
        residualIds,
        scanned: page.page.length,
      };
    }
    if (args.store === "queryAttachments") {
      const page = await ctx.db
        .query("queryAttachments")
        .order("asc")
        .paginate({ cursor: args.cursor ?? null, numItems });
      const residualIds = (
        await Promise.all(
          page.page.map(async (row) =>
            (await missingCanonicalReference(ctx, row.storageId, "query", String(row.queryId)))
              ? String(row._id)
              : null
          )
        )
      ).filter((id): id is string => id !== null);
      return {
        isDone: page.isDone,
        nextCursor: page.isDone ? null : page.continueCursor,
        residualIds,
        scanned: page.page.length,
      };
    }
    if (args.store === "proposalAttachments") {
      const page = await ctx.db
        .query("proposalAttachments")
        .order("asc")
        .paginate({ cursor: args.cursor ?? null, numItems });
      const residualIds = (
        await Promise.all(
          page.page.map(async (row) =>
            (await missingCanonicalReference(
              ctx,
              row.storageId,
              "proposal",
              String(row.proposalId)
            ))
              ? String(row._id)
              : null
          )
        )
      ).filter((id): id is string => id !== null);
      return {
        isDone: page.isDone,
        nextCursor: page.isDone ? null : page.continueCursor,
        residualIds,
        scanned: page.page.length,
      };
    }
    const page = await ctx.db
      .query("proposals")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems });
    const residualIds = (
      await Promise.all(
        page.page.map(async (proposal) => {
          if (!proposal.finalizedPdfStorageId) {
            return null;
          }
          return (await missingCanonicalReference(
            ctx,
            proposal.finalizedPdfStorageId,
            "proposal",
            String(proposal._id)
          ))
            ? String(proposal._id)
            : null;
        })
      )
    ).filter((id): id is string => id !== null);
    return {
      isDone: page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
      residualIds,
      scanned: page.page.length,
    };
  },
  returns: legacyResidualPageValidator,
});

async function resolveLegacyQueryCommercialFileRecord(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  legacyId: string,
  fileId: string
) {
  const id = ctx.db.normalizeId("queryAttachments", legacyId);
  const row = id ? await ctx.db.get("queryAttachments", id) : null;
  const source = row ? await descriptorForSource(ctx, "query", String(row.queryId)) : null;
  if (!(row && source && (await canReadFileThroughChain(ctx, access, source)))) {
    return null;
  }
  return {
    fileName: row.fileName,
    fileSize: row.fileSize,
    id: fileId,
    mimeType: row.mimeType,
    storageId: row.storageId,
  };
}

async function resolveLegacyProposalCommercialFileRecord(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  legacyId: string,
  fileId: string
) {
  const id = ctx.db.normalizeId("proposalAttachments", legacyId);
  const row = id ? await ctx.db.get("proposalAttachments", id) : null;
  const source = row ? await descriptorForSource(ctx, "proposal", String(row.proposalId)) : null;
  if (!(row && source && (await canReadFileThroughChain(ctx, access, source)))) {
    return null;
  }
  return {
    fileName: row.fileName,
    fileSize: row.fileSize,
    id: fileId,
    mimeType: row.mimeType,
    storageId: row.storageId,
  };
}

async function resolveLegacyProposalDocumentRecord(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  legacyId: string,
  expectedStorageId: string,
  fileId: string
) {
  const proposalId = ctx.db.normalizeId("proposals", legacyId);
  const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
  const source = proposal ? await descriptorForSource(ctx, "proposal", String(proposal._id)) : null;
  if (
    !(
      proposal?.finalizedPdfStorageId &&
      String(proposal.finalizedPdfStorageId) === expectedStorageId &&
      proposal.finalizedPdfFileName &&
      source &&
      (await canReadFileThroughChain(ctx, access, source))
    )
  ) {
    return null;
  }
  return {
    fileName: proposal.finalizedPdfFileName,
    fileSize: 0,
    id: fileId,
    mimeType: "application/pdf",
    storageId: proposal.finalizedPdfStorageId,
  };
}

async function resolveLegacyCommercialFileRecord(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  fileId: string
) {
  const parsed = parseLegacyFileId(fileId);
  if (!parsed) {
    return null;
  }
  if (parsed.kind === "query") {
    return await resolveLegacyQueryCommercialFileRecord(ctx, access, parsed.id, fileId);
  }
  if (parsed.kind === "proposal") {
    return await resolveLegacyProposalCommercialFileRecord(ctx, access, parsed.id, fileId);
  }
  return await resolveLegacyProposalDocumentRecord(
    ctx,
    access,
    parsed.id,
    parsed.storageId,
    fileId
  );
}

export async function resolveCommercialFileRecord(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  fileId: string
) {
  if (isLegacyFileId(fileId)) {
    return await resolveLegacyCommercialFileRecord(ctx, access, fileId);
  }
  const id = ctx.db.normalizeId("commercialFiles", fileId);
  const row = id ? await ctx.db.get("commercialFiles", id) : null;
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
    fileSize: row.fileSize,
    id: String(row._id),
    mimeType: row.mimeType,
    storageId: row.storageId,
  };
}

export async function resolveSystemCommercialFileRecord(
  ctx: QueryCtx | MutationCtx,
  fileId: string
) {
  const parsed = parseLegacyFileId(fileId);
  if (!parsed) {
    const id = ctx.db.normalizeId("commercialFiles", fileId);
    const row = id ? await ctx.db.get("commercialFiles", id) : null;
    return row && row.lifecycle !== "deleted" ? row : null;
  }
  if (parsed.kind === "query") {
    const id = ctx.db.normalizeId("queryAttachments", parsed.id);
    return id ? await ctx.db.get("queryAttachments", id) : null;
  }
  if (parsed.kind === "proposal") {
    const id = ctx.db.normalizeId("proposalAttachments", parsed.id);
    return id ? await ctx.db.get("proposalAttachments", id) : null;
  }
  const proposalId = ctx.db.normalizeId("proposals", parsed.id);
  const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
  if (
    !(
      proposal?.finalizedPdfStorageId &&
      String(proposal.finalizedPdfStorageId) === parsed.storageId &&
      proposal.finalizedPdfFileName
    )
  ) {
    return null;
  }
  return {
    fileName: proposal.finalizedPdfFileName,
    fileSize: 0,
    mimeType: "application/pdf",
    storageId: proposal.finalizedPdfStorageId,
  };
}

export const getDownloadRecord = query({
  args: { fileId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const record = await resolveCommercialFileRecord(ctx, access, args.fileId);
    if (!record) {
      return null;
    }
    return {
      fileName: record.fileName,
      id: record.id,
      mimeType: record.mimeType,
      storageId: record.storageId,
    };
  },
  returns: v.union(
    v.object({
      fileName: v.string(),
      id: v.string(),
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
    return { success: true as const };
  },
  returns: successResultValidator,
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
    await ctx.db.patch("commercialFileUploadSessions", session._id, {
      storageId: args.storageId,
      usedAt: Date.now(),
    });
    return { success: true as const };
  },
  returns: successResultValidator,
});

async function assertCommercialFileStorageAvailable(
  ctx: MutationCtx,
  source: SourceDescriptor,
  storageId: Id<"_storage">
) {
  const [
    existingStorage,
    legacyQueryAttachment,
    legacyProposalAttachment,
    genericAttachment,
    passportDetail,
    proposalWithPdf,
  ] = await Promise.all([
    ctx.db
      .query("commercialFiles")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("queryAttachments")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("proposalAttachments")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("attachments")
      .withIndex("by_storageId", (q) => q.eq("storageId", String(storageId)))
      .first(),
    ctx.db
      .query("passportDetails")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("proposals")
      .withIndex("by_finalizedPdfStorageId", (q) => q.eq("finalizedPdfStorageId", storageId))
      .first(),
  ]);
  const currentProposalDocumentUsesStorage =
    source.sourceType === "proposal" &&
    String(source.proposal.finalizedPdfStorageId) === String(storageId);
  if (
    existingStorage ||
    legacyQueryAttachment ||
    legacyProposalAttachment ||
    genericAttachment ||
    passportDetail ||
    proposalWithPdf ||
    currentProposalDocumentUsesStorage
  ) {
    throw new ConvexError("This upload is already attached to a Commercial File");
  }
}

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
    await assertCommercialFileStorageAvailable(ctx, source, args.storageId);
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
          uploaderTeam: teamAreaLabel(args.teamArea),
        },
        timestamp
      )
    );
    if (args.category === "workingFile" && source.sourceType === "query") {
      const compatibilityId = await saveQueryAttachmentCompatibility(ctx, {
        createdBy: args.createdBy,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        queryId: source.query._id,
        storageId: args.storageId,
      });
      await ctx.db.patch("commercialFiles", id, {
        compatibilitySourceId: String(compatibilityId),
        compatibilitySourceType: "queryAttachment",
      });
    } else if (args.category === "workingFile" && source.sourceType === "proposal") {
      const compatibilityId = await saveProposalAttachmentCompatibility(ctx, {
        createdBy: args.createdBy,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        proposalId: source.proposal._id,
        storageId: args.storageId,
      });
      await ctx.db.patch("commercialFiles", id, {
        compatibilitySourceId: String(compatibilityId),
        compatibilitySourceType: "proposalAttachment",
      });
    }
    if (source.sourceType === "proposal" && args.category === "proposalDoc") {
      await ctx.db.patch("proposals", source.proposal._id, {
        finalizedPdfFileName: args.fileName,
        finalizedPdfStorageId: args.storageId,
        finalizedPdfUploadedAt: timestamp,
        finalizedPdfUploadedBy: args.createdBy,
      });
      await scheduleCrmMetricSync(ctx, "proposals", String(source.proposal._id));
      await enqueueProposalQueryCommercialProjections(ctx, source.proposal);
      await invalidateDocumentPreviewSource(ctx, "proposalDocument", String(source.proposal._id));
      await scheduleDocumentPreviewPreparation(
        ctx,
        "proposalDocument",
        String(source.proposal._id)
      );
    }
    await scheduleDocumentPreviewPreparation(ctx, "commercialFile", String(id));
    await createActivity(ctx, access, {
      action: "commercial_file_uploaded",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${args.fileName} uploaded to ${source.label}`,
      metadata: { category: args.category, teamArea: args.teamArea },
    });
    return { id };
  },
  returns: v.object({ id: v.id("commercialFiles") }),
});

async function loadMutableFile(ctx: MutationCtx, access: PortalAccess, fileId: string) {
  const timestamp = Date.now();
  const id = await materializeLegacyFile(ctx, access, fileId, timestamp);
  const row = id ? await ctx.db.get("commercialFiles", id) : null;
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

async function detachCompatibilityMirror(ctx: MutationCtx, row: Doc<"commercialFiles">) {
  if (row.compatibilitySourceType === "queryAttachment" && row.compatibilitySourceId) {
    const id = ctx.db.normalizeId("queryAttachments", row.compatibilitySourceId);
    if (id) {
      await deleteQueryAttachmentCompatibility(ctx, id);
    }
    await ctx.db.patch("commercialFiles", row._id, { compatibilitySourceId: undefined });
  } else if (row.compatibilitySourceType === "proposalAttachment" && row.compatibilitySourceId) {
    const id = ctx.db.normalizeId("proposalAttachments", row.compatibilitySourceId);
    if (id) {
      await deleteProposalAttachmentCompatibility(ctx, id);
    }
    await ctx.db.patch("commercialFiles", row._id, { compatibilitySourceId: undefined });
  }
}

async function restoreCompatibilityMirror(
  ctx: MutationCtx,
  row: Doc<"commercialFiles">,
  source: SourceDescriptor
) {
  if (row.compatibilitySourceType === "queryAttachment" && source.sourceType === "query") {
    const existing = await ctx.db
      .query("queryAttachments")
      .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", row.storageId))
      .first();
    const compatibilityId =
      existing?._id ??
      (await saveQueryAttachmentCompatibility(ctx, {
        createdBy: row.createdBy,
        fileName: row.fileName,
        fileSize: row.fileSize,
        mimeType: row.mimeType,
        queryId: source.query._id,
        storageId: row.storageId,
      }));
    await ctx.db.patch("commercialFiles", row._id, {
      compatibilitySourceId: String(compatibilityId),
    });
  } else if (
    row.compatibilitySourceType === "proposalAttachment" &&
    source.sourceType === "proposal"
  ) {
    const existing = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", row.storageId))
      .first();
    const compatibilityId =
      existing?._id ??
      (await saveProposalAttachmentCompatibility(ctx, {
        createdBy: row.createdBy,
        fileName: row.fileName,
        fileSize: row.fileSize,
        mimeType: row.mimeType,
        proposalId: source.proposal._id,
        storageId: row.storageId,
      }));
    await ctx.db.patch("commercialFiles", row._id, {
      compatibilitySourceId: String(compatibilityId),
    });
  }
}

export const updateNote = mutationWithAccess({
  args: { fileId: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args, access) => {
    const { row, source, timestamp } = await loadMutableFile(ctx, access, args.fileId);
    if (!sourceCanManage(access, source, row.teamArea) || row.lifecycle !== "active") {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch("commercialFiles", row._id, {
      note: args.note?.trim() || undefined,
      updatedAt: timestamp,
    });
    await createActivity(ctx, access, {
      action: "commercial_file_note_updated",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${row.fileName} note updated`,
      metadata: { fileId: String(row._id) },
    });
    return { success: true as const };
  },
  returns: successResultValidator,
});

export const deleteFile = mutationWithAccess({
  args: { fileId: v.string() },
  handler: async (ctx, args, access) => {
    const { row, source, timestamp } = await loadMutableFile(ctx, access, args.fileId);
    if (!sourceCanManage(access, source, row.teamArea) || row.lifecycle === "deleted") {
      throw new ConvexError("FORBIDDEN");
    }
    await detachCompatibilityMirror(ctx, row);
    await ctx.db.patch("commercialFiles", row._id, {
      deletedAt: timestamp,
      deletedBy: access.authUserId ?? access.email,
      lifecycle: "deleted",
      priorLifecycle: row.lifecycle,
      purgeAfter: timestamp + COMMERCIAL_FILE_RETENTION_MS,
      updatedAt: timestamp,
    });
    await invalidateDocumentPreviewSource(ctx, "commercialFile", String(row._id));
    if (
      row.category === "proposalDoc" &&
      source.sourceType === "proposal" &&
      String(source.proposal.finalizedPdfStorageId) === String(row.storageId)
    ) {
      await ctx.db.patch("proposals", source.proposal._id, {
        finalizedPdfFileName: undefined,
        finalizedPdfStorageId: undefined,
        finalizedPdfUploadedAt: undefined,
        finalizedPdfUploadedBy: undefined,
      });
      await scheduleCrmMetricSync(ctx, "proposals", String(source.proposal._id));
      await enqueueProposalQueryCommercialProjections(ctx, source.proposal);
      await invalidateDocumentPreviewSource(ctx, "proposalDocument", String(source.proposal._id));
    }
    await createActivity(ctx, access, {
      action: "commercial_file_deleted",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${row.fileName} moved to Recoverable Deletion`,
      metadata: { fileId: String(row._id), purgeAfter: timestamp + COMMERCIAL_FILE_RETENTION_MS },
    });
    return { success: true as const };
  },
  returns: successResultValidator,
});

export const deleteCurrentProposalDoc = mutationWithAccess({
  args: { expectedStorageId: v.string(), proposalId: v.string() },
  handler: async (ctx, args, access) => {
    const source = await descriptorForSource(ctx, "proposal", args.proposalId);
    if (!(source?.sourceType === "proposal" && sourceCanManage(access, source, "contracting"))) {
      throw new ConvexError("FORBIDDEN");
    }
    if (String(source.proposal.finalizedPdfStorageId ?? "") !== args.expectedStorageId) {
      throw new ConvexError("Proposal document changed; refresh before trying again");
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
        `legacy-proposal-doc:${source.proposal._id}:${source.proposal.finalizedPdfStorageId}`,
        timestamp
      );
      row = id ? ((await ctx.db.get("commercialFiles", id)) ?? undefined) : undefined;
    }
    if (!row) {
      throw new ConvexError("Proposal document not found");
    }
    await ctx.db.patch("commercialFiles", row._id, {
      deletedAt: timestamp,
      deletedBy: access.authUserId ?? access.email,
      lifecycle: "deleted",
      priorLifecycle: "active",
      purgeAfter: timestamp + COMMERCIAL_FILE_RETENTION_MS,
      updatedAt: timestamp,
    });
    await invalidateDocumentPreviewSource(ctx, "commercialFile", String(row._id));
    await ctx.db.patch("proposals", source.proposal._id, {
      finalizedPdfFileName: undefined,
      finalizedPdfStorageId: undefined,
      finalizedPdfUploadedAt: undefined,
      finalizedPdfUploadedBy: undefined,
    });
    await scheduleCrmMetricSync(ctx, "proposals", String(source.proposal._id));
    await enqueueProposalQueryCommercialProjections(ctx, source.proposal);
    await invalidateDocumentPreviewSource(ctx, "proposalDocument", String(source.proposal._id));
    await createActivity(ctx, access, {
      action: "commercial_file_deleted",
      entityId: source.id,
      entityType: "proposal",
      message: `${row.fileName} moved to Recoverable Deletion`,
      metadata: { category: "proposalDoc", fileId: String(row._id) },
    });
    return { success: true as const };
  },
  returns: successResultValidator,
});

export const restoreFile = mutationWithAccess({
  args: { fileId: v.string() },
  handler: async (ctx, args, access) => {
    const id = ctx.db.normalizeId("commercialFiles", args.fileId);
    const row = id ? await ctx.db.get("commercialFiles", id) : null;
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
    if (!(await ctx.db.system.get("_storage", row.storageId))) {
      throw new ConvexError("File is no longer available for recovery");
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
    await ctx.db.patch("commercialFiles", row._id, {
      deletedAt: undefined,
      deletedBy: undefined,
      lifecycle,
      purgeAfter: undefined,
      restoredAt: timestamp,
      updatedAt: timestamp,
    });
    await restoreCompatibilityMirror(ctx, row, source);
    if (
      row.category === "proposalDoc" &&
      source.sourceType === "proposal" &&
      lifecycle === "active"
    ) {
      await ctx.db.patch("proposals", source.proposal._id, {
        finalizedPdfFileName: row.fileName,
        finalizedPdfStorageId: row.storageId,
        finalizedPdfUploadedAt: row.createdAt,
        finalizedPdfUploadedBy: row.createdBy,
      });
      await scheduleCrmMetricSync(ctx, "proposals", String(source.proposal._id));
      await enqueueProposalQueryCommercialProjections(ctx, source.proposal);
      await scheduleDocumentPreviewPreparation(
        ctx,
        "proposalDocument",
        String(source.proposal._id)
      );
    }
    await scheduleDocumentPreviewPreparation(ctx, "commercialFile", String(row._id));
    await createActivity(ctx, access, {
      action: "commercial_file_restored",
      entityId: source.id,
      entityType: source.sourceType,
      message: `${row.fileName} restored`,
      metadata: { fileId: String(row._id), lifecycle },
    });
    return { success: true as const };
  },
  returns: successResultValidator,
});

export const restoreProposalHistory = mutationWithAccess({
  args: { fileId: v.string() },
  handler: async (ctx, args, access) => {
    const id = ctx.db.normalizeId("commercialFiles", args.fileId);
    const row = id ? await ctx.db.get("commercialFiles", id) : null;
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
    await ctx.db.patch("commercialFiles", row._id, {
      lifecycle: "active",
      restoredAt: timestamp,
      updatedAt: timestamp,
    });
    await ctx.db.patch("proposals", proposalSource.proposal._id, {
      finalizedPdfFileName: row.fileName,
      finalizedPdfStorageId: row.storageId,
      finalizedPdfUploadedAt: row.createdAt,
      finalizedPdfUploadedBy: row.createdBy,
    });
    await scheduleCrmMetricSync(ctx, "proposals", String(proposalSource.proposal._id));
    await enqueueProposalQueryCommercialProjections(ctx, proposalSource.proposal);
    await scheduleDocumentPreviewPreparation(ctx, "commercialFile", String(row._id));
    await invalidateDocumentPreviewSource(
      ctx,
      "proposalDocument",
      String(proposalSource.proposal._id)
    );
    await scheduleDocumentPreviewPreparation(
      ctx,
      "proposalDocument",
      String(proposalSource.proposal._id)
    );
    await createActivity(ctx, access, {
      action: "proposal_doc_history_restored",
      entityId: proposalSource.id,
      entityType: "proposal",
      message: `${row.fileName} restored as the active Proposal Doc`,
      metadata: { fileId: String(row._id) },
    });
    return { success: true as const };
  },
  returns: successResultValidator,
});

export const markFilesDeletedForSource = internalMutation({
  args: { sourceId: v.string(), sourceType: sourceTypeValidator },
  handler: () => {
    throw new ConvexError(COMMERCIAL_SOURCE_DELETION_BLOCKED_MESSAGE);
  },
  returns: v.object({ count: v.number() }),
});

export const continuePurgeExpired = internalMutation({
  args: {
    continuation: v.number(),
    runId: v.id("commercialFilePurgeRuns"),
  },
  handler: continuePurgeExpiredHandler,
  returns: purgeRunResultValidator,
});

export const purgeExpired = internalMutation({
  args: {},
  handler: purgeExpiredHandler,
  returns: purgeRunResultValidator,
});

export const getPurgeStatus = internalQuery({
  args: {},
  handler: getPurgeStatusHandler,
  returns: v.union(v.null(), purgeRunResultValidator),
});

type MutationHandler<TArgs extends PropertyValidators, TReturns extends GenericValidator> = (
  ctx: MutationCtx,
  args: ObjectType<TArgs>,
  access: PortalAccess
) => Promise<Infer<TReturns>>;

function mutationWithAccess<
  TArgs extends PropertyValidators,
  TReturns extends GenericValidator,
>(config: { args: TArgs; handler: MutationHandler<TArgs, TReturns>; returns: TReturns }) {
  return mutation<TArgs, TReturns, Infer<TReturns>, [ObjectType<TArgs>]>({
    args: config.args,
    handler: async (ctx, args) => {
      const access = await getPortalAccess(ctx);
      if (!access.allowed) {
        throw new ConvexError("FORBIDDEN");
      }
      return await config.handler(ctx, args, access);
    },
    returns: config.returns,
  });
}
