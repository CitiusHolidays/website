import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { classifyDocumentPreview } from "./documentPreviewContract";
import { hashDocumentPreviewDeliveryToken } from "./documentPreviewToken";

type SourceType =
  | "commercialFile"
  | "expenseAttachment"
  | "passport"
  | "proposalAttachment"
  | "proposalDocument"
  | "queryAttachment";

interface PreviewStatus {
  canRetry: boolean;
  errorCode: string | null;
  fileName: string;
  generation: number;
  mimeType: string;
  pageCount: number | null;
  previewKind: string;
  sheetCount: number | null;
  sourceId: string;
  sourceType: SourceType;
  status: "preparing" | "ready" | "unavailable";
  warningCodes: string[];
}

type PreviewFileResult =
  | {
      deliveryToken: string;
      expiresAt: number;
      fileName: string;
      generation: number;
      mimeType: string;
      previewKind: string;
      status: "ready";
      warningCodes: string[];
    }
  | {
      generation: number;
      previewKind: string;
      status: "preparing";
    }
  | {
      canRetry: boolean;
      errorCode: string;
      generation: number;
      previewKind: string;
      status: "unavailable";
    };

interface ClaimedPreparation {
  generation: number;
  leaseId: string;
  operationId: Id<"documentPreviewOperations">;
  previewKind: "presentation" | "spreadsheet" | "word";
  sourceId: string;
  sourceType: SourceType;
}

interface WorkerDeliveryResult {
  deliveryToken: string;
  expiresAt: number;
  fileName: string;
  generation: number;
  mimeType: string;
  operationId: Id<"documentPreviewOperations">;
  previewKind: "presentation" | "spreadsheet" | "word";
}

