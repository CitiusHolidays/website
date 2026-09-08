import { createHash } from "node:crypto";
import { fromAny } from "@total-typescript/shoehorn";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { PERMISSIONS } from "./lib";
import { nextCode } from "./lib/codes";
import {
  encryptedPassportStorageContentType,
  passportUploadStorageContentType,
} from "./storageReferences";

const ACTOR = "preview_ownership";
const RUN_ID = "018fbe7a-62c8-7f35-9d2f-2d3f53f9e099";
const TARGET_ID = "development-preview-ownership";
const identity = {
  email: "preview@citius-e2e.test",
  issuer: "https://auth.citius.test",
  subject: ACTOR,
  tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("E2E_PROVISIONING_TARGET", "development");
  vi.stubEnv("E2E_SEED_SECRET", "integration-secret");
  vi.stubEnv("E2E_TARGET_ID", TARGET_ID);
  vi.stubEnv("VERCEL_ENV", "development");
  vi.stubEnv("DOCUMENT_PREVIEW_ROLLOUT_STAGE", "all");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function harness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  const jobCardId = await t.run(async (ctx) => {
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId: identity.tokenIdentifier,
      createdAt: 1,
      legacyAuthUserId: ACTOR,
      status: "linked",
      updatedAt: 1,
    });
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: ACTOR,
      createdAt: 1,
      email: identity.email,
      emailNormalized: identity.email,
      name: "Preview Staff",
      roles: ["Directors", "Sales"],
      updatedAt: 1,
    });
    await ctx.db.insert("operationalControlPlaneState", {
      activatedAt: 1,
      activatedBy: "fixture",
      activatedByName: "Fixture",
      key: "global",
      reason: "Synthetic preview ownership test",
      revision: 1,
    });
    await ctx.db.insert("operationalControlStates", {
      key: "files.document_preview_preparation",
      reason: "Synthetic preview ownership test",
      revision: 1,
      state: "default",
      updatedAt: 1,
      updatedBy: "fixture",
      updatedByName: "Fixture",
    });
    return ctx.db.insert("jobCards", {
      clientName: "Reusable fixture",
      confirmedPax: 1,
      createdAt: 1,
      createdBy: "fixture",
      jobCode: "JC-REUSABLE",
      status: "Open",
      updatedAt: 1,
    });
  });
  await t.mutation(internal.crm.e2eRunOwnership.begin, {
    authUserIds: [ACTOR],
    runId: RUN_ID,
    targetId: TARGET_ID,
  });
  return { jobCardId, staff: t.withIdentity(identity), t };
}

type Harness = Awaited<ReturnType<typeof harness>>;

async function upload(
  h: Harness,
  args: {
    sourceId: string;
    sourceType: "query" | "proposal";
    category?: "workingFile" | "proposalDoc";
    fileName?: string;
  }
) {
  const { t, staff } = h;
  const category = args.category ?? "workingFile";
  const fileName = args.fileName ?? "synthetic.docx";
  const mimeType = fileName.endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const teamArea = args.sourceType === "query" ? "sales" : "contracting";
  const binding = {
    category,
    sourceId: args.sourceId,
    sourceType: args.sourceType,
    teamArea,
  } as const;
  const token = crypto.randomUUID();
  const storageId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["synthetic"], { type: mimeType }))
  );
  // The upload handoff has a verified actor but does not need the browser identity.
  await t.mutation(internal.crm.commercialFiles.createUploadSession, {
    ...binding,
    authUserId: ACTOR,
    token,
  });
  await t.mutation(internal.crm.commercialFiles.claimUploadSession, {
    ...binding,
    accessAuthUserId: ACTOR,
    storageId,
    token,
  });
  const file = await staff.mutation(internal.crm.commercialFiles.createFile, {
    ...binding,
    accessAuthUserId: ACTOR,
    accessEmail: identity.email,
    accessName: "Preview Staff",
    accessPermissions: Object.values(PERMISSIONS),
    accessRoles: ["Directors"],
    createdBy: ACTOR,
    fileName,
    fileSize: 9,
    mimeType,
    storageId,
    uploaderTeam: teamArea,
  });
  return { fileId: file.id, storageId };
}

async function storePassportBytes(t: Harness["t"], bytes: string, contentType: string) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([bytes]));
    // SAFETY: convex-test exposes system storage metadata writes at runtime; Blob normalizes MIME parameter case.
    await fromAny<
      {
        patch: (
          table: "_storage",
          id: Id<"_storage">,
          value: { contentType: string }
        ) => Promise<void>;
      },
      typeof ctx.db
    >(ctx.db).patch("_storage", storageId, { contentType });
    return storageId;
  });
}

