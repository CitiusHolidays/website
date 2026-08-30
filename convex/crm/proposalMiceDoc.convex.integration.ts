import { fromAny } from "@total-typescript/shoehorn";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const FIXED_NOW = new Date("2026-08-30T14:00:00.000Z");
const PROPOSAL_REVISION = 3;
const BRIEF = {
  contactWindow: "afternoon" as const,
  dateFlexibility: "flexible" as const,
  destination: "Singapore",
  paxCount: 180,
  serviceType: "meetings_events" as const,
  travelStartDate: "2027-02-12",
};

const STAFF = {
  contracting: {
    email: "mice-contracting@citius.test",
    name: "MICE Contracting",
    role: "Contracting",
    subject: "auth_mice_contracting",
  },
  outsider: {
    email: "mice-outsider@citius.test",
    name: "MICE Outside Sales",
    role: "Sales",
    subject: "auth_mice_outsider",
  },
  sales: {
    email: "mice-sales@citius.test",
    name: "MICE Sales",
    role: "Sales",
    subject: "auth_mice_sales",
  },
  ticketing: {
    email: "mice-ticketing@citius.test",
    name: "MICE Ticketing",
    role: "Ticketing",
    subject: "auth_mice_ticketing",
  },
} as const;

type StaffFixture = (typeof STAFF)[keyof typeof STAFF];

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function identity(key: keyof typeof STAFF) {
  const staff = STAFF[key];
  return {
    email: staff.email,
    issuer: "https://auth.citius.test",
    name: staff.name,
    subject: staff.subject,
    tokenIdentifier: `https://auth.citius.test|${staff.subject}`,
  };
}

async function seedMicePair(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) => {
    const insertStaff = async (staff: StaffFixture) => {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `https://auth.citius.test|${staff.subject}`,
        createdAt: FIXED_NOW.getTime(),
        legacyAuthUserId: staff.subject,
        status: "linked",
        updatedAt: FIXED_NOW.getTime(),
      });
      return await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: staff.subject,
        createdAt: FIXED_NOW.getTime(),
        email: staff.email,
        emailNormalized: staff.email,
        name: staff.name,
        roles: [staff.role],
        updatedAt: FIXED_NOW.getTime(),
      });
    };
    const contractingStaffId = await insertStaff(STAFF.contracting);
    await insertStaff(STAFF.outsider);
    const salesStaffId = await insertStaff(STAFF.sales);
    const ticketingStaffId = await insertStaff(STAFF.ticketing);

    const inboundIntentId = await ctx.db.insert("inboundQueryIntents", {
      brief: { ...BRIEF },
      clientName: "Acme Leadership Summit",
      consentAt: FIXED_NOW.getTime() - 60_000,
      contactMobile: "919876543210",
      createdAt: FIXED_NOW.getTime() - 60_000,
      receiptReference: "ENQ-MICE-A1B2C3D4",
      source: "Website",
      status: "pending",
      websiteSourceContext: {
        intent: "mice-proposal",
        label: "MICE proposal request",
      },
    });
    const queryId = await ctx.db.insert("queries", {
      clientName: "Acme Leadership Summit",
      contractingOwnerId: String(contractingStaffId),
      contractingOwnerName: STAFF.contracting.name,
      contractingStatus: "Proposal in progress",
      createdAt: FIXED_NOW.getTime(),
      createdBy: `https://auth.citius.test|${STAFF.sales.subject}`,
      inboundIntentId,
      paxCount: BRIEF.paxCount,
      queryCode: "Q-MICE-QUALIFIED-1",
      queryType: "MICE",
      salesOwnerId: String(salesStaffId),
      salesOwnerName: STAFF.sales.name,
      salesStatus: "Proposal in discussion",
      source: "Website",
      sourceConsentAt: FIXED_NOW.getTime() - 60_000,
      ticketingOwnerId: String(ticketingStaffId),
      ticketingOwnerName: STAFF.ticketing.name,
      ticketingScope: "Both",
      travelType: "Domestic Travel",
      updatedAt: FIXED_NOW.getTime(),
    });
    await ctx.db.patch("inboundQueryIntents", inboundIntentId, {
      convertedAt: FIXED_NOW.getTime(),
      convertedQueryId: String(queryId),
      status: "converted",
    });
    const proposalId = await ctx.db.insert("proposals", {
      clientName: "Acme Leadership Summit",
      createdAt: FIXED_NOW.getTime(),
      createdBy: `https://auth.citius.test|${STAFF.contracting.subject}`,
      preparedBy: STAFF.contracting.name,
      preparedByStaffId: contractingStaffId,
      proposalCode: "P-MICE-QUALIFIED-1",
      proposalRevision: PROPOSAL_REVISION,
      queryId,
      status: "Draft",
      updatedAt: FIXED_NOW.getTime(),
    });
    await ctx.db.insert("proposalQueryLinks", {
      createdAt: FIXED_NOW.getTime(),
      createdBy: `https://auth.citius.test|${STAFF.contracting.subject}`,
      proposalId,
      queryId,
    });
    return { inboundIntentId, proposalId, queryId };
  });
}