function minimalPdfArtifact() {
  const prefix = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";
  const xrefOffset = new TextEncoder().encode(prefix).byteLength;
  return `${prefix}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
}

const getStatus = makeFunctionReference<
  "query",
  { sourceId: string; sourceType: SourceType },
  PreviewStatus
>("crm/documentPreview:getStatus");
const getPreviewFile = makeFunctionReference<
  "action",
  { sourceId: string; sourceType: SourceType },
  PreviewFileResult
>("crm/documentPreviewActions:getPreviewFile");
const getDownloadFile = makeFunctionReference<
  "action",
  { fileId: string },
  { bytes: ArrayBuffer; fileName: string; mimeType: string }
>("crm/commercialFileActions:getDownloadFile");
const listCommercialFiles = makeFunctionReference<
  "query",
  { entityId: string; entryPoint: "query"; limit: number },
  { items: Array<{ createdBy: string; uploaderTeam: string }> }
>("crm/commercialFiles:listForEntryPoint");
const claimNextPreparation = makeFunctionReference<
  "mutation",
  { leaseId: string },
  ClaimedPreparation | null
>("crm/documentPreview:claimNextPreparation");
const getClaimedSource = makeFunctionReference<
  "query",
  {
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
  },
  {
    operationId: Id<"documentPreviewOperations">;
    sourceStorageId: Id<"_storage">;
  } | null
>("crm/documentPreview:getClaimedSource");
const getClaimedSourceFile = makeFunctionReference<
  "action",
  {
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
  },
  WorkerDeliveryResult
>("crm/documentPreviewActions:getClaimedSourceFile");
const completePreparation = makeFunctionReference<
  "action",
  {
    artifactMimeType: string;
    artifactStorageId: Id<"_storage">;
    durationMs: number;
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
    pageCount?: number;
    sheetCount?: number;
    warningCodes: string[];
  },
  { accepted: boolean }
>("crm/documentPreviewActions:completePreparation");
const claimPortalDelivery = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  {
    deliveryId: Id<"documentPreviewDeliveries">;
    storageId: Id<"_storage">;
  } | null
>("crm/documentPreview:claimPortalDelivery");
const completePortalDelivery = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"documentPreviewDeliveries"> },
  boolean
>("crm/documentPreview:completePortalDelivery");
const recoverMissingArtifact = makeFunctionReference<
  "mutation",
  {
    expectedArtifactStorageId: Id<"_storage">;
    sourceId: string;
    sourceType: SourceType;
  },
  null
>("crm/documentPreview:recoverMissingArtifact");
const cancelDelivery = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"documentPreviewDeliveries"> },
  null
>("crm/documentPreview:cancelDelivery");
const claimWorkerDelivery = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  {
    deliveryId: Id<"documentPreviewDeliveries">;
    storageId: Id<"_storage">;
  } | null
>("crm/documentPreview:claimWorkerDelivery");
const completeWorkerDelivery = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"documentPreviewDeliveries"> },
  boolean
>("crm/documentPreview:completeWorkerDelivery");
const failPreparation = makeFunctionReference<
  "mutation",
  {
    durationMs: number;
    errorCode:
      | "conversion_failed"
      | "corrupt"
      | "encrypted"
      | "expansion_limit"
      | "processing_timeout"
      | "resource_limit"
      | "signature_mismatch"
      | "unsafe_content"
      | "unsupported_format"
      | "worker_unavailable";
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
  },
  { accepted: boolean; retryScheduled: boolean }
>("crm/documentPreview:failPreparation");
const retryPreview = makeFunctionReference<
  "mutation",
  { sourceId: string; sourceType: SourceType },
  PreviewStatus
>("crm/documentPreview:retry");
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
const startWarmActiveSources = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { generation: number; runId: Id<"documentPreviewWarmRuns">; scheduled: boolean }
>("crm/documentPreview:startWarmActiveSources");
const getWarmStatus = makeFunctionReference<
  "query",
  Record<string, never>,
  {
    generation: number;
    prepared: number;
    processed: number;
    stage: "commercialFiles" | "proposals" | "complete";
    status: "running" | "completed" | "failed";
  } | null
>("crm/documentPreview:getWarmStatus");
const recordCompletedAccess = makeFunctionReference<
  "mutation",
  {
    expectedSourceStorageId: Id<"_storage">;
    operation: "download" | "preview";
    sourceId: string;
    sourceType: SourceType;
  },
  null
>("crm/documentPreview:recordCompletedAccess");

const NOW = new Date("2026-08-16T12:00:00.000Z").getTime();
const previousRolloutStage = process.env.DOCUMENT_PREVIEW_ROLLOUT_STAGE;

beforeAll(() => {
  process.env.DOCUMENT_PREVIEW_ROLLOUT_STAGE = "all";
});

afterAll(() => {
  if (previousRolloutStage === undefined) {
    delete process.env.DOCUMENT_PREVIEW_ROLLOUT_STAGE;
  } else {
    process.env.DOCUMENT_PREVIEW_ROLLOUT_STAGE = previousRolloutStage;
  }
});

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function identity(subject = "auth_sales") {
  return {
    email: `${subject}@citius.test`,
    issuer: "https://auth.citius.test",
    subject,
    tokenIdentifier: `https://auth.citius.test|${subject}`,
  };
}

async function consumePortalDelivery(
  t: ReturnType<typeof createHarness>,
  authenticated: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>,
  preview: PreviewFileResult
) {
  if (preview.status !== "ready") {
    throw new Error("Expected a ready preview delivery");
  }
  const tokenHash = await hashDocumentPreviewDeliveryToken(preview.deliveryToken);
  const claim = await authenticated.mutation(claimPortalDelivery, {
    tokenHash,
  });
  if (!claim) {
    throw new Error("Expected a preview delivery claim");
  }
  const bytes = await t.run(async (ctx) => {
    const blob = await ctx.storage.get(claim.storageId);
    return blob ? await blob.arrayBuffer() : null;
  });
  if (!bytes) {
    throw new Error("Expected stored preview bytes");
  }
  expect(
    await authenticated.mutation(completePortalDelivery, { deliveryId: claim.deliveryId })
  ).toBe(true);
  expect(await authenticated.mutation(claimPortalDelivery, { tokenHash })).toBeNull();
  return new Uint8Array(bytes);
}

