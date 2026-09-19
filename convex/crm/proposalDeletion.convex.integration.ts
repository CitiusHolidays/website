import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const NOW = new Date("2026-08-31T16:00:00.000Z").getTime();
const AUTH_USER_ID = "auth_proposal_deletion_admin";
const CANONICAL_AUTH_USER_ID = `https://auth.citius.test|${AUTH_USER_ID}`;

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

const adminIdentity = {
  email: "proposal-deletion-admin@citius.test",
  issuer: "https://auth.citius.test",
  name: "Proposal Deletion Admin",
  subject: AUTH_USER_ID,
  tokenIdentifier: CANONICAL_AUTH_USER_ID,
};

async function seedDeletionCases(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) => {
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId: CANONICAL_AUTH_USER_ID,
      createdAt: NOW,
      legacyAuthUserId: AUTH_USER_ID,
      status: "linked",
      updatedAt: NOW,
    });
    const staffId = await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: AUTH_USER_ID,
      createdAt: NOW,
      email: adminIdentity.email,
      emailNormalized: adminIdentity.email,
      name: adminIdentity.name,
      roles: ["Admin"],
      updatedAt: NOW,
    });
    const queryId = await ctx.db.insert("queries", {
      clientName: "Lifecycle Audit Client",
      contractingStatus: "Proposal in progress",
      createdAt: NOW,
      createdBy: CANONICAL_AUTH_USER_ID,
      paxCount: 2,
      queryCode: "Q-LIFECYCLE-DELETE",
      queryType: "FIT",
      salesStatus: "Proposal in discussion",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    });
    const insertProposal = async (proposalCode: string, primaryQueryId?: typeof queryId) =>
      await ctx.db.insert("proposals", {
        clientName: "Lifecycle Audit Client",
        createdAt: NOW,
        createdBy: CANONICAL_AUTH_USER_ID,
        preparedBy: adminIdentity.name,
        preparedByStaffId: staffId,
        proposalCode,
        proposalRevision: 1,
        queryId: primaryQueryId,
        status: "Draft",
        updatedAt: NOW,
      });
    const decisionProposalId = await insertProposal("P-LIFECYCLE-DECISION");
    const revisionProposalId = await insertProposal("P-LIFECYCLE-REVISION");
    const handoffProposalId = await insertProposal("P-LIFECYCLE-HANDOFF");
    const legacyProposalId = await insertProposal("P-LIFECYCLE-LEGACY");
    const legacyPrimaryProposalId = await insertProposal("P-LIFECYCLE-PRIMARY", queryId);
    const salesHandoffProposalId = await insertProposal("P-LIFECYCLE-SALES-HANDOFF");
    await ctx.db.patch(salesHandoffProposalId, { sentToSalesAt: NOW });
    const salesHandoffPrimaryProposalId = await insertProposal(
      "P-LIFECYCLE-SALES-HANDOFF-PRIMARY",
      queryId
    );
    await ctx.db.patch(salesHandoffPrimaryProposalId, { sentToSalesAt: NOW });
    const legacySalesHandoffProposalId = await insertProposal("P-LIFECYCLE-SALES-LEGACY");
    await ctx.db.patch(legacySalesHandoffProposalId, { sentAt: NOW, status: "Sent" });
    const legacySalesHandoffPrimaryProposalId = await insertProposal(
      "P-LIFECYCLE-SALES-LEGACY-PRIMARY",
      queryId
    );
    await ctx.db.patch(legacySalesHandoffPrimaryProposalId, { sentAt: NOW, status: "Sent" });
    const cleanProposalId = await insertProposal("P-LIFECYCLE-CLEAN");
    await ctx.db.insert("crmCodeSequences", {
      key: "proposals:P",
      lastAllocated: 10,
      legacyRowsScanned: 10,
      seededAt: NOW,
      updatedAt: NOW,
    });
    await ctx.db.insert("crmCodeSequenceTrust", {
      activatedAt: NOW,
      key: "proposals:P",
      lastAllocated: 10,
      reconciliationRequired: false,
      updatedAt: NOW,
      version: "crm-code-sequence-seed-v1",
    });
    const insertHandoff = async (proposalId: typeof decisionProposalId, commandId: string) =>
      await ctx.db.insert("proposalQueryHandoffs", {
        airfarePerPax: 0,
        clientName: "Lifecycle Audit Client",
        commandId,
        costPrice: 100,
        handedOffAt: NOW,
        handedOffBy: CANONICAL_AUTH_USER_ID,
        handedOffByName: adminIdentity.name,
        handedOffByStaffId: staffId,
        itinerarySummary: "Audit fixture",
        landCostPerPax: 100,
        proposalCode: commandId,
        proposalId,
        proposalRevision: 1,
        queryId,
        sellingPrice: 120,
        visaCostPerPax: 0,
      });
    const decisionHandoffId = await insertHandoff(decisionProposalId, "handoff-decision");
    const revisionHandoffId = await insertHandoff(revisionProposalId, "handoff-revision");
    await insertHandoff(handoffProposalId, "handoff-only");
    await insertHandoff(legacyPrimaryProposalId, "handoff-legacy-primary");
    await ctx.db.insert("proposalQueryDecisions", {
      commandId: "decision-command",
      decidedAt: NOW,
      decidedBy: CANONICAL_AUTH_USER_ID,
      decidedByName: adminIdentity.name,
      decidedByStaffId: staffId,
      decision: "Order Lost",
      handoffId: decisionHandoffId,
      payloadDigest: "decision-digest",
      proposalId: decisionProposalId,
      proposalRevision: 1,
      queryId,
    });
    await ctx.db.insert("proposalRevisionRequests", {
      commandId: "revision-command",
      decisionDigest: "revision-digest",
      proposalId: revisionProposalId,
      queryId,
      reason: "Destination must change",
      requestedAt: NOW,
      requestedBy: CANONICAL_AUTH_USER_ID,
      requestedByName: adminIdentity.name,
      requestedByStaffId: staffId,
      requestedChanges: { destination: { from: "Delhi", to: "Jaipur" } },
      sourceHandoffId: revisionHandoffId,
      sourceProposalRevision: 1,
      status: "Open",
    });
    // Exercise each child-table guard independently, including repair of a
    // pre-existing partial lifecycle state whose source handoff is absent.
    await ctx.db.delete("proposalQueryHandoffs", decisionHandoffId);
    await ctx.db.delete("proposalQueryHandoffs", revisionHandoffId);
    const insertLink = async (
      proposalId: typeof decisionProposalId,
      lifecycle: { handedOffAt?: number; handedOffRevision?: number } = {}
    ) =>
      await ctx.db.insert("proposalQueryLinks", {
        createdAt: NOW,
        createdBy: CANONICAL_AUTH_USER_ID,
        proposalId,
        queryId,
        ...lifecycle,
      });
    await insertLink(handoffProposalId);
    await insertLink(decisionProposalId);
    await insertLink(revisionProposalId);
    await insertLink(legacyProposalId, { handedOffAt: NOW, handedOffRevision: 1 });
    await insertLink(cleanProposalId);
    return {
      cleanProposalId,
      decisionProposalId,
      handoffProposalId,
      legacyPrimaryProposalId,
      legacyProposalId,
      legacySalesHandoffPrimaryProposalId,
      legacySalesHandoffProposalId,
      queryId,
      revisionProposalId,
      salesHandoffPrimaryProposalId,
      salesHandoffProposalId,
    };
  });
}

