import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { PERMISSIONS } from "./lib";

interface CommercialFileListRow {
  fileName: string;
  id: string;
  lifecycle: "active" | "history" | "deleted";
  sourceId: string;
}

interface CommercialFileListResult {
  items: CommercialFileListRow[];
  nextCursor: string | null;
  total: number;
}

interface ResidualPage {
  isDone: boolean;
  nextCursor: string | null;
  residualIds: string[];
  scanned: number;
}

const listCommercialFiles = makeFunctionReference<
  "query",
  {
    cursor?: string;
    entityId: string;
    entryPoint: "query";
    includeDeleted?: boolean;
    linkedOnly?: boolean;
    limit: number;
  },
  CommercialFileListResult
>("crm/commercialFiles:listForEntryPoint");
const getDownloadRecord = makeFunctionReference<
  "query",
  { fileId: string },
  { fileName: string; id: string; mimeType: string; storageId: Id<"_storage"> } | null
>("crm/commercialFiles:getDownloadRecord");
const getDocumentPreviewStatus = makeFunctionReference<
  "query",
  { sourceId: string; sourceType: "commercialFile" },
  { fileName: string; sourceId: string; status: "preparing" | "ready" | "unavailable" }
>("crm/documentPreview:getStatus");
const retryDocumentPreview = makeFunctionReference<
  "mutation",
  { sourceId: string; sourceType: "commercialFile" },
  { status: "preparing" | "ready" | "unavailable" }
>("crm/documentPreview:retry");
const claimNextPreviewPreparation = makeFunctionReference<
  "mutation",
  { leaseId: string },
  {
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
  } | null
>("crm/documentPreview:claimNextPreparation");
const getClaimedPreviewSourceFile = makeFunctionReference<
  "action",
  {
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
  },
  { fileName: string; mimeType: string; previewKind: string }
>("crm/documentPreviewActions:getClaimedSourceFile");
const verifyLegacyResidualPage = makeFunctionReference<
  "query",
  {
    cursor?: string;
    limit: number;
    store: "registry" | "queryAttachments" | "proposalAttachments" | "proposalDocuments";
  },
  ResidualPage
>("crm/commercialFiles:verifyLegacyResidualPage");
const deleteCommercialFile = makeFunctionReference<
  "mutation",
  { fileId: string },
  { success: true }
>("crm/commercialFiles:deleteFile");
const restoreCommercialFile = makeFunctionReference<
  "mutation",
  { fileId: string },
  { success: true }
>("crm/commercialFiles:restoreFile");
const updateCommercialFileNote = makeFunctionReference<
  "mutation",
  { fileId: string; note: string },
  { success: true }
>("crm/commercialFiles:updateNote");
const createCommercialFile = makeFunctionReference<
  "mutation",
  {
    accessAuthUserId: string;
    accessEmail: string;
    accessName: string;
    accessPermissions: string[];
    accessRoles: string[];
    category: "workingFile";
    createdBy: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    sourceId: string;
    sourceType: "query";
    storageId: Id<"_storage">;
    teamArea: "sales";
    uploaderTeam: string;
  },
  { id: Id<"commercialFiles"> }
>("crm/commercialFiles:createFile");
const createProposalDocumentFile = makeFunctionReference<
  "mutation",
  {
    accessAuthUserId: string;
    accessEmail: string;
    accessName: string;
    accessPermissions: string[];
    accessRoles: string[];
    category: "proposalDoc";
    createdBy: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    sourceId: string;
    sourceType: "proposal";
    storageId: Id<"_storage">;
    teamArea: "contracting";
    uploaderTeam: string;
  },
  { id: Id<"commercialFiles"> }
>("crm/commercialFiles:createFile");
const updateProposal = makeFunctionReference<
  "mutation",
  { proposalId: string; queryIds: string[] },
  { id: Id<"proposals"> }
>("crm/proposals:update");

const NOW = new Date("2026-08-30T12:00:00.000Z").getTime();

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function identity(subject: string) {
  return {
    email: `${subject}@citius.test`,
    issuer: "https://auth.citius.test",
    subject,
    tokenIdentifier: `https://auth.citius.test|${subject}`,
  };
}

async function seedStaff(
  t: ReturnType<typeof createHarness>,
  args: { name: string; role: "Contracting" | "Contracting Head" | "Sales"; subject: string }
) {
  const canonicalAuthUserId = `https://auth.citius.test|${args.subject}`;
  await t.run(async (ctx) => {
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: args.subject,
      createdAt: NOW,
      email: `${args.subject}@citius.test`,
      emailNormalized: `${args.subject}@citius.test`,
      name: args.name,
      roles: [args.role],
      updatedAt: NOW,
    });
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId,
      createdAt: NOW,
      legacyAuthUserId: args.subject,
      status: "linked",
      updatedAt: NOW,
    });
  });
  return canonicalAuthUserId;
}

async function seedOwnedQuery(t: ReturnType<typeof createHarness>) {
  const ownerId = await seedStaff(t, {
    name: "Sales Owner",
    role: "Sales",
    subject: "sales_owner",
  });
  const queryId = await t.run(async (ctx) =>
    ctx.db.insert("queries", {
      attachmentCount: 0,
      attachmentPreview: [],
      batchingNotes: "",
      clientName: "Commercial File Customer",
      contractingStatus: "Query Received",
      createdAt: NOW,
      createdBy: ownerId,
      paxCount: 2,
      queryCode: "Q-FILES-1",
      queryType: "FIT",
      salesOwnerId: ownerId,
      salesOwnerName: "Sales Owner",
      salesStatus: "Proposal in discussion",
      ticketingScope: "Not required",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    })
  );
  return { ownerId, queryId };
}