async function seedCommercialFile(
  t: ReturnType<typeof createHarness>,
  args: {
    controlState?: "default" | "disabled" | null;
    fileName: string;
    mimeType: string;
  }
) {
  return await t.run(async (ctx) => {
    await ctx.db.insert("operationalControlPlaneState", {
      activatedAt: NOW,
      activatedBy: "test",
      activatedByName: "Test",
      key: "global",
      reason: "Document Preview fixture activates authoritative control states.",
      revision: 1,
    });
    const controlState = args.controlState === undefined ? "default" : args.controlState;
    if (controlState !== null) {
      await ctx.db.insert("operationalControlStates", {
        key: "files.document_preview_preparation",
        reason: "Document Preview parity fixture",
        revision: 1,
        state: controlState,
        updatedAt: NOW,
        updatedBy: "test",
        updatedByName: "Test",
      });
    }
    const canonicalAuthUserId = "https://auth.citius.test|auth_sales";
    const legacyAuthUserId = "auth_sales";
    const staffId = await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: legacyAuthUserId,
      createdAt: NOW,
      email: "auth_sales@citius.test",
      emailNormalized: "auth_sales@citius.test",
      name: "Sales Staff",
      roles: ["Sales"],
      updatedAt: NOW,
    });
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId,
      createdAt: NOW,
      legacyAuthUserId,
      status: "linked",
      updatedAt: NOW,
    });
    const queryId = await ctx.db.insert("queries", {
      batchingNotes: "",
      clientName: "Customer Secret",
      contractingStatus: "Query Received",
      createdAt: NOW,
      createdBy: canonicalAuthUserId,
      paxCount: 2,
      queryCode: "Q-PREVIEW-1",
      queryType: "FIT",
      salesOwnerId: canonicalAuthUserId,
      salesOwnerName: "Sales Staff",
      salesStatus: "Proposal in discussion",
      ticketingScope: "Not required",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    });
    const storageId = await ctx.storage.store(
      new Blob(["source document"], { type: args.mimeType })
    );
    const fileId = await ctx.db.insert("commercialFiles", {
      category: "workingFile",
      createdAt: NOW,
      createdBy: canonicalAuthUserId,
      fileName: args.fileName,
      fileSize: 15,
      lifecycle: "active",
      mimeType: args.mimeType,
      queryId,
      sourceCode: "Q-PREVIEW-1",
      sourceId: String(queryId),
      sourceLabel: "Query Q-PREVIEW-1",
      sourceType: "query",
      storageId,
      teamArea: "sales",
      updatedAt: NOW,
      uploaderTeam: "Admin, Sales",
    });
    return { fileId, queryId, staffId, storageId };
  });
}

