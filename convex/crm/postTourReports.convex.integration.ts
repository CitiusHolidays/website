import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { emptyPostTourReport } from "../lib/postTourReportContent";
import schema from "../schema";
import { modules } from "../test.setup";
import { notificationRecipientCanAccess } from "./notificationEmailAudience";

const NOW = Date.parse("2026-10-21T10:00:00Z");
const issuer = "https://tour-report.test";
const people = {
  admin: ["Admin"],
  contracting: ["Contracting"],
  director: ["Directors"],
  dual: ["Directors", "Finance"],
  finance: ["Finance"],
  financeHead: ["Finance"],
  hr: ["HR"],
  inactive: ["Directors"],
  oldContracting: ["Contracting"],
  ops: ["Operations"],
  opsHead: ["Operations Head"],
  otherOps: ["Operations"],
  otherTm: ["Tour Manager"],
  sales: ["Sales"],
  tm: ["Tour Manager"],
} satisfies Record<string, Doc<"staffUsers">["roles"]>;
type Person = keyof typeof people;
async function fixture() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  rateLimiterTest.register(t, "rateLimiter");
  const data = await t.run(async (ctx) => {
    // SAFETY: The closed people fixture fills every declared key before this record is returned.
    const ids = {} as Record<Person, Id<"staffUsers">>;
    for (const [name, roles] of Object.entries(people)) {
      const auth = `auth-${name}`;
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${issuer}|${auth}`,
        createdAt: NOW,
        legacyAuthUserId: auth,
        status: "linked",
        updatedAt: NOW,
      });
      // SAFETY: Object.entries enumerates only the declared people keys.
      ids[name as Person] = await ctx.db.insert("staffUsers", {
        active: name !== "inactive",
        authUserId: auth,
        createdAt: NOW,
        email: `${name.toLowerCase()}@example.invalid`,
        emailAlertRoles: name === "hr" ? ["Directors", "Finance", "Sales", "Contracting"] : [],
        emailNormalized: `${name.toLowerCase()}@example.invalid`,
        function: name === "financeHead" || name === "dual" ? "Finance Head" : undefined,
        name,
        roles,
        updatedAt: NOW,
      });
    }
    const queryId = await ctx.db.insert("queries", {
      clientName: "Synthetic report group",
      contractingOwnerId: ids.oldContracting,
      contractingStatus: "Query Received",
      createdAt: NOW,
      createdBy: "auth-sales",
      paxCount: 20,
      queryCode: "Q-REPORT",
      queryType: "MICE",
      salesOwnerId: ids.sales,
      salesStatus: "Order Confirmed",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    });
    const jobId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic report group",
      confirmedPax: 20,
      contractingOwnerId: ids.contracting,
      createdAt: NOW,
      createdBy: "auth-sales",
      destination: "Jaipur",
      jobCode: "JC-REPORT",
      operationsOwnerId: ids.ops,
      queryId,
      queryType: "MICE",
      status: "Closed",
      travelEndDate: "2026-10-04",
      travelStartDate: "2026-10-01",
      updatedAt: NOW,
    });
    const assignmentId = await ctx.db.insert("tourManagerAssignments", {
      callingStatus: "Pending",
      createdAt: NOW,
      createdBy: "auth-opsHead",
      jobCardId: jobId,
      name: "tm",
      staffId: ids.tm,
      status: "Assigned",
      updatedAt: NOW,
    });
    return { assignmentId, ids, jobId, queryId };
  });
  const actor = (name: Person) =>
    t.withIdentity({
      email: `${name.toLowerCase()}@example.invalid`,
      issuer,
      subject: `auth-${name}`,
      tokenIdentifier: `${issuer}|auth-${name}`,
    });
  const content = emptyPostTourReport({
    client: "Synthetic report group",
    destination: "Jaipur",
    endDate: "2026-10-04",
    guests: 20,
    programme: "MICE / Corporate",
    startDate: "2026-10-01",
    tourManager: "tm",
  });
  content.performance = { handling: 5, itinerary: 4, overall: 4, satisfaction: 5, services: 3 };
  content.highlights = "Arrival support, useful sessions, city visit.";
  content.suppliers = content.suppliers.map((s) => ({ ...s, rating: "na" }));
  content.closure = {
    additionalCost: "No",
    billing: "Completed",
    budgetVariation: "No",
    pendingDetails: "",
    refundPending: "No",
  };
  content.assessment = {
    learnings: "Allow transfer time, check rooms, brief hosts.",
    rating: 8,
    repeat: "Yes, with changes",
    status: "Good",
  };
  const save = (name: Person = "tm", expectedRevision = 0) =>
    actor(name).mutation(api.crm.postTourReports.saveDraft, {
      content,
      expectedRevision,
      jobCardId: data.jobId,
    });
  const submit = async () => {
    const saved = await save();
    await actor("tm").mutation(api.crm.postTourReports.submit, {
      expectedRevision: saved.revision,
      reportId: saved.id,
    });
    return saved.id;
  };
  return { t, ...data, actor, content, save, submit };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", () => {
    throw new Error("External requests forbidden");
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("only assigned role equivalents prepare, drafts stay private and all CRM staff read submitted snapshots", async () => {
  const f = await fixture();
  const saved = await f.save();
  for (const name of ["otherTm", "otherOps", "sales", "director", "hr"] as const) {
    await expect(f.save(name, 1)).rejects.toThrow("FORBIDDEN");
  }
  expect(
    await f.actor("hr").query(api.crm.postTourReports.workspace, { jobCardId: f.jobId })
  ).toBeNull();
  const own = await f.actor("tm").query(api.crm.postTourReports.workspace, { jobCardId: f.jobId });
  expect(own?.report).toMatchObject({ canEdit: true, preparedBy: "tm", status: "draft" });
  await f.actor("ops").mutation(api.crm.postTourReports.saveDraft, {
    content: f.content,
    expectedRevision: saved.revision,
    jobCardId: f.jobId,
    reportId: saved.id,
  });
  await f
    .actor("opsHead")
    .mutation(api.crm.postTourReports.submit, { expectedRevision: 2, reportId: saved.id });
  expect(
    (await f.actor("hr").query(api.crm.postTourReports.workspace, { reportId: saved.id }))?.report
  ).toMatchObject({
    canArchive: false,
    canEdit: false,
    preparedBy: "opsHead",
    status: "submitted",
    submittedAt: NOW,
  });
  await expect(
    f.actor("hr").query(api.crm.jobCards.getDetail, { jobCardId: f.jobId })
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    f.t.query(api.crm.postTourReports.workspace, { reportId: saved.id })
  ).rejects.toThrow("FORBIDDEN");
});
test("submission uses exactly active Directors, Finance Heads and current related Sales/Contracting, once across repeats and overlaps", async () => {
  const f = await fixture();
  const saved = await f.save();
  expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(0);
  await f
    .actor("tm")
    .mutation(api.crm.postTourReports.submit, { expectedRevision: 1, reportId: saved.id });
  await f
    .actor("tm")
    .mutation(api.crm.postTourReports.submit, { expectedRevision: 1, reportId: saved.id });
  await f.t.run(async (ctx) => {
    const bell = await ctx.db.query("notifications").collect(),
      mail = await ctx.db.query("notificationEmailOutbox").collect();
    expect(bell.map((n) => n.recipientStaffId).sort()).toEqual(
      [f.ids.director, f.ids.dual, f.ids.financeHead, f.ids.sales, f.ids.contracting].sort()
    );
    expect(mail.map((n) => n.recipient).sort()).toEqual(
      [
        "director@example.invalid",
        "dual@example.invalid",
        "financehead@example.invalid",
        "sales@example.invalid",
        "contracting@example.invalid",
      ].sort()
    );
    expect(mail.every((n) => n.recipientPurposes?.[0]?.kind === "work")).toBe(true);
    expect(JSON.stringify([...bell, ...mail])).not.toContain(f.content.assessment.learnings);
    expect(JSON.stringify([...bell, ...mail])).not.toContain(f.content.highlights);
    expect(
      (await ctx.db.query("activityLogs").collect()).filter(
        (row) => row.entityType === "postTourReport" && row.action === "submitted"
      )
    ).toHaveLength(1);
  });
});
test("rechecks reassignment, active status, cancelled alerts and Admin-only recoverable archive", async () => {
  const f = await fixture();
  const id = await f.submit();
  const jobs = await f.t.run((ctx) => ctx.db.query("notificationEmailOutbox").collect());
  const salesJob = jobs.find((row) => row.recipientStaffId === f.ids.sales);
  expect(salesJob).toBeDefined();
  await f.t.run((ctx) => ctx.db.patch("queries", f.queryId, { salesOwnerId: undefined }));
  await f.t.run(async (ctx) => {
    const member = await ctx.db.get("staffUsers", f.ids.sales);
    expect(
      member && salesJob && (await notificationRecipientCanAccess(ctx, member, salesJob))
    ).toBe(false);
  });
  await expect(
    f
      .actor("director")
      .mutation(api.crm.postTourReports.archive, { expectedRevision: 2, reportId: id })
  ).rejects.toThrow("FORBIDDEN");
  await f
    .actor("admin")
    .mutation(api.crm.postTourReports.archive, { expectedRevision: 2, reportId: id });
  expect(
    await f.actor("hr").query(api.crm.postTourReports.workspace, { jobCardId: f.jobId })
  ).toBeNull();
  const admin = await f
    .actor("admin")
    .query(api.crm.postTourReports.workspace, { jobCardId: f.jobId });
  expect(admin?.report).toBeNull();
  expect(admin?.archived).toHaveLength(1);
  await f.actor("admin").mutation(api.crm.postTourReports.archive, {
    expectedRevision: 3,
    reportId: id,
    restore: true,
  });
  await f.t.run(async (ctx) => {
    const member = await ctx.db.get("staffUsers", f.ids.director);
    const mail = jobs.find((row) => row.recipientStaffId === f.ids.director);
    expect(member && mail && (await notificationRecipientCanAccess(ctx, member, mail))).toBe(false);
    expect(await ctx.db.get("postTourReports", id)).toMatchObject({
      content: f.content,
      status: "submitted",
      submissionAlertsCancelled: true,
    });
    expect(
      (await ctx.db.query("activityLogs").collect()).filter((row) =>
        ["archived", "restored"].includes(row.action)
      )
    ).toHaveLength(2);
  });
});
test("stale revisions and invalid submission cannot overwrite or publish a draft", async () => {
  const f = await fixture();
  const saved = await f.save();
  await expect(f.save("tm", 0)).rejects.toThrow("changed in another session");
  const content = { ...f.content, performance: { ...f.content.performance, overall: 0 } };
  await expect(
    f.actor("tm").mutation(api.crm.postTourReports.saveDraft, {
      content,
      expectedRevision: 1,
      jobCardId: f.jobId,
    })
  ).rejects.toThrow("from 1 to 5");
  const incomplete = emptyPostTourReport();
  await f.actor("tm").mutation(api.crm.postTourReports.saveDraft, {
    content: incomplete,
    expectedRevision: 1,
    jobCardId: f.jobId,
    reportId: saved.id,
  });
  await expect(
    f
      .actor("tm")
      .mutation(api.crm.postTourReports.submit, { expectedRevision: 2, reportId: saved.id })
  ).rejects.toThrow("required tour details");
  expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(0);
});
test("removed assignments, inactive staff and deleted Job Cards fail closed without public access", async () => {
  const f = await fixture();
  const saved = await f.save();
  await f.t.run((ctx) =>
    ctx.db.patch("tourManagerAssignments", f.assignmentId, { status: "Inactive" })
  );
  await expect(
    f
      .actor("tm")
      .mutation(api.crm.postTourReports.submit, { expectedRevision: 1, reportId: saved.id })
  ).rejects.toThrow("FORBIDDEN");
  await f.t.run((ctx) => ctx.db.patch("staffUsers", f.ids.ops, { active: false }));
  await expect(f.save("ops", 1)).rejects.toThrow("FORBIDDEN");
  await f.t.run((ctx) => ctx.db.delete("jobCards", f.jobId));
  expect(
    await f.actor("admin").query(api.crm.postTourReports.workspace, { reportId: saved.id })
  ).toBeNull();
  await expect(
    f
      .actor("admin")
      .mutation(api.crm.postTourReports.archive, { expectedRevision: 1, reportId: saved.id })
  ).rejects.toThrow("no longer available");
});

test("a replacement draft cannot be overwritten by a stale form with the same revision", async () => {
  const f = await fixture();
  const first = await f.save();
  await f
    .actor("admin")
    .mutation(api.crm.postTourReports.archive, { expectedRevision: 1, reportId: first.id });
  const replacement = await f.save();
  expect(replacement.revision).toBe(1);
  await expect(
    f.actor("tm").mutation(api.crm.postTourReports.saveDraft, {
      content: { ...f.content, highlights: "Stale overwrite" },
      expectedRevision: 1,
      jobCardId: f.jobId,
      reportId: first.id,
    })
  ).rejects.toThrow("changed in another session");
  await expect(
    f.actor("admin").mutation(api.crm.postTourReports.archive, {
      expectedRevision: 2,
      reportId: first.id,
      restore: true,
    })
  ).rejects.toThrow("current report already exists");
  expect(
    await f.actor("hr").query(api.crm.postTourReports.workspace, { reportId: first.id })
  ).toBeNull();
  expect(
    (await f.actor("tm").query(api.crm.postTourReports.workspace, { jobCardId: f.jobId }))?.report
      ?.content.highlights
  ).toBe(f.content.highlights);
});

test("assigned Operations equivalents retain Cement scope and a matching customer email grants no report access", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch("staffUsers", f.ids.ops, { roles: ["Operations Cement"] }));
  await expect(f.save("ops")).rejects.toThrow("FORBIDDEN");
  await f.t.run(async (ctx) => {
    await ctx.db.patch("queries", f.queryId, { queryType: "Cement" });
    await ctx.db.patch("jobCards", f.jobId, { queryType: "Cement" });
  });
  const saved = await f.save("ops");
  await f
    .actor("ops")
    .mutation(api.crm.postTourReports.submit, { expectedRevision: 1, reportId: saved.id });
  await expect(
    f.t
      .withIdentity({
        email: "hr@example.invalid",
        issuer,
        subject: "unprovisioned-customer",
        tokenIdentifier: `${issuer}|unprovisioned-customer`,
      })
      .query(api.crm.postTourReports.workspace, { reportId: saved.id })
  ).rejects.toThrow("FORBIDDEN");
});