describe("Proposal deletion follows the existing CRM workflow", () => {
  test("deletes a Proposal immediately while retaining its file for recovery", async () => {
    const t = createHarness();
    const fixture = await seedDeletionCases(t);
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob(["retained proposal"], { type: "application/pdf" })
      );
      await ctx.db.insert("proposalAttachments", {
        createdAt: NOW,
        createdBy: CANONICAL_AUTH_USER_ID,
        fileName: "proposal.pdf",
        fileSize: 17,
        mimeType: "application/pdf",
        proposalId: fixture.cleanProposalId,
        storageId: id,
      });
      return id;
    });
    const before = Date.now();
    await t
      .withIdentity(adminIdentity)
      .mutation(api.crm.proposals.remove, { proposalId: fixture.cleanProposalId });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("proposals", fixture.cleanProposalId)).toBeNull();
      const retained = await ctx.db
        .query("commercialFiles")
        .withIndex("by_source", (q) =>
          q.eq("sourceType", "proposal").eq("sourceId", fixture.cleanProposalId)
        )
        .unique();
      expect(retained?.lifecycle).toBe("deleted");
      expect(retained?.storageId).toBe(storageId);
      expect(retained?.purgeAfter).toBeGreaterThanOrEqual(before + 14 * 24 * 60 * 60 * 1000);
      expect(await ctx.storage.get(storageId)).not.toBeNull();
    });
  });

  test("allows sent proposals to be unlinked or deleted without a new lifecycle gate", async () => {
    const t = createHarness();
    const fixture = await seedDeletionCases(t);
    const asAdmin = t.withIdentity(adminIdentity);
    for (const proposalId of [
      fixture.salesHandoffPrimaryProposalId,
      fixture.legacySalesHandoffPrimaryProposalId,
    ]) {
      await expect(
        asAdmin.mutation(api.crm.proposals.update, { proposalId: String(proposalId), queryIds: [] })
      ).resolves.toEqual({ id: proposalId });
      await t.run(async (ctx) => {
        expect((await ctx.db.get("proposals", proposalId))?.queryId).toBeUndefined();
      });
    }
    for (const proposalId of [
      fixture.salesHandoffProposalId,
      fixture.legacySalesHandoffProposalId,
      fixture.cleanProposalId,
    ]) {
      await expect(
        asAdmin.mutation(api.crm.proposals.remove, { proposalId: String(proposalId) })
      ).resolves.toEqual({ id: proposalId });
      await t.run(async (ctx) => {
        expect(await ctx.db.get("proposals", proposalId)).toBeNull();
      });
    }
  });
});