async function seedQueryForOwner(
  t: ReturnType<typeof createHarness>,
  args: { code: string; ownerId: string }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("queries", {
      attachmentCount: 0,
      attachmentPreview: [],
      batchingNotes: "",
      clientName: `Customer ${args.code}`,
      contractingStatus: "Query Received",
      createdAt: NOW,
      createdBy: args.ownerId,
      paxCount: 2,
      queryCode: args.code,
      queryType: "FIT",
      salesOwnerId: args.ownerId,
      salesOwnerName: args.code,
      salesStatus: "Proposal in discussion",
      ticketingScope: "Not required",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    })
  );
}

async function storeFixtureBlob(t: ReturnType<typeof createHarness>, contents: string) {
  return await t.run(async (ctx) =>
    ctx.storage.store(new Blob([contents], { type: "application/pdf" }))
  );
}

async function insertCommercialFile(
  t: ReturnType<typeof createHarness>,
  args: {
    chainKey?: string;
    compatibilitySourceId?: string;
    compatibilitySourceType?: "queryAttachment";
    createdAt: number;
    fileName: string;
    ownerId: string;
    queryId: Id<"queries">;
    storageId: Id<"_storage">;
  }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("commercialFiles", {
      category: "workingFile",
      chainKey: args.chainKey,
      compatibilitySourceId: args.compatibilitySourceId,
      compatibilitySourceType: args.compatibilitySourceType,
      createdAt: args.createdAt,
      createdBy: args.ownerId,
      fileName: args.fileName,
      fileSize: 7,
      lifecycle: "active",
      mimeType: "application/pdf",
      queryId: args.queryId,
      sourceCode: "Q-FILES-1",
      sourceId: String(args.queryId),
      sourceLabel: "Query Q-FILES-1",
      sourceType: "query",
      storageId: args.storageId,
      teamArea: "sales",
      updatedAt: args.createdAt,
      uploaderTeam: "Sales",
    })
  );
}

async function insertSourceCommercialFile(
  t: ReturnType<typeof createHarness>,
  args: {
    chainKey: string;
    fileName: string;
    jobCardId?: Id<"jobCards">;
    ownerId: string;
    proposalId?: Id<"proposals">;
    queryId?: Id<"queries">;
    sourceId: string;
    sourceType: "jobCard" | "proposal" | "query";
    storageId: Id<"_storage">;
    teamArea: "contracting" | "operations" | "sales";
  }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("commercialFiles", {
      category: "workingFile",
      chainKey: args.chainKey,
      createdAt: NOW,
      createdBy: args.ownerId,
      fileName: args.fileName,
      fileSize: 7,
      jobCardId: args.jobCardId,
      lifecycle: "active",
      mimeType: "application/pdf",
      proposalId: args.proposalId,
      queryId: args.queryId,
      sourceCode: args.sourceId,
      sourceId: args.sourceId,
      sourceLabel: `${args.sourceType} ${args.sourceId}`,
      sourceType: args.sourceType,
      storageId: args.storageId,
      teamArea: args.teamArea,
      updatedAt: NOW,
      uploaderTeam: args.teamArea,
    })
  );
}

async function collectCommercialFiles(
  authenticated: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>,
  queryId: Id<"queries">,
  limit: number,
  onPage?: (page: CommercialFileListResult) => Promise<void> | void
) {
  const rows: CommercialFileListRow[] = [];
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const page = await authenticated.query(listCommercialFiles, {
      cursor,
      entityId: String(queryId),
      entryPoint: "query",
      limit,
    });
    expect(page.items.length).toBeLessThanOrEqual(limit);
    await onPage?.(page);
    rows.push(...page.items);
    if (!page.nextCursor) {
      return rows;
    }
    cursor = page.nextCursor;
  }
  throw new Error("Commercial File pagination did not terminate");
}

async function collectResidualIds(
  t: ReturnType<typeof createHarness>,
  store: "registry" | "queryAttachments",
  limit: number
) {
  const residualIds: string[] = [];
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const page = await t.query(verifyLegacyResidualPage, { cursor, limit, store });
    expect(page.scanned).toBeLessThanOrEqual(limit);
    residualIds.push(...page.residualIds);
    if (page.isDone) {
      expect(page.nextCursor).toBeNull();
      return residualIds;
    }
    expect(page.nextCursor).not.toBeNull();
    cursor = page.nextCursor ?? undefined;
  }
  throw new Error("Commercial File residual verification did not terminate");
}