describe("registered Document Preview contract", () => {
  test("classifies only the approved raster image formats", () => {
    expect(classifyDocumentPreview("animation.gif", "application/octet-stream")).toBe("image");
    expect(classifyDocumentPreview("vector.svg", "image/svg+xml")).toBe("unsupported");
    expect(classifyDocumentPreview("unknown.avif", "image/avif")).toBe("unsupported");
  });

  test("presents the uploader team and staff member name for existing files", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "itinerary.pdf",
      mimeType: "application/pdf",
    });
    const authenticated = t.withIdentity(identity());

    const result = await authenticated.query(listCommercialFiles, {
      entityId: String(fixture.queryId),
      entryPoint: "query",
      limit: 25,
    });

    expect(result.items[0]).toMatchObject({
      createdBy: "Sales Staff",
      uploaderTeam: "Sales",
    });
  });

  test("suppresses a new worker preparation without blocking first-party Office bytes", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      controlState: null,
      fileName: "operator-paused.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const authenticated = t.withIdentity(identity());
    await t.run(async (ctx) => {
      await ctx.db.insert("operationalControlStates", {
        expiresAt: NOW - 1,
        key: "files.document_preview_preparation",
        reason: "Expired worker rollout fixture",
        revision: 1,
        state: "enabled",
        updatedAt: NOW - 2,
        updatedBy: "test",
        updatedByName: "Test",
      });
    });

    await expect(
      authenticated.action(getPreviewFile, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).resolves.toMatchObject({
      generation: 1,
      previewKind: "word",
      status: "ready",
    });
    expect(await t.mutation(claimNextPreparation, { leaseId: "disabled-worker" })).toBeNull();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("documentPreviewOperations").collect()).toHaveLength(0);
      expect(await ctx.db.query("operationalEffectReceipts").collect()).toMatchObject([
        {
          controlKey: "files.document_preview_preparation",
          disposition: "suppressed",
          reason: "expired_safe_default",
        },
      ]);
      const state = await ctx.db
        .query("operationalControlStates")
        .withIndex("by_key", (index) => index.eq("key", "files.document_preview_preparation"))
        .unique();
      if (!state) {
        throw new Error("Expected the expired worker state fixture");
      }
      await ctx.db.patch("operationalControlStates", state._id, {
        expiresAt: undefined,
        reason: "Keep the worker explicitly paused",
        revision: 2,
        state: "disabled",
        updatedAt: NOW + 1,
      });
    });
    await expect(
      authenticated.action(getPreviewFile, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).resolves.toMatchObject({ previewKind: "word", status: "ready" });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("operationalEffectReceipts").collect()).toHaveLength(1);
    });
  });

  test("reauthorizes a native source, streams through a ticket, and records View separately from Download", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "itinerary.pdf",
      mimeType: "application/pdf",
    });
    const authenticated = t.withIdentity(identity());

    await expect(
      t.query(getStatus, { sourceId: String(fixture.fileId), sourceType: "commercialFile" })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      t.action(getPreviewFile, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).rejects.toThrow("FORBIDDEN");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("activityLogs").collect()).toHaveLength(0);
    });
    const staleStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["stale source"], { type: "application/pdf" }))
    );
    await expect(
      authenticated.mutation(recordCompletedAccess, {
        expectedSourceStorageId: staleStorageId,
        operation: "preview",
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).rejects.toThrow("Document source changed");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("activityLogs").collect()).toHaveLength(0);
    });

    expect(
      await authenticated.query(getStatus, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({
      canRetry: false,
      errorCode: null,
      fileName: "itinerary.pdf",
      generation: 0,
      mimeType: "application/pdf",
      previewKind: "pdf",
      status: "ready",
    });

    const preview = await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    expect(preview).toMatchObject({
      fileName: "itinerary.pdf",
      mimeType: "application/pdf",
      previewKind: "pdf",
      status: "ready",
    });
    expect(JSON.stringify(preview)).not.toContain("bytes");
    expect(JSON.stringify(preview)).not.toContain(String(fixture.storageId));
    expect(Buffer.from(await consumePortalDelivery(t, authenticated, preview)).toString()).toBe(
      "source document"
    );

    await authenticated.action(getDownloadFile, { fileId: String(fixture.fileId) });
    await t.run(async (ctx) => {
      const audits = await ctx.db
        .query("activityLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "commercialFile").eq("entityId", String(fixture.fileId))
        )
        .collect();
      expect(audits.map((row) => row.action).sort()).toEqual([
        "document_preview_opened",
        "file_downloaded",
      ]);
      expect(JSON.stringify(audits)).not.toContain("itinerary.pdf");
      expect(JSON.stringify(audits)).not.toContain("Customer Secret");
    });
  });

  test("keeps multi-megabyte source bytes out of action values and rechecks the source after read", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "large-itinerary.pdf",
      mimeType: "application/pdf",
    });
    const authenticated = t.withIdentity(identity());
    const largeStorageId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array(new ArrayBuffer(2 * 1024 * 1024))], {
          type: "application/pdf",
        })
      );
      await ctx.db.patch("commercialFiles", fixture.fileId, {
        fileSize: 2 * 1024 * 1024,
        storageId,
      });
      return storageId;
    });

    const preview = await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    expect(preview.status).toBe("ready");
    expect(JSON.stringify(preview).length).toBeLessThan(1000);
    expect(JSON.stringify(preview)).not.toContain("bytes");
    expect(JSON.stringify(preview)).not.toContain(String(largeStorageId));
    if (preview.status !== "ready") {
      throw new Error("Expected a large-file delivery ticket");
    }
    const claim = await authenticated.mutation(claimPortalDelivery, {
      tokenHash: await hashDocumentPreviewDeliveryToken(preview.deliveryToken),
    });
    if (!claim) {
      throw new Error("Expected the large-file delivery claim");
    }
    expect(await t.run(async (ctx) => (await ctx.storage.get(claim.storageId))?.size)).toBe(
      2 * 1024 * 1024
    );

    await t.run(async (ctx) => {
      const replacementStorageId = await ctx.storage.store(
        new Blob(["replacement"], { type: "application/pdf" })
      );
      await ctx.db.patch("commercialFiles", fixture.fileId, {
        fileSize: 11,
        storageId: replacementStorageId,
      });
    });
    expect(
      await authenticated.mutation(completePortalDelivery, { deliveryId: claim.deliveryId })
    ).toBe(false);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("activityLogs").collect()).toHaveLength(0);
    });
  });

  test("issues a one-time worker source ticket instead of serializing source bytes", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "worker-source.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const authenticated = t.withIdentity(identity());
    await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    const preparation = await t.mutation(claimNextPreparation, {
      leaseId: "worker-delivery-lease",
    });
    if (!preparation) {
      throw new Error("Expected a worker preparation claim");
    }

    const delivery = await t.action(getClaimedSourceFile, {
      generation: preparation.generation,
      leaseId: preparation.leaseId,
      operationId: preparation.operationId,
    });
    expect(JSON.stringify(delivery)).not.toContain("bytes");
    expect(JSON.stringify(delivery)).not.toContain(String(fixture.storageId));
    const tokenHash = await hashDocumentPreviewDeliveryToken(delivery.deliveryToken);
    const sourceClaim = await t.mutation(claimWorkerDelivery, { tokenHash });
    if (!sourceClaim) {
      throw new Error("Expected the worker source delivery claim");
    }
    expect(await t.run(async (ctx) => (await ctx.storage.get(sourceClaim.storageId))?.size)).toBe(
      15
    );
    expect(await t.mutation(completeWorkerDelivery, { deliveryId: sourceClaim.deliveryId })).toBe(
      true
    );
    expect(await t.mutation(claimWorkerDelivery, { tokenHash })).toBeNull();
  });

  test("defaults preview access to disabled unless a rollout stage permits it", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "rollout.pdf",
      mimeType: "application/pdf",
    });
    const authenticated = t.withIdentity(identity());
    process.env.DOCUMENT_PREVIEW_ROLLOUT_STAGE = "off";
    try {
      await expect(
        authenticated.query(getStatus, {
          sourceId: String(fixture.fileId),
          sourceType: "commercialFile",
        })
      ).rejects.toThrow("DOCUMENT_PREVIEW_DISABLED");
      await expect(
        authenticated.action(getPreviewFile, {
          sourceId: String(fixture.fileId),
          sourceType: "commercialFile",
        })
      ).rejects.toThrow("DOCUMENT_PREVIEW_DISABLED");
    } finally {
      process.env.DOCUMENT_PREVIEW_ROLLOUT_STAGE = "all";
    }
  });

  test("lazy Office preparation is replay-safe and serves only the current completed generation", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "costing.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const authenticated = t.withIdentity(identity());

    expect(
      await authenticated.query(getStatus, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({ generation: 1, previewKind: "spreadsheet", status: "preparing" });

    expect(
      await authenticated.action(getPreviewFile, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({
      fileName: "costing.xlsx",
      generation: 1,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      previewKind: "spreadsheet",
      status: "ready",
    });
    expect(
      await authenticated.action(getPreviewFile, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({ previewKind: "spreadsheet", status: "ready" });

    const claim = await t.mutation(claimNextPreparation, { leaseId: "worker-lease-1" });
    expect(claim).toMatchObject({
      generation: 1,
      leaseId: "worker-lease-1",
      previewKind: "spreadsheet",
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    if (!claim) {
      throw new Error("Expected a claimed preparation");
    }
    const artifactStorageId = await t.run(async (ctx) =>
      ctx.storage.store(
        new Blob([JSON.stringify({ schemaVersion: 1, sheets: [{ name: "Costing", rows: [] }] })], {
          type: "application/json",
        })
      )
    );
    expect(
      await t.action(completePreparation, {
        artifactMimeType: "application/json",
        artifactStorageId,
        durationMs: 42,
        generation: claim.generation,
        leaseId: claim.leaseId,
        operationId: claim.operationId,
        sheetCount: 2,
        warningCodes: [],
      })
    ).toEqual({ accepted: true });

    const ready = await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    expect(ready).toMatchObject({
      generation: 1,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      previewKind: "spreadsheet",
      status: "ready",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("documentPreviewOperations").collect()).toHaveLength(1);
      const metrics = await ctx.db.query("documentPreviewMetrics").collect();
      expect(metrics).toHaveLength(1);
      expect(JSON.stringify(metrics)).not.toContain("costing.xlsx");
      expect(JSON.stringify(metrics)).not.toContain(String(fixture.fileId));
    });
  });

  test("rejects stale worker leases and invalid artifacts with a deterministic unavailable result", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "itinerary.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const authenticated = t.withIdentity(identity());

    await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    const firstClaim = await t.mutation(claimNextPreparation, { leaseId: "worker-lease-1" });
    if (!firstClaim) {
      throw new Error("Expected the first preparation claim");
    }
    expect(
      await t.mutation(failPreparation, {
        durationMs: 100,
        errorCode: "processing_timeout",
        generation: firstClaim.generation,
        leaseId: firstClaim.leaseId,
        operationId: firstClaim.operationId,
      })
    ).toEqual({ accepted: true, retryScheduled: true });

    const secondClaim = await t.mutation(claimNextPreparation, { leaseId: "worker-lease-2" });
    if (!secondClaim) {
      throw new Error("Expected the retry preparation claim");
    }
    expect(
      await t.mutation(failPreparation, {
        durationMs: 101,
        errorCode: "conversion_failed",
        generation: firstClaim.generation,
        leaseId: firstClaim.leaseId,
        operationId: firstClaim.operationId,
      })
    ).toEqual({ accepted: false, retryScheduled: false });

    const invalidArtifactId = await t.run(async (ctx) =>
      ctx.storage.store(
        new Blob(["this is definitely not a PDF file"], { type: "application/pdf" })
      )
    );
    expect(
      await t.action(completePreparation, {
        artifactMimeType: "application/pdf",
        artifactStorageId: invalidArtifactId,
        durationMs: 11,
        generation: secondClaim.generation,
        leaseId: secondClaim.leaseId,
        operationId: secondClaim.operationId,
        warningCodes: ["not_a_public_warning"],
      })
    ).toEqual({ accepted: false });
    expect(
      await authenticated.mutation(retryPreview, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({ canRetry: false, errorCode: "signature_mismatch", status: "unavailable" });

    const unavailable = await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    expect(unavailable).toMatchObject({
      canRetry: false,
      errorCode: "signature_mismatch",
      previewKind: "word",
      status: "unavailable",
    });
    await t.finishAllScheduledFunctions(() => undefined);
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(invalidArtifactId)).toBeNull();
    });
  });

  test("expires worker leases before byte access and falls back for a transient terminal failure", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "transient.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const authenticated = t.withIdentity(identity());
    await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    const expiredClaim = await t.mutation(claimNextPreparation, { leaseId: "expired-lease" });
    if (!expiredClaim) {
      throw new Error("Expected a preparation claim");
    }
    await t.run(async (ctx) => {
      await ctx.db.patch("documentPreviewOperations", expiredClaim.operationId, {
        leaseExpiresAt: Date.now() - 1,
      });
    });
    expect(
      await t.query(getClaimedSource, {
        generation: expiredClaim.generation,
        leaseId: expiredClaim.leaseId,
        operationId: expiredClaim.operationId,
      })
    ).toBeNull();
    expect(
      await t.mutation(failPreparation, {
        durationMs: 1,
        errorCode: "worker_unavailable",
        generation: expiredClaim.generation,
        leaseId: expiredClaim.leaseId,
        operationId: expiredClaim.operationId,
      })
    ).toEqual({ accepted: false, retryScheduled: false });

    for (let attempt = 2; attempt <= 3; attempt += 1) {
      const claim = await t.mutation(claimNextPreparation, { leaseId: `retry-${attempt}` });
      if (!claim) {
        throw new Error(`Expected preparation claim ${attempt}`);
      }
      expect(
        await t.mutation(failPreparation, {
          durationMs: attempt,
          errorCode: "worker_unavailable",
          generation: claim.generation,
          leaseId: claim.leaseId,
          operationId: claim.operationId,
        })
      ).toEqual({ accepted: true, retryScheduled: attempt < 3 });
    }
    expect(
      await authenticated.query(getStatus, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({ canRetry: true, errorCode: "worker_unavailable", status: "unavailable" });
    expect(
      await authenticated.action(getPreviewFile, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      previewKind: "presentation",
      status: "ready",
    });
  });

  test("keeps status read-only across a replacement, advances generation lazily, and removes the stale artifact", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "costing.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const authenticated = t.withIdentity(identity());
    await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    const claim = await t.mutation(claimNextPreparation, { leaseId: "replacement-lease" });
    if (!claim) {
      throw new Error("Expected a preparation claim");
    }
    const oldArtifactId = await t.run(async (ctx) =>
      ctx.storage.store(
        new Blob([JSON.stringify({ schemaVersion: 1, sheets: [{ name: "Costing", rows: [] }] })], {
          type: "application/json",
        })
      )
    );
    await t.action(completePreparation, {
      artifactMimeType: "application/json",
      artifactStorageId: oldArtifactId,
      durationMs: 20,
      generation: claim.generation,
      leaseId: claim.leaseId,
      operationId: claim.operationId,
      warningCodes: [],
    });
    const replacementStorageId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["replacement workbook"], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      await ctx.db.patch("commercialFiles", fixture.fileId, {
        fileSize: 20,
        storageId,
        updatedAt: NOW + 1,
      });
      return storageId;
    });

    expect(
      await authenticated.query(getStatus, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({ generation: 2, status: "preparing" });
    await t.run(async (ctx) => {
      const operation = await ctx.db.get("documentPreviewOperations", claim.operationId);
      expect(operation?.generation).toBe(1);
      expect(operation?.sourceStorageId).toBe(fixture.storageId);
    });

    const replacement = await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    expect(replacement).toMatchObject({ generation: 2, status: "ready" });
    if (replacement.status !== "ready") {
      throw new Error("Expected the Office source fallback");
    }
    expect(Buffer.from(await consumePortalDelivery(t, authenticated, replacement)).toString()).toBe(
      "replacement workbook"
    );
    await t.finishAllScheduledFunctions(() => undefined);
    await t.run(async (ctx) => {
      const operation = await ctx.db.get("documentPreviewOperations", claim.operationId);
      expect(operation?.generation).toBe(2);
      expect(operation?.sourceStorageId).toBe(replacementStorageId);
      expect(await ctx.storage.get(oldArtifactId)).toBeNull();
    });
  });

  test("invalidates derivatives on recoverable deletion and prepares a restored source again", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "terms.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const authenticated = t.withIdentity(identity());
    await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    const claim = await t.mutation(claimNextPreparation, { leaseId: "delete-lease" });
    if (!claim) {
      throw new Error("Expected a preparation claim");
    }
    const artifactStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob([minimalPdfArtifact()], { type: "application/pdf" }))
    );
    await t.action(completePreparation, {
      artifactMimeType: "application/pdf",
      artifactStorageId,
      durationMs: 7,
      generation: claim.generation,
      leaseId: claim.leaseId,
      operationId: claim.operationId,
      warningCodes: [],
    });

    await t.run(async (ctx) => {
      await ctx.storage.delete(artifactStorageId);
    });
    const missingArtifactDelivery = await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    expect(missingArtifactDelivery).toMatchObject({
      mimeType: "application/pdf",
      previewKind: "word",
      status: "ready",
    });
    if (missingArtifactDelivery.status !== "ready") {
      throw new Error("Expected an artifact delivery ticket");
    }
    const missingClaim = await authenticated.mutation(claimPortalDelivery, {
      tokenHash: await hashDocumentPreviewDeliveryToken(missingArtifactDelivery.deliveryToken),
    });
    if (!missingClaim) {
      throw new Error("Expected the missing artifact claim");
    }
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(missingClaim.storageId)).toBeNull();
    });
    await authenticated.mutation(recoverMissingArtifact, {
      expectedArtifactStorageId: missingClaim.storageId,
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    await authenticated.mutation(cancelDelivery, { deliveryId: missingClaim.deliveryId });
    expect(
      await authenticated.query(getStatus, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({ status: "preparing" });

    const sourceFallback = await authenticated.action(getPreviewFile, {
      sourceId: String(fixture.fileId),
      sourceType: "commercialFile",
    });
    expect(sourceFallback).toMatchObject({
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "ready",
    });

    await authenticated.mutation(deleteCommercialFile, { fileId: String(fixture.fileId) });
    await expect(
      authenticated.query(getStatus, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).rejects.toThrow("FORBIDDEN");
    await t.finishAllScheduledFunctions(() => undefined);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("documentPreviewOperations").collect()).toHaveLength(0);
      expect(await ctx.storage.get(artifactStorageId)).toBeNull();
    });

    await authenticated.mutation(restoreCommercialFile, { fileId: String(fixture.fileId) });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(
      await authenticated.query(getStatus, {
        sourceId: String(fixture.fileId),
        sourceType: "commercialFile",
      })
    ).toMatchObject({ generation: 1, previewKind: "word", status: "preparing" });
  });

  test("warms active sources in bounded replay-safe continuation pages", async () => {
    const t = createHarness();
    const fixture = await seedCommercialFile(t, {
      fileName: "warm-0.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await t.run(async (ctx) => {
      for (let index = 1; index < 30; index += 1) {
        const storageId = await ctx.storage.store(
          new Blob([`warm-${index}`], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          })
        );
        await ctx.db.insert("commercialFiles", {
          category: "workingFile",
          createdAt: NOW + index,
          createdBy: "https://auth.citius.test|auth_sales",
          fileName: `warm-${index}.docx`,
          fileSize: 7,
          lifecycle: "active",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          queryId: fixture.queryId,
          sourceCode: "Q-PREVIEW-1",
          sourceId: String(fixture.queryId),
          sourceLabel: "Query Q-PREVIEW-1",
          sourceType: "query",
          storageId,
          teamArea: "sales",
          updatedAt: NOW + index,
          uploaderTeam: "Sales",
        });
      }
    });

    const started = await t.mutation(startWarmActiveSources, {});
    expect(started).toMatchObject({ generation: 1, scheduled: true });
    expect(await t.mutation(startWarmActiveSources, {})).toMatchObject({
      generation: 1,
      runId: started.runId,
      scheduled: true,
    });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(await t.query(getWarmStatus, {})).toMatchObject({
      generation: 1,
      prepared: 30,
      processed: 30,
      stage: "complete",
      status: "completed",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("documentPreviewOperations").collect()).toHaveLength(30);
    });
  });
});