async function cleanup(t: Harness["t"]) {
  for (let page = 0; page < 100; page += 1) {
    const result = await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
      pageSize: 3,
      runId: RUN_ID,
      targetId: TARGET_ID,
    });
    if (result.complete) {
      expect(result.residualCount).toBe(0);
      return;
    }
  }
  throw new Error("Preview fixture cleanup did not complete");
}

test("owns the upload, compatibility, preview worker, delivery and expense graph and cleans only that run", async () => {
  const h = await harness();
  const { t, staff } = h;
  const query = await staff.mutation(api.crm.queries.create, {
    clientName: "Synthetic preview",
    paxCount: 1,
    queryType: "FIT",
    travelType: "Domestic Travel",
  });
  const proposal = await staff.mutation(api.crm.proposals.create, { queryId: query.id });
  const working = await upload(h, { sourceId: query.id, sourceType: "query" });
  await upload(h, { sourceId: proposal.id, sourceType: "proposal" });
  await upload(h, {
    category: "proposalDoc",
    fileName: "first.pdf",
    sourceId: proposal.id,
    sourceType: "proposal",
  });
  await upload(h, {
    category: "proposalDoc",
    fileName: "replacement.pdf",
    sourceId: proposal.id,
    sourceType: "proposal",
  });
  const expense = await staff.mutation(api.crm.finance.createExpense, {
    amount: 10,
    category: "Office",
    paidBy: "Fixture",
  });
  const proofStorageId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["proof"], { type: "application/pdf" }))
  );
  await staff.mutation(internal.crm.expenseAttachments.saveExpenseProof, {
    contentDigest: "synthetic-proof",
    createdBy: ACTOR,
    expenseId: expense.id,
    fileName: "proof.pdf",
    mimeType: "application/pdf",
    storageId: proofStorageId,
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const claim = await t.mutation(internal.crm.documentPreview.claimNextPreparation, {
    leaseId: "synthetic-worker",
  });
  expect(claim).not.toBeNull();
  if (!claim) {
    throw new Error("Expected an owned preview operation");
  }
  await t.mutation(internal.crm.documentPreview.issueWorkerDelivery, {
    generation: claim.generation,
    leaseId: claim.leaseId,
    operationId: claim.operationId,
    tokenHash: "worker-delivery",
  });
  const artifactStorageId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["%PDF-synthetic"], { type: "application/pdf" }))
  );
  await t.mutation(internal.crm.documentPreview.commitValidatedPreparation, {
    artifactMimeType: "application/pdf",
    artifactStorageId,
    durationMs: 5,
    generation: claim.generation,
    leaseId: claim.leaseId,
    operationId: claim.operationId,
    pageCount: 1,
    warningCodes: [],
  });
  const source = await t.run(async (ctx) =>
    ctx.db.get("documentPreviewOperations", claim.operationId)
  );
  if (!source) {
    throw new Error("Expected prepared operation");
  }
  await staff.mutation(internal.crm.documentPreview.issuePortalDelivery, {
    deliveryStorageId: artifactStorageId,
    expectedSourceStorageId: source.sourceStorageId,
    generation: claim.generation,
    previewKind: claim.previewKind,
    servingArtifact: true,
    sourceId: claim.sourceId,
    sourceType: claim.sourceType,
    tokenHash: "portal-delivery",
    warningCodes: [],
  });
  const delivery = await staff.mutation(internal.crm.documentPreview.claimPortalDelivery, {
    tokenHash: "portal-delivery",
  });
  if (!delivery) {
    throw new Error("Expected a delivery claim");
  }
  expect(
    await staff.mutation(internal.crm.documentPreview.completePortalDelivery, {
      deliveryId: delivery.deliveryId,
    })
  ).toBe(true);
  await t.run(async (ctx) => {
    const owned = await ctx.db.query("e2eOwnedRecords").collect();
    for (const table of [
      "commercialFiles",
      "commercialFileUploadSessions",
      "queryAttachments",
      "proposalAttachments",
      "attachments",
      "documentPreviewOperations",
      "documentPreviewDeliveries",
      "documentPreviewMetrics",
      "operationalEffectReceipts",
    ]) {
      expect(owned.some((row) => row.tableName === table)).toBe(true);
    }
    expect(
      owned
        .filter((row) => row.tableName === "documentPreviewDeliveries")
        .flatMap((row) => row.storageIds)
    ).toEqual([]);
    expect(owned.find((row) => row.documentId === String(claim.operationId))?.storageIds).toEqual([
      artifactStorageId,
    ]);
  });
  await staff.mutation(api.crm.commercialFiles.deleteFile, { fileId: working.fileId });
  await staff.mutation(api.crm.commercialFiles.restoreFile, { fileId: working.fileId });
  await cleanup(t);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.run(async (ctx) => {
    for (const table of [
      "commercialFiles",
      "commercialFileUploadSessions",
      "queryAttachments",
      "proposalAttachments",
      "attachments",
      "documentPreviewOperations",
      "documentPreviewDeliveries",
      "documentPreviewMetrics",
      "operationalEffectReceipts",
      "activityLogs",
      "queries",
      "proposals",
      "expenseEntries",
      "e2eOwnedRecords",
      "e2eMutatedRecords",
    ] as const) {
      expect(await ctx.db.query(table).collect(), table).toEqual([]);
    }
    expect(await ctx.db.system.query("_storage").collect()).toEqual([]);
    expect(await ctx.db.get("jobCards", h.jobCardId)).toMatchObject({
      clientName: "Reusable fixture",
    });
  });
  await expect(
    t.query(internal.crm.e2eRunOwnership.auditTarget, { targetId: TARGET_ID })
  ).resolves.toMatchObject({
    activeActors: 0,
    boundExceeded: false,
    incompleteRuns: 0,
    mutatedRecords: 0,
    ownedRecords: 0,
    storageReferences: 0,
  });
});