describe("registered Commercial File chain contract", () => {
  test("projects the canonical chain identity and compatibility mirror on a new write", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const storageId = await storeFixtureBlob(t, "new-write");

    const result = await t.mutation(createCommercialFile, {
      accessAuthUserId: ownerId,
      accessEmail: "sales_owner@citius.test",
      accessName: "Sales Owner",
      accessPermissions: [PERMISSIONS.MANAGE_QUERIES],
      accessRoles: ["Sales"],
      category: "workingFile",
      createdBy: ownerId,
      fileName: "new-write.pdf",
      fileSize: 9,
      mimeType: "application/pdf",
      sourceId: String(queryId),
      sourceType: "query",
      storageId,
      teamArea: "sales",
      uploaderTeam: "Sales",
    });
    const stored = await t.run(async (ctx) => {
      const file = await ctx.db.get("commercialFiles", result.id);
      const compatibility = await ctx.db
        .query("queryAttachments")
        .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", storageId))
        .unique();
      return { compatibility, file };
    });

    expect(stored).toMatchObject({
      compatibility: { fileName: "new-write.pdf", queryId, storageId },
      file: {
        chainKey: `query:${String(queryId)}`,
        compatibilitySourceId: String(stored.compatibility?._id),
        compatibilitySourceType: "queryAttachment",
        sourceId: String(queryId),
        storageId,
      },
    });
  });

  test("bounds a large canonical chain with native continuation cursors", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const storageId = await storeFixtureBlob(t, "large-chain");
    const expectedIds: string[] = [];
    for (let offset = 0; offset < 125; offset += 10) {
      const ids = await t.run(async (ctx) => {
        const inserted: string[] = [];
        for (let index = offset; index < Math.min(125, offset + 10); index += 1) {
          const id = await ctx.db.insert("commercialFiles", {
            category: "workingFile",
            chainKey: `query:${String(queryId)}`,
            createdAt: NOW + index,
            createdBy: ownerId,
            fileName: `chain-${index}.pdf`,
            fileSize: 7,
            lifecycle: "active",
            mimeType: "application/pdf",
            queryId,
            sourceCode: "Q-FILES-1",
            sourceId: String(queryId),
            sourceLabel: "Query Q-FILES-1",
            sourceType: "query",
            storageId,
            teamArea: "sales",
            updatedAt: NOW + index,
            uploaderTeam: "Sales",
          });
          inserted.push(String(id));
        }
        return inserted;
      });
      expectedIds.push(...ids);
    }

    const authenticated = t.withIdentity(identity("sales_owner"));
    let priorTotal = 0;
    const rows = await collectCommercialFiles(authenticated, queryId, 17, (page) => {
      expect(page.total).toBeGreaterThanOrEqual(priorTotal);
      if (page.nextCursor) {
        expect(page.nextCursor).toMatch(/^commercial-file-v1:/);
      }
      priorTotal = page.total;
    });

    expect(new Set(rows.map((row) => row.id))).toEqual(new Set(expectedIds));
    expect(rows).toHaveLength(125);
    expect(priorTotal).toBe(125);
  });

  test("linked-only pagination excludes the exact modal source without filtering linked manageability", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const proposalId = await t.run(async (ctx) =>
      ctx.db.insert("proposals", {
        clientName: "Linked files customer",
        createdAt: NOW,
        createdBy: ownerId,
        preparedBy: "Contracting Owner",
        proposalCode: "P-LINKED-ONLY",
        queryId,
        status: "Draft",
        updatedAt: NOW,
      })
    );
    const storageId = await storeFixtureBlob(t, "linked-only");
    const ownId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(queryId)}`,
      fileName: "query-own-source.pdf",
      ownerId,
      queryId,
      sourceId: String(queryId),
      sourceType: "query",
      storageId,
      teamArea: "sales",
    });
    const linkedId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(queryId)}`,
      fileName: "proposal-linked-source.pdf",
      ownerId,
      proposalId,
      queryId,
      sourceId: String(proposalId),
      sourceType: "proposal",
      storageId,
      teamArea: "contracting",
    });

    const authenticated = t.withIdentity(identity("sales_owner"));
    const args = {
      entityId: String(queryId),
      entryPoint: "query" as const,
      limit: 1,
      linkedOnly: true,
    };
    const first = await authenticated.query(listCommercialFiles, args);
    const second = await authenticated.query(listCommercialFiles, {
      ...args,
      cursor: first.nextCursor ?? undefined,
    });
    const third = await authenticated.query(listCommercialFiles, {
      ...args,
      cursor: second.nextCursor ?? undefined,
    });
    const observedIds = [first, second, third].flatMap((page) => page.items.map((row) => row.id));

    expect(observedIds).toEqual([String(linkedId)]);
    expect(observedIds).not.toContain(String(ownId));
    expect(third.nextCursor).toBeNull();
  });

  test("keeps cursor continuation deterministic across a concurrent insert", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const storageId = await storeFixtureBlob(t, "concurrent-chain");
    const baselineIds: string[] = [];
    for (let index = 0; index < 35; index += 1) {
      const id = await insertCommercialFile(t, {
        chainKey: `query:${String(queryId)}`,
        createdAt: NOW + index,
        fileName: `before-${index}.pdf`,
        ownerId,
        queryId,
        storageId,
      });
      baselineIds.push(String(id));
    }
    const authenticated = t.withIdentity(identity("sales_owner"));
    const first = await authenticated.query(listCommercialFiles, {
      entityId: String(queryId),
      entryPoint: "query",
      limit: 10,
    });
    expect(first.nextCursor).not.toBeNull();

    const concurrentId = await insertCommercialFile(t, {
      chainKey: `query:${String(queryId)}`,
      createdAt: NOW + 1000,
      fileName: "concurrent.pdf",
      ownerId,
      queryId,
      storageId,
    });
    const secondArgs = {
      cursor: first.nextCursor ?? undefined,
      entityId: String(queryId),
      entryPoint: "query" as const,
      limit: 10,
    };
    const second = await authenticated.query(listCommercialFiles, secondArgs);
    const repeatedSecond = await authenticated.query(listCommercialFiles, secondArgs);
    expect(repeatedSecond).toEqual(second);

    const rows = [...first.items, ...second.items];
    let cursor = second.nextCursor ?? undefined;
    while (cursor) {
      const page = await authenticated.query(listCommercialFiles, {
        cursor,
        entityId: String(queryId),
        entryPoint: "query",
        limit: 10,
      });
      rows.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    }
    const observedIds = rows.map((row) => row.id);
    expect(new Set(observedIds).size).toBe(observedIds.length);
    for (const baselineId of baselineIds) {
      expect(observedIds).toContain(baselineId);
    }
    expect(observedIds.filter((id) => id === String(concurrentId))).toHaveLength(0);
  });

  test("keeps a multi-query Proposal inside its exact primary Query pair", async () => {
    const t = createHarness();
    const firstOwnerId = await seedStaff(t, {
      name: "First Sales Owner",
      role: "Sales",
      subject: "first_sales_owner",
    });
    const secondOwnerId = await seedStaff(t, {
      name: "Second Sales Owner",
      role: "Sales",
      subject: "second_sales_owner",
    });
    const firstQueryId = await seedQueryForOwner(t, {
      code: "Q-PAIR-1",
      ownerId: firstOwnerId,
    });
    const secondQueryId = await seedQueryForOwner(t, {
      code: "Q-PAIR-2",
      ownerId: secondOwnerId,
    });
    const { firstJobCardId, proposalId, secondJobCardId } = await t.run(async (ctx) => {
      const insertedProposalId = await ctx.db.insert("proposals", {
        clientName: "Pair Scoped Customer",
        createdAt: NOW,
        createdBy: firstOwnerId,
        preparedBy: "Contracting Owner",
        proposalCode: "P-PAIR-1",
        queryId: firstQueryId,
        status: "Draft",
        updatedAt: NOW,
      });
      await ctx.db.insert("proposalQueryLinks", {
        createdAt: NOW,
        createdBy: firstOwnerId,
        proposalId: insertedProposalId,
        queryId: firstQueryId,
      });
      await ctx.db.insert("proposalQueryLinks", {
        createdAt: NOW + 1,
        createdBy: firstOwnerId,
        proposalId: insertedProposalId,
        queryId: secondQueryId,
      });
      const insertedFirstJobCardId = await ctx.db.insert("jobCards", {
        clientName: "Pair Scoped Customer",
        confirmedPax: 2,
        createdAt: NOW,
        createdBy: firstOwnerId,
        jobCode: "J-PAIR-1",
        proposalId: insertedProposalId,
        queryId: firstQueryId,
        status: "Open",
        updatedAt: NOW,
      });
      const insertedSecondJobCardId = await ctx.db.insert("jobCards", {
        clientName: "Pair Scoped Customer",
        confirmedPax: 2,
        createdAt: NOW,
        createdBy: secondOwnerId,
        jobCode: "J-PAIR-2",
        proposalId: insertedProposalId,
        queryId: secondQueryId,
        status: "Open",
        updatedAt: NOW,
      });
      return {
        firstJobCardId: insertedFirstJobCardId,
        proposalId: insertedProposalId,
        secondJobCardId: insertedSecondJobCardId,
      };
    });
    const storageId = await storeFixtureBlob(t, "pair-scoped");
    const firstQueryFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(firstQueryId)}`,
      fileName: "first-query.pdf",
      ownerId: firstOwnerId,
      queryId: firstQueryId,
      sourceId: String(firstQueryId),
      sourceType: "query",
      storageId,
      teamArea: "sales",
    });
    const secondQueryFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(secondQueryId)}`,
      fileName: "second-query.pdf",
      ownerId: secondOwnerId,
      queryId: secondQueryId,
      sourceId: String(secondQueryId),
      sourceType: "query",
      storageId,
      teamArea: "sales",
    });
    const proposalFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(firstQueryId)}`,
      fileName: "primary-proposal.pdf",
      ownerId: firstOwnerId,
      proposalId,
      sourceId: String(proposalId),
      sourceType: "proposal",
      storageId,
      teamArea: "contracting",
    });
    const firstJobCardFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(firstQueryId)}`,
      fileName: "first-job-card.pdf",
      jobCardId: firstJobCardId,
      ownerId: firstOwnerId,
      sourceId: String(firstJobCardId),
      sourceType: "jobCard",
      storageId,
      teamArea: "operations",
    });
    const secondJobCardFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(secondQueryId)}`,
      fileName: "second-job-card.pdf",
      jobCardId: secondJobCardId,
      ownerId: secondOwnerId,
      sourceId: String(secondJobCardId),
      sourceType: "jobCard",
      storageId,
      teamArea: "operations",
    });

    const firstOwner = t.withIdentity(identity("first_sales_owner"));
    const secondOwner = t.withIdentity(identity("second_sales_owner"));
    const firstOwnerFileNames = (await collectCommercialFiles(firstOwner, firstQueryId, 10)).map(
      (row) => row.fileName
    );
    const secondOwnerFileNames = (await collectCommercialFiles(secondOwner, secondQueryId, 10)).map(
      (row) => row.fileName
    );
    expect(new Set(firstOwnerFileNames)).toEqual(
      new Set(["first-query.pdf", "primary-proposal.pdf", "first-job-card.pdf"])
    );
    expect(new Set(secondOwnerFileNames)).toEqual(
      new Set(["second-query.pdf", "second-job-card.pdf"])
    );

    await expect(
      firstOwner.query(getDownloadRecord, { fileId: String(firstQueryFileId) })
    ).resolves.toMatchObject({ fileName: "first-query.pdf" });
    await expect(
      firstOwner.query(getDownloadRecord, { fileId: String(proposalFileId) })
    ).resolves.toMatchObject({ fileName: "primary-proposal.pdf" });
    await expect(
      firstOwner.query(getDownloadRecord, { fileId: String(firstJobCardFileId) })
    ).resolves.toMatchObject({ fileName: "first-job-card.pdf" });
    await expect(
      firstOwner.query(getDownloadRecord, { fileId: String(secondQueryFileId) })
    ).resolves.toBeNull();
    await expect(
      firstOwner.query(getDownloadRecord, { fileId: String(secondJobCardFileId) })
    ).resolves.toBeNull();
    await expect(
      secondOwner.query(getDownloadRecord, { fileId: String(proposalFileId) })
    ).resolves.toBeNull();
    await expect(
      secondOwner.query(getDownloadRecord, { fileId: String(firstJobCardFileId) })
    ).resolves.toBeNull();
  });

  test("rekeys Proposal and inherited Job Card files when the primary Query changes", async () => {
    const t = createHarness();
    const firstOwnerId = await seedStaff(t, {
      name: "Relink First Owner",
      role: "Sales",
      subject: "relink_first_owner",
    });
    const secondOwnerId = await seedStaff(t, {
      name: "Relink Second Owner",
      role: "Sales",
      subject: "relink_second_owner",
    });
    const contractingOwnerId = await seedStaff(t, {
      name: "Relink Contracting Head",
      role: "Contracting Head",
      subject: "relink_contracting_head",
    });
    const firstQueryId = await seedQueryForOwner(t, {
      code: "Q-RELINK-1",
      ownerId: firstOwnerId,
    });
    const secondQueryId = await seedQueryForOwner(t, {
      code: "Q-RELINK-2",
      ownerId: secondOwnerId,
    });
    const { explicitJobCardId, inheritedJobCardId, proposalId } = await t.run(async (ctx) => {
      const insertedProposalId = await ctx.db.insert("proposals", {
        clientName: "Relink Customer",
        createdAt: NOW,
        createdBy: contractingOwnerId,
        preparedBy: "Relink Contracting Head",
        proposalCode: "P-RELINK-1",
        queryId: firstQueryId,
        status: "Draft",
        updatedAt: NOW,
      });
      await ctx.db.insert("proposalQueryLinks", {
        createdAt: NOW,
        createdBy: contractingOwnerId,
        proposalId: insertedProposalId,
        queryId: firstQueryId,
      });
      await ctx.db.insert("proposalQueryLinks", {
        createdAt: NOW + 1,
        createdBy: contractingOwnerId,
        proposalId: insertedProposalId,
        queryId: secondQueryId,
      });
      const insertedJobCardId = await ctx.db.insert("jobCards", {
        clientName: "Relink Customer",
        confirmedPax: 2,
        createdAt: NOW,
        createdBy: contractingOwnerId,
        jobCode: "J-RELINK-1",
        proposalId: insertedProposalId,
        status: "Open",
        updatedAt: NOW,
      });
      const insertedExplicitJobCardId = await ctx.db.insert("jobCards", {
        clientName: "Relink Customer",
        confirmedPax: 2,
        createdAt: NOW,
        createdBy: firstOwnerId,
        jobCode: "J-RELINK-EXPLICIT",
        proposalId: insertedProposalId,
        queryId: firstQueryId,
        status: "Open",
        updatedAt: NOW,
      });
      return {
        explicitJobCardId: insertedExplicitJobCardId,
        inheritedJobCardId: insertedJobCardId,
        proposalId: insertedProposalId,
      };
    });
    const storageId = await storeFixtureBlob(t, "relinked");
    const proposalFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(firstQueryId)}`,
      fileName: "relinked-proposal.pdf",
      ownerId: contractingOwnerId,
      proposalId,
      sourceId: String(proposalId),
      sourceType: "proposal",
      storageId,
      teamArea: "contracting",
    });
    const inheritedFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(firstQueryId)}`,
      fileName: "relinked-inherited-job.pdf",
      jobCardId: inheritedJobCardId,
      ownerId: contractingOwnerId,
      sourceId: String(inheritedJobCardId),
      sourceType: "jobCard",
      storageId,
      teamArea: "operations",
    });
    const explicitFileId = await insertSourceCommercialFile(t, {
      chainKey: `query:${String(firstQueryId)}`,
      fileName: "relinked-explicit-job.pdf",
      jobCardId: explicitJobCardId,
      ownerId: firstOwnerId,
      sourceId: String(explicitJobCardId),
      sourceType: "jobCard",
      storageId,
      teamArea: "operations",
    });

    await expect(
      t.withIdentity(identity("relink_contracting_head")).mutation(updateProposal, {
        proposalId: String(proposalId),
        queryIds: [String(secondQueryId)],
      })
    ).resolves.toEqual({ id: proposalId });

    const relinked = await t.run(async (ctx) => ({
      explicit: await ctx.db.get("commercialFiles", explicitFileId),
      inherited: await ctx.db.get("commercialFiles", inheritedFileId),
      proposal: await ctx.db.get("proposals", proposalId),
      proposalFile: await ctx.db.get("commercialFiles", proposalFileId),
    }));
    expect(relinked).toMatchObject({
      explicit: { chainKey: `query:${String(firstQueryId)}` },
      inherited: { chainKey: `query:${String(secondQueryId)}` },
      proposal: { queryId: secondQueryId },
      proposalFile: { chainKey: `query:${String(secondQueryId)}` },
    });
    const priorOwnerFileNames = (
      await collectCommercialFiles(t.withIdentity(identity("relink_first_owner")), firstQueryId, 10)
    ).map((row) => row.fileName);
    const nextOwnerFileNames = (
      await collectCommercialFiles(
        t.withIdentity(identity("relink_second_owner")),
        secondQueryId,
        10
      )
    ).map((row) => row.fileName);
    expect(priorOwnerFileNames).toEqual(["relinked-explicit-job.pdf"]);
    expect(new Set(nextOwnerFileNames)).toEqual(
      new Set(["relinked-proposal.pdf", "relinked-inherited-job.pdf"])
    );
  });

  test("deduplicates mixed stores and opens legacy rows through the canonical route contract", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const sharedStorageId = await storeFixtureBlob(t, "shared");
    const legacyOnlyStorageId = await storeFixtureBlob(t, "legacy-only");
    const canonicalId = await insertCommercialFile(t, {
      chainKey: `query:${String(queryId)}`,
      createdAt: NOW + 2,
      fileName: "canonical.pdf",
      ownerId,
      queryId,
      storageId: sharedStorageId,
    });
    const legacyOnlyId = await t.run(async (ctx) => {
      await ctx.db.insert("queryAttachments", {
        createdAt: NOW + 1,
        createdBy: ownerId,
        fileName: "compatibility-duplicate.pdf",
        fileSize: 6,
        mimeType: "application/pdf",
        queryId,
        storageId: sharedStorageId,
      });
      return await ctx.db.insert("queryAttachments", {
        createdAt: NOW,
        createdBy: ownerId,
        fileName: "legacy-only.pdf",
        fileSize: 11,
        mimeType: "application/pdf",
        queryId,
        storageId: legacyOnlyStorageId,
      });
    });
    const authenticated = t.withIdentity(identity("sales_owner"));
    const rows = await collectCommercialFiles(authenticated, queryId, 2);

    expect(rows.map((row) => row.id)).toEqual([
      String(canonicalId),
      `legacy-query:${String(legacyOnlyId)}`,
    ]);
    expect(
      await authenticated.query(getDownloadRecord, {
        fileId: `legacy-query:${String(legacyOnlyId)}`,
      })
    ).toMatchObject({
      fileName: "legacy-only.pdf",
      id: `legacy-query:${String(legacyOnlyId)}`,
      storageId: legacyOnlyStorageId,
    });
    expect(
      await authenticated.query(getDocumentPreviewStatus, {
        sourceId: `legacy-query:${String(legacyOnlyId)}`,
        sourceType: "commercialFile",
      })
    ).toMatchObject({
      fileName: "legacy-only.pdf",
      sourceId: `legacy-query:${String(legacyOnlyId)}`,
      status: "ready",
    });
  });

  test("materializes one authorized legacy row without removing its compatibility mirror", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const storageId = await storeFixtureBlob(t, "materialize-one");
    const legacyId = await t.run(async (ctx) =>
      ctx.db.insert("queryAttachments", {
        createdAt: NOW,
        createdBy: ownerId,
        fileName: "materialize-one.pdf",
        fileSize: 15,
        mimeType: "application/pdf",
        queryId,
        storageId,
      })
    );
    const owner = t.withIdentity(identity("sales_owner"));

    await expect(
      owner.mutation(updateCommercialFileNote, {
        fileId: `legacy-query:${String(legacyId)}`,
        note: "Supplier reviewed",
      })
    ).resolves.toEqual({ success: true });
    const stored = await t.run(async (ctx) => {
      const canonical = await ctx.db
        .query("commercialFiles")
        .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", storageId))
        .unique();
      return {
        canonical,
        legacy: await ctx.db.get("queryAttachments", legacyId),
      };
    });
    expect(stored).toMatchObject({
      canonical: {
        chainKey: `query:${String(queryId)}`,
        compatibilitySourceId: String(legacyId),
        compatibilitySourceType: "queryAttachment",
        note: "Supplier reviewed",
      },
      legacy: { fileName: "materialize-one.pdf", storageId },
    });
    expect(await collectCommercialFiles(owner, queryId, 5)).toMatchObject([
      { fileName: "materialize-one.pdf", id: String(stored.canonical?._id) },
    ]);
  });

  test("reuses one canonical row when a legacy Proposal Doc mutation is retried", async () => {
    const t = createHarness();
    const ownerId = await seedStaff(t, {
      name: "Contracting Owner",
      role: "Contracting Head",
      subject: "contracting_owner",
    });
    const storageId = await storeFixtureBlob(t, "proposal-doc");
    const proposalId = await t.run(async (ctx) =>
      ctx.db.insert("proposals", {
        clientName: "Proposal Doc Customer",
        createdAt: NOW,
        createdBy: ownerId,
        finalizedPdfFileName: "proposal-doc.pdf",
        finalizedPdfStorageId: storageId,
        finalizedPdfUploadedAt: NOW,
        finalizedPdfUploadedBy: ownerId,
        preparedBy: "Contracting Owner",
        proposalCode: "P-FILES-1",
        status: "Draft",
        updatedAt: NOW,
      })
    );
    const owner = t.withIdentity(identity("contracting_owner"));
    const fileId = `legacy-proposal-doc:${String(proposalId)}:${String(storageId)}`;

    await expect(
      owner.mutation(updateCommercialFileNote, { fileId, note: "First review" })
    ).resolves.toEqual({ success: true });
    await expect(
      owner.mutation(updateCommercialFileNote, { fileId, note: "Second review" })
    ).resolves.toEqual({ success: true });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("commercialFiles")
        .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", storageId))
        .collect()
    );
    expect(rows).toMatchObject([
      {
        category: "proposalDoc",
        chainKey: `proposal:${String(proposalId)}`,
        note: "Second review",
        sourceId: String(proposalId),
      },
    ]);
  });

  test("derives compatibility mirrors server-side and never mirrors Proposal Docs", async () => {
    const t = createHarness();
    const ownerId = await seedStaff(t, {
      name: "Proposal Document Owner",
      role: "Contracting Head",
      subject: "proposal_document_owner",
    });
    const proposalId = await t.run(async (ctx) =>
      ctx.db.insert("proposals", {
        clientName: "Proposal Document Customer",
        createdAt: NOW,
        createdBy: ownerId,
        preparedBy: "Proposal Document Owner",
        proposalCode: "P-DOC-MIRROR",
        status: "Draft",
        updatedAt: NOW,
      })
    );
    const storageId = await storeFixtureBlob(t, "proposal-document-no-mirror");

    const result = await t.mutation(createProposalDocumentFile, {
      accessAuthUserId: ownerId,
      accessEmail: "proposal_document_owner@citius.test",
      accessName: "Proposal Document Owner",
      accessPermissions: [PERMISSIONS.MANAGE_PROPOSALS],
      accessRoles: ["Contracting Head"],
      category: "proposalDoc",
      createdBy: ownerId,
      fileName: "proposal-document.pdf",
      fileSize: 27,
      mimeType: "application/pdf",
      sourceId: String(proposalId),
      sourceType: "proposal",
      storageId,
      teamArea: "contracting",
      uploaderTeam: "Contracting",
    });

    const stored = await t.run(async (ctx) => ({
      compatibility: await ctx.db
        .query("proposalAttachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      file: await ctx.db.get("commercialFiles", result.id),
      proposal: await ctx.db.get("proposals", proposalId),
    }));
    expect(stored).toMatchObject({
      compatibility: null,
      file: {
        category: "proposalDoc",
        lifecycle: "active",
        storageId,
      },
      proposal: { finalizedPdfStorageId: storageId },
    });
    expect(stored.file?.compatibilitySourceId).toBeUndefined();
    expect(stored.file?.compatibilitySourceType).toBeUndefined();
  });

  test("rejects stale Proposal Doc mutations after an exact storage replacement", async () => {
    const t = createHarness();
    const ownerId = await seedStaff(t, {
      name: "Stale Document Owner",
      role: "Contracting Head",
      subject: "stale_document_owner",
    });
    const proposalId = await t.run(async (ctx) =>
      ctx.db.insert("proposals", {
        clientName: "Stale Document Customer",
        createdAt: NOW,
        createdBy: ownerId,
        preparedBy: "Stale Document Owner",
        proposalCode: "P-DOC-STALE",
        status: "Draft",
        updatedAt: NOW,
      })
    );
    const originalStorageId = await storeFixtureBlob(t, "proposal-document-original");
    const replacementStorageId = await storeFixtureBlob(t, "proposal-document-replacement");
    const accessArgs = {
      accessAuthUserId: ownerId,
      accessEmail: "stale_document_owner@citius.test",
      accessName: "Stale Document Owner",
      accessPermissions: [PERMISSIONS.MANAGE_PROPOSALS],
      accessRoles: ["Contracting Head"],
      category: "proposalDoc" as const,
      createdBy: ownerId,
      fileSize: 27,
      mimeType: "application/pdf",
      sourceId: String(proposalId),
      sourceType: "proposal" as const,
      teamArea: "contracting" as const,
      uploaderTeam: "Contracting",
    };
    const original = await t.mutation(createProposalDocumentFile, {
      ...accessArgs,
      fileName: "proposal-document-original.pdf",
      storageId: originalStorageId,
    });
    const replacement = await t.mutation(createProposalDocumentFile, {
      ...accessArgs,
      fileName: "proposal-document-replacement.pdf",
      storageId: replacementStorageId,
    });
    const staleFileId = `legacy-proposal-doc:${String(proposalId)}:${String(originalStorageId)}`;
    const owner = t.withIdentity(identity("stale_document_owner"));

    await expect(
      owner.mutation(updateCommercialFileNote, {
        fileId: staleFileId,
        note: "This must not reach the replacement",
      })
    ).rejects.toThrow("Proposal document changed; refresh before trying again");
    await expect(owner.mutation(deleteCommercialFile, { fileId: staleFileId })).rejects.toThrow(
      "Proposal document changed; refresh before trying again"
    );

    const stored = await t.run(async (ctx) => ({
      compatibilityRows: await ctx.db.query("proposalAttachments").collect(),
      original: await ctx.db.get("commercialFiles", original.id),
      proposal: await ctx.db.get("proposals", proposalId),
      replacement: await ctx.db.get("commercialFiles", replacement.id),
    }));
    expect(stored).toMatchObject({
      compatibilityRows: [],
      original: { lifecycle: "history", storageId: originalStorageId },
      proposal: {
        finalizedPdfFileName: "proposal-document-replacement.pdf",
        finalizedPdfStorageId: replacementStorageId,
      },
      replacement: {
        lifecycle: "active",
        storageId: replacementStorageId,
      },
    });
    expect(stored.replacement?.note).toBeUndefined();
  });

  test("resolves legacy Office files again when the preview worker claims bytes", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const storageId = await t.run(async (ctx) => {
      await ctx.db.insert("operationalControlPlaneState", {
        activatedAt: NOW,
        activatedBy: "test",
        activatedByName: "Test",
        key: "global",
        reason: "Commercial File preview integration fixture",
        revision: 1,
      });
      await ctx.db.insert("operationalControlStates", {
        key: "files.document_preview_preparation",
        reason: "Commercial File preview integration fixture",
        revision: 1,
        state: "default",
        updatedAt: NOW,
        updatedBy: "test",
        updatedByName: "Test",
      });
      return await ctx.storage.store(
        new Blob(["office source"], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      );
    });
    const legacyId = await t.run(async (ctx) =>
      ctx.db.insert("queryAttachments", {
        createdAt: NOW,
        createdBy: ownerId,
        fileName: "legacy-office.docx",
        fileSize: 13,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        queryId,
        storageId,
      })
    );
    const sourceId = `legacy-query:${String(legacyId)}`;
    const owner = t.withIdentity(identity("sales_owner"));

    expect(
      await owner.mutation(retryDocumentPreview, {
        sourceId,
        sourceType: "commercialFile",
      })
    ).toMatchObject({ status: "preparing" });
    const claim = await t.mutation(claimNextPreviewPreparation, {
      leaseId: "legacy-office-worker",
    });
    if (!claim) {
      throw new Error("Expected the legacy Office preview preparation to be claimable");
    }
    expect(
      await t.action(getClaimedPreviewSourceFile, {
        generation: claim.generation,
        leaseId: claim.leaseId,
        operationId: claim.operationId,
      })
    ).toMatchObject({
      fileName: "legacy-office.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      previewKind: "word",
    });
  });

  test("reports bounded residuals without changing compatibility stores", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    const oldStorageId = await storeFixtureBlob(t, "old-registry");
    const mirroredStorageId = await storeFixtureBlob(t, "mirrored");
    const legacyStorageId = await storeFixtureBlob(t, "legacy-residual");
    const oldRegistryId = await insertCommercialFile(t, {
      createdAt: NOW,
      fileName: "old-registry.pdf",
      ownerId,
      queryId,
      storageId: oldStorageId,
    });
    await insertCommercialFile(t, {
      chainKey: `query:${String(queryId)}`,
      createdAt: NOW + 1,
      fileName: "mirrored.pdf",
      ownerId,
      queryId,
      storageId: mirroredStorageId,
    });
    const { mirroredLegacyId, residualLegacyId } = await t.run(async (ctx) => ({
      mirroredLegacyId: await ctx.db.insert("queryAttachments", {
        createdAt: NOW,
        createdBy: ownerId,
        fileName: "mirrored.pdf",
        fileSize: 8,
        mimeType: "application/pdf",
        queryId,
        storageId: mirroredStorageId,
      }),
      residualLegacyId: await ctx.db.insert("queryAttachments", {
        createdAt: NOW + 1,
        createdBy: ownerId,
        fileName: "legacy-residual.pdf",
        fileSize: 15,
        mimeType: "application/pdf",
        queryId,
        storageId: legacyStorageId,
      }),
    }));

    expect(await collectResidualIds(t, "registry", 1)).toEqual([String(oldRegistryId)]);
    expect(await collectResidualIds(t, "queryAttachments", 1)).toEqual([String(residualLegacyId)]);
    expect(
      await t.run(async (ctx) => ({
        mirrored: await ctx.db.get("queryAttachments", mirroredLegacyId),
        residual: await ctx.db.get("queryAttachments", residualLegacyId),
      }))
    ).toMatchObject({
      mirrored: { storageId: mirroredStorageId },
      residual: { storageId: legacyStorageId },
    });
  });

  test("reauthorizes and restores a compatibility mirror without deleting storage", async () => {
    const t = createHarness();
    const { ownerId, queryId } = await seedOwnedQuery(t);
    await seedStaff(t, {
      name: "Contracting Viewer",
      role: "Contracting",
      subject: "contracting_viewer",
    });
    const storageId = await storeFixtureBlob(t, "recoverable");
    const compatibilityId = await t.run(async (ctx) =>
      ctx.db.insert("queryAttachments", {
        createdAt: NOW,
        createdBy: ownerId,
        fileName: "recoverable.pdf",
        fileSize: 11,
        mimeType: "application/pdf",
        queryId,
        storageId,
      })
    );
    await t.run(async (ctx) =>
      ctx.db.patch("queries", queryId, {
        attachmentCount: 1,
        attachmentPreview: [
          {
            createdAt: NOW,
            fileName: "recoverable.pdf",
            fileSize: 11,
            id: compatibilityId,
            mimeType: "application/pdf",
          },
        ],
      })
    );
    const fileId = await insertCommercialFile(t, {
      chainKey: `query:${String(queryId)}`,
      compatibilitySourceId: String(compatibilityId),
      compatibilitySourceType: "queryAttachment",
      createdAt: NOW,
      fileName: "recoverable.pdf",
      ownerId,
      queryId,
      storageId,
    });
    const unauthorized = t.withIdentity(identity("contracting_viewer"));
    expect(
      await unauthorized.query(listCommercialFiles, {
        entityId: String(queryId),
        entryPoint: "query",
        limit: 10,
      })
    ).toMatchObject({ items: [], total: 0 });
    await expect(
      unauthorized.mutation(deleteCommercialFile, { fileId: String(fileId) })
    ).rejects.toThrow("FORBIDDEN");

    const owner = t.withIdentity(identity("sales_owner"));
    await expect(owner.mutation(deleteCommercialFile, { fileId: String(fileId) })).resolves.toEqual(
      { success: true }
    );
    expect(
      await t.run(async (ctx) => ({
        compatibility: await ctx.db.get("queryAttachments", compatibilityId),
        file: await ctx.db.get("commercialFiles", fileId),
        storage: await ctx.db.system.get("_storage", storageId),
      }))
    ).toMatchObject({
      compatibility: null,
      file: { lifecycle: "deleted" },
      storage: expect.objectContaining({ _id: storageId }),
    });

    await expect(
      owner.mutation(restoreCommercialFile, { fileId: String(fileId) })
    ).resolves.toEqual({ success: true });
    const restored = await t.run(async (ctx) => {
      const file = await ctx.db.get("commercialFiles", fileId);
      const compatibility = await ctx.db
        .query("queryAttachments")
        .withIndex("by_storageId", (queryBuilder) => queryBuilder.eq("storageId", storageId))
        .unique();
      return {
        compatibility,
        file,
        storage: await ctx.db.system.get("_storage", storageId),
      };
    });
    expect(restored).toMatchObject({
      compatibility: { fileName: "recoverable.pdf", queryId, storageId },
      file: {
        compatibilitySourceId: String(restored.compatibility?._id),
        lifecycle: "active",
      },
      storage: expect.objectContaining({ _id: storageId }),
    });
  });
});