function pairArgs(fixture: Awaited<ReturnType<typeof seedMicePair>>, revision = PROPOSAL_REVISION) {
  return {
    proposalId: String(fixture.proposalId),
    proposalRevision: revision,
    queryId: String(fixture.queryId),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("qualified MICE Proposal Doc drafts", () => {
  test("binds six accepted brief fields to one replay-safe review and manual-send approval", async () => {
    const t = createHarness();
    const fixture = await seedMicePair(t);
    const args = pairArgs(fixture);
    const asContracting = t.withIdentity(identity("contracting"));
    const asSales = t.withIdentity(identity("sales"));
    const asTicketing = t.withIdentity(identity("ticketing"));

    const accepted = await asContracting.query(api.crm.proposals.getMiceDocDraft, args);
    expect(accepted).toMatchObject({
      draft: null,
      source: {
        acceptedAt: FIXED_NOW.getTime() - 60_000,
        brief: BRIEF,
        briefRevision: 1,
        clientName: "Acme Leadership Summit",
        receiptReference: "ENQ-MICE-A1B2C3D4",
      },
    });
    expect(Object.keys(accepted?.source.brief ?? {}).sort()).toEqual([
      "contactWindow",
      "dateFlexibility",
      "destination",
      "paxCount",
      "serviceType",
      "travelStartDate",
    ]);

    const created = await asContracting.mutation(api.crm.proposals.createMiceDocDraft, args);
    expect(created).toMatchObject({ replayed: false, status: "draft" });
    expect(await asTicketing.mutation(api.crm.proposals.createMiceDocDraft, args)).toEqual({
      ...created,
      replayed: true,
    });
    await expect(
      asSales.mutation(api.crm.proposals.approveMiceDocDraftForManualSend, args)
    ).rejects.toThrow("must be reviewed");

    vi.setSystemTime(new Date(FIXED_NOW.getTime() + 60_000));
    const reviewed = await asTicketing.mutation(api.crm.proposals.markMiceDocDraftReviewed, args);
    expect(reviewed).toEqual({ ...created, replayed: false, status: "reviewed" });
    expect(await asContracting.mutation(api.crm.proposals.markMiceDocDraftReviewed, args)).toEqual({
      ...reviewed,
      replayed: true,
    });

    vi.setSystemTime(new Date(FIXED_NOW.getTime() + 120_000));
    const approved = await asSales.mutation(
      api.crm.proposals.approveMiceDocDraftForManualSend,
      args
    );
    expect(approved).toEqual({
      ...created,
      replayed: false,
      status: "approved_for_manual_send",
    });
    expect(
      await asSales.mutation(api.crm.proposals.approveMiceDocDraftForManualSend, args)
    ).toEqual({ ...approved, replayed: true });

    const finalState = await asSales.query(api.crm.proposals.getMiceDocDraft, args);
    expect(finalState?.draft).toMatchObject({
      approvedForManualSendAt: FIXED_NOW.getTime() + 120_000,
      approvedForManualSendByName: STAFF.sales.name,
      brandName: "Citius Holidays",
      brief: BRIEF,
      clientName: "Acme Leadership Summit",
      createdAt: FIXED_NOW.getTime(),
      createdByName: STAFF.contracting.name,
      proposalCode: "P-MICE-QUALIFIED-1",
      proposalRevision: PROPOSAL_REVISION,
      queryCode: "Q-MICE-QUALIFIED-1",
      reviewedAt: FIXED_NOW.getTime() + 60_000,
      reviewedByName: STAFF.ticketing.name,
      sourceAcceptedAt: FIXED_NOW.getTime() - 60_000,
      sourceBriefRevision: 1,
      sourceReceiptReference: "ENQ-MICE-A1B2C3D4",
      status: "approved_for_manual_send",
    });
    expect(finalState?.draft?.sourceBriefDigest).toBe(finalState?.source.briefDigest);

    await t.run(async (ctx) => {
      const proposal = await ctx.db.get("proposals", fixture.proposalId);
      expect(proposal).toMatchObject({
        proposalRevision: PROPOSAL_REVISION,
        status: "Draft",
      });
      expect(proposal?.finalizedPdfStorageId).toBeUndefined();
      expect(proposal?.sentAt).toBeUndefined();
      expect(proposal?.sentToClientAt).toBeUndefined();
      expect(proposal?.sentToSalesAt).toBeUndefined();
      expect(await ctx.db.query("proposalMiceDocDrafts").collect()).toHaveLength(1);
      expect(await ctx.db.query("proposalQueryHandoffs").collect()).toEqual([]);
      expect(await ctx.db.query("proposalAttachments").collect()).toEqual([]);
      expect(await ctx.db.query("notifications").collect()).toEqual([]);
    });
  });

  test("rejects malformed, unqualified, and unauthorized draft operations", async () => {
    const t = createHarness();
    const fixture = await seedMicePair(t);
    const args = pairArgs(fixture);
    const asContracting = t.withIdentity(identity("contracting"));
    const asOutsider = t.withIdentity(identity("outsider"));
    const asSales = t.withIdentity(identity("sales"));

    await expect(t.mutation(api.crm.proposals.createMiceDocDraft, args)).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(asSales.mutation(api.crm.proposals.createMiceDocDraft, args)).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(
      asContracting.mutation(api.crm.proposals.approveMiceDocDraftForManualSend, args)
    ).rejects.toThrow("FORBIDDEN");
    await expect(asOutsider.query(api.crm.proposals.getMiceDocDraft, args)).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(
      asContracting.mutation(api.crm.proposals.createMiceDocDraft, {
        ...args,
        proposalRevision: 0,
      })
    ).rejects.toThrow("positive integer");
    await expect(
      // SAFETY: This test controls malformed registered-function input at the validator boundary.
      asContracting.mutation(
        api.crm.proposals.createMiceDocDraft,
        fromAny<never, unknown>({ ...args, proposalRevision: "three" })
      )
    ).rejects.toThrow();

    await t.run(async (ctx) => {
      await ctx.db.patch("inboundQueryIntents", fixture.inboundIntentId, {
        websiteSourceContext: {
          intent: "pilgrimage-callback",
          label: "Wrong intent",
        },
      });
    });
    expect(await asContracting.query(api.crm.proposals.getMiceDocDraft, args)).toBeNull();
    await expect(
      asContracting.mutation(api.crm.proposals.createMiceDocDraft, args)
    ).rejects.toThrow("no accepted MICE enquiry brief");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("proposalMiceDocDrafts").collect()).toEqual([]);
    });
  });

  test("fails closed when the accepted source or Proposal revision changes", async () => {
    const sourceHarness = createHarness();
    const sourceFixture = await seedMicePair(sourceHarness);
    const sourceArgs = pairArgs(sourceFixture);
    const sourceActor = sourceHarness.withIdentity(identity("contracting"));
    await sourceActor.mutation(api.crm.proposals.createMiceDocDraft, sourceArgs);
    await sourceHarness.run(async (ctx) => {
      await ctx.db.patch("inboundQueryIntents", sourceFixture.inboundIntentId, {
        brief: { ...BRIEF, destination: "Tokyo" },
      });
    });
    await expect(sourceActor.query(api.crm.proposals.getMiceDocDraft, sourceArgs)).rejects.toThrow(
      "accepted MICE brief changed"
    );
    await expect(
      sourceActor.mutation(api.crm.proposals.createMiceDocDraft, sourceArgs)
    ).rejects.toThrow("accepted MICE brief changed");
    await expect(
      sourceActor.mutation(api.crm.proposals.markMiceDocDraftReviewed, sourceArgs)
    ).rejects.toThrow("accepted MICE brief changed");
    await sourceHarness.run(async (ctx) => {
      expect((await ctx.db.query("proposalMiceDocDrafts").unique())?.status).toBe("draft");
    });

    const revisionHarness = createHarness();
    const revisionFixture = await seedMicePair(revisionHarness);
    const revisionArgs = pairArgs(revisionFixture);
    const revisionActor = revisionHarness.withIdentity(identity("contracting"));
    const firstDraft = await revisionActor.mutation(
      api.crm.proposals.createMiceDocDraft,
      revisionArgs
    );
    await revisionHarness.run(async (ctx) => {
      await ctx.db.patch("proposals", revisionFixture.proposalId, {
        proposalRevision: PROPOSAL_REVISION + 1,
      });
    });
    await expect(
      revisionActor.query(api.crm.proposals.getMiceDocDraft, revisionArgs)
    ).rejects.toThrow("current Proposal revision");
    await expect(
      revisionActor.mutation(api.crm.proposals.markMiceDocDraftReviewed, revisionArgs)
    ).rejects.toThrow("current Proposal revision");

    const currentArgs = pairArgs(revisionFixture, PROPOSAL_REVISION + 1);
    const currentState = await revisionActor.query(api.crm.proposals.getMiceDocDraft, currentArgs);
    expect(currentState?.draft).toBeNull();
    const currentDraft = await revisionActor.mutation(
      api.crm.proposals.createMiceDocDraft,
      currentArgs
    );
    expect(currentDraft.id).not.toBe(firstDraft.id);
    await revisionHarness.run(async (ctx) => {
      const drafts = await ctx.db.query("proposalMiceDocDrafts").collect();
      expect(drafts.map((draft) => draft.proposalRevision).sort()).toEqual([
        PROPOSAL_REVISION,
        PROPOSAL_REVISION + 1,
      ]);
    });
  });
});