test("fences delayed preparation during cleanup and preserves an unrelated source blob after preview delivery", async () => {
  const h = await harness();
  const { t, staff } = h;
  const query = await staff.mutation(api.crm.queries.create, {
    clientName: "Delayed synthetic preview",
    paxCount: 1,
    queryType: "FIT",
    travelType: "Domestic Travel",
  });
  const working = await upload(h, { sourceId: query.id, sourceType: "query" });
  const attachment = await t.run(async (ctx) => ctx.db.query("queryAttachments").first());
  if (!attachment) {
    throw new Error("Expected compatibility attachment");
  }
  await t.mutation(internal.crm.documentPreview.prepareUploadedSource, {
    sourceId: attachment._id,
    sourceType: "queryAttachment",
  });
  const claim = await t.mutation(internal.crm.documentPreview.claimNextPreparation, {
    leaseId: "delayed-worker",
  });
  if (!claim) {
    throw new Error("Expected pending worker operation");
  }
  const source = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["historical"], { type: "text/plain" }));
    const fileId = await ctx.db.insert("commercialFiles", {
      category: "workingFile",
      createdAt: 1,
      createdBy: "historical",
      fileName: "historical.txt",
      fileSize: 10,
      lifecycle: "active",
      mimeType: "text/plain",
      sourceCode: "JC-REUSABLE",
      sourceId: h.jobCardId,
      sourceLabel: "Reusable fixture",
      sourceType: "jobCard",
      storageId,
      teamArea: "operations",
      updatedAt: 1,
      uploaderTeam: "Operations",
    });
    return { fileId, storageId };
  });
  await staff.mutation(internal.crm.documentPreview.issuePortalDelivery, {
    deliveryStorageId: source.storageId,
    expectedSourceStorageId: source.storageId,
    generation: 0,
    previewKind: "text",
    servingArtifact: false,
    sourceId: source.fileId,
    sourceType: "commercialFile",
    tokenHash: "historical-delivery",
    warningCodes: [],
  });
  await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
    pageSize: 1,
    runId: RUN_ID,
    targetId: TARGET_ID,
  });
  const lateArtifactId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["%PDF-late"], { type: "application/pdf" }))
  );
  await expect(
    t.mutation(internal.crm.documentPreview.commitValidatedPreparation, {
      artifactMimeType: "application/pdf",
      artifactStorageId: lateArtifactId,
      durationMs: 1,
      generation: claim.generation,
      leaseId: claim.leaseId,
      operationId: claim.operationId,
      warningCodes: [],
    })
  ).resolves.toEqual({ accepted: false });
  await expect(
    t.mutation(internal.crm.documentPreview.prepareUploadedSource, {
      sourceId: working.fileId,
      sourceType: "commercialFile",
    })
  ).rejects.toThrow("E2E ownership run is not active");
  await cleanup(t);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.run(async (ctx) => {
    expect(await ctx.db.query("documentPreviewOperations").collect()).toEqual([]);
    expect(await ctx.db.query("documentPreviewDeliveries").collect()).toEqual([]);
    expect(await ctx.db.query("operationalEffectReceipts").collect()).toEqual([]);
    expect(await ctx.db.query("e2eOwnedRecords").collect()).toEqual([]);
    expect(await ctx.db.get("commercialFiles", source.fileId)).not.toBeNull();
    expect(await ctx.storage.get(source.storageId)).not.toBeNull();
    expect(await ctx.storage.get(working.storageId)).toBeNull();
    expect(await ctx.storage.get(lateArtifactId)).toBeNull();
  });
});

