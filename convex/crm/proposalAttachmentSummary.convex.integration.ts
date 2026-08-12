import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { PROPOSAL_ATTACHMENT_SUMMARY_VERSION } from "./proposalAttachmentSummary";

const FIXED_NOW = new Date("2026-08-12T12:00:00.000Z");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seedLegacyProposal(t: ReturnType<typeof createHarness>, attachmentTotal: number) {
  return await t.run(async (ctx) => {
    const proposalId = await ctx.db.insert("proposals", {
      clientName: "Attachment summary fixture",
      createdAt: FIXED_NOW.getTime(),
      createdBy: "integration",
      preparedBy: "Integration",
      proposalCode: "P-ATTACHMENT-SUMMARY",
      status: "Draft",
      updatedAt: FIXED_NOW.getTime(),
    });
    const storageId = await ctx.storage.store(new Blob(["fixture"], { type: "text/plain" }));
    const attachmentIds: Id<"proposalAttachments">[] = [];
    for (let index = 0; index < attachmentTotal; index += 1) {
      attachmentIds.push(
        await ctx.db.insert("proposalAttachments", {
          createdAt: FIXED_NOW.getTime(),
          createdBy: "integration",
          fileName: `attachment-${index}.txt`,
          fileSize: 7,
          mimeType: "text/plain",
          proposalId,
          storageId,
        })
      );
    }
    return { attachmentIds, proposalId, storageId };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered Proposal attachment summary migration", () => {
  test("reconciles high-cardinality equal-time rows in bounded pages and maintains exact writes", async () => {
    const t = createHarness();
    const fixture = await seedLegacyProposal(t, 123);

    const start = await t.mutation(internal.crm.proposalAttachments.startSummaryReconciliation, {});
    expect(start).toEqual({ generation: 1, scheduled: true });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const expectedInitialPreview = [...fixture.attachmentIds]
      .sort((left, right) => (String(left) > String(right) ? -1 : 1))
      .slice(0, 3);
    await t.run(async (ctx) => {
      const proposal = await ctx.db.get(fixture.proposalId);
      expect(proposal).toMatchObject({
        attachmentCount: 123,
        attachmentSummaryGeneration: 1,
        attachmentSummaryState: "ready",
        attachmentSummaryVersion: PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
      });
      expect(proposal?.attachmentPreview?.map((row) => row.id)).toEqual(expectedInitialPreview);
      const rows = await ctx.db
        .query("proposalAttachments")
        .withIndex("by_proposalId", (q) => q.eq("proposalId", fixture.proposalId))
        .collect();
      expect(rows).toHaveLength(123);
      expect(rows.every((row) => row.orderId === String(row._id))).toBe(true);
      const readiness = await ctx.db
        .query("proposalAttachmentSummaryReadiness")
        .withIndex("by_key", (q) => q.eq("key", "proposalAttachments"))
        .unique();
      expect(readiness).toMatchObject({ ready: true, reconciling: false, version: 1 });
    });

    await t.mutation(internal.crm.proposalAttachments.saveAttachment, {
      createdBy: "integration",
      fileName: "newest.txt",
      fileSize: 7,
      mimeType: "text/plain",
      proposalId: fixture.proposalId,
      storageId: fixture.storageId,
    });
    let newestId: Id<"proposalAttachments"> | null = null;
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("proposalAttachments")
        .withIndex("by_proposalId_and_createdAt_and_orderId", (q) =>
          q.eq("proposalId", fixture.proposalId)
        )
        .order("desc")
        .take(1);
      newestId = rows[0]?._id ?? null;
      const proposal = await ctx.db.get(fixture.proposalId);
      expect(proposal?.attachmentCount).toBe(124);
      expect(proposal?.attachmentPreview?.[0]?.id).toBe(newestId);
    });
    if (!newestId) {
      throw new Error("Newest attachment was not created");
    }

    await t.mutation(internal.crm.proposalAttachments.deleteAttachmentRecord, {
      attachmentId: newestId,
    });
    await t.run(async (ctx) => {
      const proposal = await ctx.db.get(fixture.proposalId);
      expect(proposal?.attachmentCount).toBe(123);
      expect(proposal?.attachmentPreview?.map((row) => row.id)).toEqual(expectedInitialPreview);
    });
  });

  test("drains every proposal returned by a page before advancing its cursor", async () => {
    const t = createHarness();
    const proposalIds = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["fixture"], { type: "text/plain" }));
      const ids: Id<"proposals">[] = [];
      for (let index = 0; index < 57; index += 1) {
        const proposalId = await ctx.db.insert("proposals", {
          clientName: `Attachment summary fixture ${index}`,
          createdAt: FIXED_NOW.getTime() + index,
          createdBy: "integration",
          preparedBy: "Integration",
          proposalCode: `P-ATTACHMENT-SUMMARY-${index}`,
          status: "Draft",
          updatedAt: FIXED_NOW.getTime() + index,
        });
        await ctx.db.insert("proposalAttachments", {
          createdAt: FIXED_NOW.getTime(),
          createdBy: "integration",
          fileName: `attachment-${index}.txt`,
          fileSize: 7,
          mimeType: "text/plain",
          proposalId,
          storageId,
        });
        ids.push(proposalId);
      }
      return ids;
    });

    await t.mutation(internal.crm.proposalAttachments.startSummaryReconciliation, {});
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      const proposals = await Promise.all(proposalIds.map((proposalId) => ctx.db.get(proposalId)));
      expect(proposals).toHaveLength(57);
      expect(
        proposals.every(
          (proposal) =>
            proposal?.attachmentCount === 1 &&
            proposal.attachmentPreview?.length === 1 &&
            proposal.attachmentSummaryState === "ready" &&
            proposal.attachmentSummaryVersion === PROPOSAL_ATTACHMENT_SUMMARY_VERSION
        )
      ).toBe(true);
    });
  });

  test("restarts a stale generation and ignores a superseded page", async () => {
    const t = createHarness();
    await seedLegacyProposal(t, 2);
    const first = await t.mutation(internal.crm.proposalAttachments.startSummaryReconciliation, {});
    expect(first.generation).toBe(1);
    vi.setSystemTime(new Date(FIXED_NOW.getTime() + 2 * 60 * 60 * 1000));
    const restarted = await t.mutation(
      internal.crm.proposalAttachments.startSummaryReconciliation,
      {}
    );
    expect(restarted).toEqual({ generation: 2, scheduled: true });

    await t.mutation(internal.crm.proposalAttachments.reconcileSummaryPage, {
      attachmentCount: 0,
      attachmentCursor: null,
      attachmentPreview: [],
      currentProposalId: null,
      generation: 1,
      lastProposal: false,
      nextProposalCursor: null,
      proposalCursor: null,
      proposalQueue: [],
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.run(async (ctx) => {
      const readiness = await ctx.db
        .query("proposalAttachmentSummaryReadiness")
        .withIndex("by_key", (q) => q.eq("key", "proposalAttachments"))
        .unique();
      expect(readiness).toMatchObject({ generation: 2, ready: true, reconciling: false });
    });
  });
});