test("owns authenticated passport quarantine, encrypted cleanup and promoted storage across internal handoffs", async () => {
  const h = await harness();
  const { t, staff } = h;
  const traveller = await staff.mutation(api.crm.travellers.create, {
    foodPreference: "Veg",
    fullName: "Synthetic Passport",
    guestType: "Client",
    jobCardId: h.jobCardId,
    paymentType: "Company Paid",
    roomType: "Single",
    visaRequired: true,
  });
  const plaintext = "synthetic quarantine";
  const encrypted = "synthetic encrypted payload";
  const digest = (text: string) => createHash("sha256").update(text).digest("base64");
  const ticket = await staff.mutation(internal.crm.passportUploadTickets.create, {
    expectedContentDigest: digest(plaintext),
    expectedFileSize: plaintext.length,
    expectedMimeType: "application/pdf",
    tokenDigest: "synthetic-token",
    travellerId: traveller.id,
  });
  const rawStorageId = await storePassportBytes(
    t,
    plaintext,
    passportUploadStorageContentType("synthetic-token")
  );
  await staff.mutation(internal.crm.passportUploadTickets.claim, {
    cleanupOwner: "synthetic-cleanup",
    purpose: "passport_scan",
    storageId: rawStorageId,
    tokenDigest: "synthetic-token",
    travellerId: traveller.id,
  });
  const reservation = await t.mutation(internal.crm.passportUploadTickets.reserveEncryptedCleanup, {
    cleanupOwner: "synthetic-cleanup",
    expectedContentDigest: digest(encrypted),
    expectedFileSize: encrypted.length,
    ticketId: ticket.ticketId,
  });
  const encryptedStorageId = await storePassportBytes(
    t,
    encrypted,
    encryptedPassportStorageContentType(reservation.cleanupRecordId)
  );
  await t.mutation(internal.crm.passportUploadTickets.bindEncryptedCleanup, {
    cleanupRecordId: reservation.cleanupRecordId,
    storageId: encryptedStorageId,
  });
  await staff.mutation(internal.crm.passportUploadTickets.promote, {
    cleanupOwner: "synthetic-cleanup",
    contentDigest: digest(plaintext),
    createdBy: ACTOR,
    encryptedCleanupRecordId: reservation.cleanupRecordId,
    encryptedPayload: "synthetic-payload",
    encryptedStorageId,
    fileName: "passport.pdf",
    mimeType: "application/pdf",
    ticketId: ticket.ticketId,
  });
  await t.run(async (ctx) => {
    const owned = await ctx.db.query("e2eOwnedRecords").collect();
    for (const tableName of [
      "passportDetails",
      "passportUploadTickets",
      "passportUploadCleanupRecords",
    ]) {
      expect(owned.some((record) => record.tableName === tableName)).toBe(true);
    }
    expect(
      owned.find((row) => row.documentId === String(reservation.cleanupRecordId))?.storageIds
    ).toContain(encryptedStorageId);
    expect(owned.find((row) => row.documentId === String(ticket.ticketId))?.storageIds).toContain(
      rawStorageId
    );
  });
  await cleanup(t);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.run(async (ctx) => {
    for (const tableName of [
      "travellers",
      "passportDetails",
      "passportUploadTickets",
      "passportUploadCleanupRecords",
      "e2eOwnedRecords",
      "e2eMutatedRecords",
      "activityLogs",
    ] as const) {
      expect(await ctx.db.query(tableName).collect(), tableName).toEqual([]);
    }
    expect(await ctx.db.system.query("_storage").collect()).toEqual([]);
    expect(await ctx.db.get("jobCards", h.jobCardId)).not.toBeNull();
  });
});

test("retains a visible storage residual when another record still references an owned upload", async () => {
  const h = await harness();
  const { t, staff } = h;
  const query = await staff.mutation(api.crm.queries.create, {
    clientName: "Shared synthetic upload",
    paxCount: 1,
    queryType: "FIT",
    travelType: "Domestic Travel",
  });
  const working = await upload(h, { sourceId: query.id, sourceType: "query" });
  const otherAttachmentId = await t.run(async (ctx) =>
    ctx.db.insert("attachments", {
      createdAt: 1,
      createdBy: "other-actor",
      entityId: h.jobCardId,
      entityType: "jobCard",
      fileName: "separately retained.docx",
      storageId: working.storageId,
    })
  );
  const first = await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
    pageSize: 50,
    runId: RUN_ID,
    targetId: TARGET_ID,
  });
  const replay = await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
    pageSize: 50,
    runId: RUN_ID,
    targetId: TARGET_ID,
  });
  expect(first.complete).toBe(false);
  expect(replay).toMatchObject({ complete: false, deleted: 0, residualCount: first.residualCount });
  await t.run(async (ctx) => {
    expect(await ctx.storage.get(working.storageId)).not.toBeNull();
    expect(await ctx.db.get("attachments", otherAttachmentId)).not.toBeNull();
    expect(await ctx.db.get("commercialFiles", working.fileId)).toBeNull();
    const residuals = await ctx.db.query("e2eOwnedRecords").collect();
    expect(residuals.length).toBeGreaterThan(0);
    expect(residuals.every((record) => record.cleanupOrder === 0)).toBe(true);
    // Only this test removes its separately retained fixture; teardown has no such authority.
    await ctx.db.delete("attachments", otherAttachmentId);
  });
  await cleanup(t);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.run(async (ctx) => {
    expect(await ctx.storage.get(working.storageId)).toBeNull();
    expect(await ctx.db.query("e2eOwnedRecords").collect()).toEqual([]);
  });
});

test("restores a reusable Proposal before retrying its owned document storage residual", async () => {
  const h = await harness();
  const original = await h.t.run(async (ctx) => {
    const proposalCode = await nextCode(fromAny(ctx), "proposals", "P");
    const id = await ctx.db.insert("proposals", {
      clientName: "Reusable Proposal",
      createdAt: 1,
      createdBy: "fixture",
      preparedBy: "Fixture",
      proposalCode,
      status: "Draft",
      updatedAt: 1,
    });
    return ctx.db.get("proposals", id);
  });
  if (!original) {
    throw new Error("Expected reusable Proposal");
  }
  const working = await upload(h, {
    category: "proposalDoc",
    fileName: "synthetic.pdf",
    sourceId: original._id,
    sourceType: "proposal",
  });
  await cleanup(h.t);
  await h.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await h.t.run(async (ctx) => {
    expect(await ctx.db.get("proposals", original._id)).toEqual(original);
    expect(await ctx.storage.get(working.storageId)).toBeNull();
    expect(await ctx.db.query("commercialFiles").collect()).toEqual([]);
    expect(await ctx.db.query("e2eOwnedRecords").collect()).toEqual([]);
    expect(await ctx.db.query("e2eMutatedRecords").collect()).toEqual([]);
  });
});

test("retains interrupted passport upload custody until exact-match storage recovery completes", async () => {
  const h = await harness();
  const { t, staff } = h;
  const traveller = await staff.mutation(api.crm.travellers.create, {
    foodPreference: "Veg",
    fullName: "Interrupted Passport",
    guestType: "Client",
    jobCardId: h.jobCardId,
    paymentType: "Company Paid",
    roomType: "Single",
    visaRequired: true,
  });
  const plaintext = "synthetic interrupted upload";
  const tokenDigest = "interrupted-token";
  const ticket = await staff.mutation(internal.crm.passportUploadTickets.create, {
    expectedContentDigest: createHash("sha256").update(plaintext).digest("base64"),
    expectedFileSize: plaintext.length,
    expectedMimeType: "application/pdf",
    tokenDigest,
    travellerId: traveller.id,
  });
  const storageId = await storePassportBytes(
    t,
    plaintext,
    passportUploadStorageContentType(tokenDigest)
  );
  const pending = await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
    pageSize: 50,
    runId: RUN_ID,
    targetId: TARGET_ID,
  });
  expect(pending.complete).toBe(false);
  await t.run(async (ctx) => {
    expect(await ctx.db.get("passportUploadTickets", ticket.ticketId)).not.toBeNull();
    expect(await ctx.storage.get(storageId)).not.toBeNull();
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await cleanup(t);
  await t.run(async (ctx) => {
    expect(await ctx.storage.get(storageId)).toBeNull();
    expect(await ctx.db.query("passportUploadTickets").collect()).toEqual([]);
    expect(await ctx.db.query("e2eOwnedRecords").collect()).toEqual([]);
  });
});
