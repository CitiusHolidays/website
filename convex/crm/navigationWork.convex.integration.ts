import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import schema from "../schema";
import { modules } from "../test.setup";
import { publishWorkflowNotification } from "./lib/notifications";
import { projectNavigationActivity } from "./navigationActivityProjection";
import { deleteNotificationWithProjection } from "./notificationUnreadProjection";

const issuer = "https://navigation.test";
const NOW = 1000;
async function projectIds(ctx: MutationCtx, ids: Id<"notifications">[]) {
  const notices = (await Promise.all(ids.map((id) => ctx.db.get("notifications", id)))).filter(
    (row): row is Doc<"notifications"> => Boolean(row)
  );
  await projectNavigationActivity(ctx, notices, await ctx.db.query("staffUsers").collect());
}

async function fixture() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  const data = await t.run(async (ctx) => {
    const people = {
      contracting: ["Contracting"],
      head: ["Sales Head", "Contracting Head", "Operations Head", "Head of Ticketing"],
      inactive: ["Admin"],
      ops: ["Operations"],
      other: ["Sales"],
      sales: ["Sales"],
      ticketing: ["Ticketing"],
    } satisfies Record<string, Doc<"staffUsers">["roles"]>;
    const ids: Record<string, Id<"staffUsers">> = {};
    await Promise.all(
      Object.entries(people).map(async ([name, roles]) => {
        ids[name] = await ctx.db.insert("staffUsers", {
          active: name !== "inactive",
          authUserId: `auth-${name}`,
          createdAt: NOW,
          email: `${name}@example.invalid`,
          emailNormalized: `${name}@example.invalid`,
          name,
          roles,
          updatedAt: NOW,
        });
        await ctx.db.insert("authIdentityLinks", {
          canonicalAuthUserId: `${issuer}|auth-${name}`,
          createdAt: NOW,
          legacyAuthUserId: `auth-${name}`,
          status: "linked",
          updatedAt: NOW,
        });
      })
    );
    const queryId = await ctx.db.insert("queries", {
      clientName: "Synthetic navigation",
      contractingOwnerId: ids.contracting,
      contractingStatus: "Query Received",
      createdAt: NOW,
      createdBy: "auth-sales",
      paxCount: 1,
      queryCode: "Q-TEST",
      queryType: "FIT",
      salesOwnerId: "auth-sales",
      salesStatus: "Proposal in discussion",
      submittedToContractingAt: NOW,
      ticketingOwnerId: ids.ticketing,
      ticketingScope: "Both",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    });
    const jobId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic navigation",
      confirmedPax: 1,
      contractingOwnerId: ids.contracting,
      createdAt: NOW,
      createdBy: "auth-sales",
      jobCode: "JC-TEST",
      operationsOwnerId: ids.ops,
      queryId,
      status: "Open",
      ticketingOwnerId: ids.ticketing,
      updatedAt: NOW,
    });
    const ticketId = await ctx.db.insert("tickets", {
      createdAt: NOW,
      createdBy: "auth-ticketing",
      jobCardId: jobId,
      paymentType: "Company Paid",
      ticketStatus: "Pending Issue",
      updatedAt: NOW,
    });
    const notice = await ctx.db.insert("notifications", {
      body: "Synthetic",
      createdAt: NOW,
      entityId: queryId,
      entityType: "query",
      readAt: NOW,
      recipientStaffId: ids.sales,
      title: "New work",
    });
    await projectIds(ctx, [notice]);
    return { ids, jobId, notice, queryId, ticketId };
  });
  const actor = (name: string) =>
    t.withIdentity({
      email: `${name}@example.invalid`,
      issuer,
      subject: `auth-${name}`,
      tokenIdentifier: `${issuer}|auth-${name}`,
    });
  return { actor, t, ...data };
}

test("counts use current assignment and authorized legacy ownership, never team totals", async () => {
  const f = await fixture();
  const sales = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(sales.byHref["/portal/queries"]).toEqual({
    complete: true,
    count: 1,
    eventIds: [f.notice],
    newActivity: true,
  });
  expect(
    (await f.actor("other").query(api.crm.navShortcuts.workState, {})).byHref["/portal/queries"]
  ).toEqual({ complete: true, count: 0, eventIds: [], newActivity: false });
  expect(
    (await f.actor("contracting").query(api.crm.navShortcuts.workState, {})).byHref[
      "/portal/contracting"
    ].count
  ).toBe(1);
  const ticketing = await f.actor("ticketing").query(api.crm.navShortcuts.workState, {});
  expect(ticketing.byHref["/portal/tickets"].count).toBe(1);
  expect(ticketing.byHref["/portal/ticketing"].count).toBe(1);
  expect(ticketing.byHref["/portal/job-cards"].count).toBe(1);
  expect(ticketing.byHref["/portal/travellers"]).toBeUndefined();
  await expect(f.actor("inactive").query(api.crm.navShortcuts.workState, {})).rejects.toThrow();
});

test("exact acknowledgement survives refresh without changing workload or inbox, and preserves a racing arrival", async () => {
  const f = await fixture();
  const next = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("notifications", {
      body: "Synthetic",
      createdAt: NOW,
      entityId: f.queryId,
      entityType: "query",
      recipientStaffId: f.ids.sales,
      title: "Another arrival",
    });
    await projectIds(ctx, [id]);
    return id;
  });
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: [f.notice, f.notice],
    viewerKey: String(f.ids.sales),
  });
  const state = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(state.byHref["/portal/queries"].count).toBe(1);
  expect(state.byHref["/portal/queries"].newActivity).toBe(true);
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: [next],
    viewerKey: String(f.ids.sales),
  });
  expect(
    (await f.actor("sales").query(api.crm.navShortcuts.workState, {})).byHref["/portal/queries"]
      .newActivity
  ).toBe(false);
  const rows = await f.t.run(async (ctx) => ({
    notice: await ctx.db.get("notifications", next),
    reads: await ctx.db.query("notificationReads").collect(),
    seen: await ctx.db.query("portalNavigationActivity").collect(),
  }));
  expect(rows.seen).toHaveLength(1);
  expect(rows.reads).toEqual([]);
  expect(rows.notice?.readAt).toBeUndefined();
});

test("acknowledgements stay personal and route-scoped while reassignment changes the workload", async () => {
  const f = await fixture();
  await f.actor("other").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: [f.notice],
    viewerKey: String(f.ids.other),
  });
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/leave",
    notificationIds: [f.notice],
    viewerKey: String(f.ids.sales),
  });
  await f.t.run((ctx) => ctx.db.patch("queries", f.queryId, { salesOwnerId: "auth-other" }));
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: [f.notice],
    viewerKey: String(f.ids.sales),
  });
  expect(await f.t.run((ctx) => ctx.db.query("portalNavigationActivity").collect())).toHaveLength(
    1
  );
  expect(
    (await f.actor("sales").query(api.crm.navShortcuts.workState, {})).byHref["/portal/queries"]
      .count
  ).toBe(0);
});

test("unassigned head oversight and dual-role ownership count each item once; heads can own work", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch("queries", f.queryId, {
      contractingOwnerId: undefined,
      salesOwnerId: undefined,
    });
    await ctx.db.patch("jobCards", f.jobId, {
      contractingOwnerId: f.ids.head,
      operationsOwnerId: f.ids.head,
      ticketingOwnerId: f.ids.head,
    });
  });
  const state = await f.actor("head").query(api.crm.navShortcuts.workState, {});
  expect(state.byHref["/portal/queries"].count).toBe(1);
  expect(state.byHref["/portal/contracting"].count).toBe(1);
  expect(state.byHref["/portal/job-cards"].count).toBe(1);
  expect(state.byHref["/portal/tickets"].count).toBe(1);
});

test("closed work removes its count; previously received activity remains until the destination is opened", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch("queries", f.queryId, { salesStatus: "Order Lost" });
    await ctx.db.patch("jobCards", f.jobId, { status: "Closed" });
    await ctx.db.insert("notifications", {
      body: "Synthetic",
      createdAt: NOW,
      entityId: f.ticketId,
      entityType: "ticket",
      recipientStaffId: f.ids.ticketing,
      title: "Ticket",
    });
  });
  expect(
    (await f.actor("sales").query(api.crm.navShortcuts.workState, {})).byHref["/portal/queries"]
  ).toEqual({ complete: true, count: 0, eventIds: [f.notice], newActivity: true });
  const state = await f.actor("ticketing").query(api.crm.navShortcuts.workState, {});
  expect(state.byHref["/portal/tickets"].count).toBe(0);
  expect(state.byHref["/portal/tickets"].newActivity).toBe(false);
});

test("read budgets expose a lower bound instead of claiming an exact total", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const row = await ctx.db.get("queries", f.queryId);
    if (!row) {
      throw new Error("Missing fixture");
    }
    const { _id, _creationTime, ...fields } = row;
    await Promise.all(
      Array.from({ length: 121 }, (_, index) =>
        ctx.db.insert("queries", { ...fields, queryCode: `Q-${index}` })
      )
    );
  });
  const state = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(state.byHref["/portal/queries"].complete).toBe(false);
  expect(state.byHref["/portal/queries"].count).toBe(121);
});

test("marker retention follows notification deletion and cleanup never erases a live source", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: [f.notice],
    viewerKey: String(f.ids.sales),
  });
  await f.t.mutation(internal.crm.navShortcuts.cleanupSeenForNotification, {
    notificationId: f.notice,
  });
  expect(await f.t.run((ctx) => ctx.db.query("portalNavigationActivity").collect())).toHaveLength(
    1
  );
  await f.t.run(async (ctx) => {
    const row = await ctx.db.get("notifications", f.notice);
    if (row) {
      await deleteNotificationWithProjection(ctx, row);
    }
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await f.t.run((ctx) => ctx.db.query("portalNavigationActivity").collect())).toEqual([]);
  vi.useRealTimers();
});

test("Draft proposal responsibility and collaboration survive, while lost links and sent proposals stop counting", async () => {
  const f = await fixture();
  const proposalId = await f.t.run((ctx) =>
    ctx.db.insert("proposals", {
      clientName: "Synthetic",
      createdAt: NOW,
      createdBy: "auth-contracting",
      preparedBy: "contracting",
      proposalCode: "P-TEST",
      queryId: f.queryId,
      status: "Draft",
      updatedAt: NOW,
    })
  );
  expect(
    (await f.actor("contracting").query(api.crm.navShortcuts.workState, {})).byHref[
      "/portal/proposals"
    ].count
  ).toBe(1);
  expect(
    (await f.actor("other").query(api.crm.navShortcuts.workState, {})).byHref["/portal/proposals"]
      ?.count ?? 0
  ).toBe(0);
  await f.t.run((ctx) => ctx.db.patch("queries", f.queryId, { salesStatus: "Order Lost" }));
  expect(
    (await f.actor("contracting").query(api.crm.navShortcuts.workState, {})).byHref[
      "/portal/proposals"
    ].count
  ).toBe(0);
  await f.t.run((ctx) =>
    ctx.db.patch("proposals", proposalId, { collaboratorStaffIds: [f.ids.contracting] })
  );
  expect(
    (await f.actor("contracting").query(api.crm.navShortcuts.workState, {})).byHref[
      "/portal/proposals"
    ].count
  ).toBe(1);
  await f.t.run((ctx) => ctx.db.patch("proposals", proposalId, { status: "Sent" }));
  expect(
    (await f.actor("contracting").query(api.crm.navShortcuts.workState, {})).byHref[
      "/portal/proposals"
    ].count
  ).toBe(0);
});

test("unassigned work falls to relevant heads, with no ticketing obligation for trips requiring no ticketing", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    ctx.db.patch("jobCards", f.jobId, { operationsOwnerId: undefined, ticketingOwnerId: undefined })
  );
  expect(
    (await f.actor("head").query(api.crm.navShortcuts.workState, {})).byHref["/portal/job-cards"]
      .count
  ).toBe(1);
  expect(
    (await f.actor("ops").query(api.crm.navShortcuts.workState, {})).byHref["/portal/job-cards"]
      .count
  ).toBe(0);
  await f.t.run(async (ctx) => {
    await ctx.db.patch("queries", f.queryId, { ticketingScope: "Not required" });
    await ctx.db.patch("jobCards", f.jobId, { operationsOwnerId: f.ids.ops });
    await ctx.db.patch("staffUsers", f.ids.head, { roles: ["Head of Ticketing"] });
  });
  expect(
    (await f.actor("head").query(api.crm.navShortcuts.workState, {})).byHref["/portal/job-cards"]
      .count
  ).toBe(0);
});

test("a delayed acknowledgement cannot cross an authenticated staff switch", async () => {
  const f = await fixture();
  await expect(
    f.actor("other").mutation(api.crm.navShortcuts.acknowledgeActivity, {
      href: "/portal/queries",
      notificationIds: [f.notice],
      viewerKey: String(f.ids.sales),
    })
  ).rejects.toThrow("Invalid navigation acknowledgement");
  expect(
    (await f.t.run((ctx) => ctx.db.query("portalNavigationActivity").collect()))[0].seenAt
  ).toBeUndefined();
});

test("unrelated newer notices cannot evict unseen destination activity", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        ctx.db.insert("notifications", {
          body: "Synthetic",
          createdAt: NOW + index + 1,
          recipientStaffId: f.ids.sales,
          title: `Other notice ${index}`,
        })
      )
    );
  });
  const state = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(state.byHref["/portal/queries"].newActivity).toBe(true);
  expect(state.byHref["/portal/queries"].eventIds).toEqual([f.notice]);
});

test("the real notification publisher projects one scoped personal arrival atomically", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "roles", roles: ["Sales"] },
      content: {
        body: "Synthetic",
        entityId: f.queryId,
        entityType: "query",
        title: "New query assigned",
      },
      emailTargets: { kind: "none" },
    })
  );
  const sales = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(sales.byHref["/portal/queries"].newActivity).toBe(true);
  expect(sales.byHref["/portal/queries"].eventIds).toHaveLength(1);
  expect(sales.byHref["/portal/queries"].eventIds).not.toContain(f.notice);
  expect(
    (await f.actor("other").query(api.crm.navShortcuts.workState, {})).byHref["/portal/queries"]
      .newActivity
  ).toBe(false);
  expect(await f.t.run((ctx) => ctx.db.query("portalNavigationActivity").collect())).toHaveLength(
    1
  );
});

test("a sent proposal gives its assigned Sales owner activity without inventing Draft workload", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const proposalId = await ctx.db.insert("proposals", {
      clientName: "Synthetic",
      createdAt: NOW,
      createdBy: "auth-contracting",
      preparedBy: "contracting",
      proposalCode: "P-SENT",
      queryId: f.queryId,
      status: "Sent",
      updatedAt: NOW,
    });
    await publishWorkflowNotification(ctx, {
      bellTargets: { kind: "roles", roles: ["Sales"] },
      content: {
        body: "Synthetic",
        entityId: String(proposalId),
        entityType: "proposal",
        title: "Proposal ready",
      },
      emailTargets: { kind: "none" },
    });
  });
  const sales = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(sales.byHref["/portal/proposals"].count).toBe(0);
  expect(sales.byHref["/portal/proposals"].newActivity).toBe(true);
  expect(
    (await f.actor("other").query(api.crm.navShortcuts.workState, {})).byHref["/portal/proposals"]
      ?.newActivity ?? false
  ).toBe(false);
});

test("disabled bell controls do not create activity or undo a previous acknowledgement", async () => {
  const f = await fixture();
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: [f.notice],
    viewerKey: String(f.ids.sales),
  });
  await f.t.run(async (ctx) => {
    await ctx.db.insert("operationalControlPlaneState", {
      activatedAt: NOW,
      activatedBy: "fixture",
      activatedByName: "Fixture",
      key: "global",
      reason: "Synthetic control test",
      revision: 1,
    });
    await ctx.db.insert("operationalControlStates", {
      key: "notifications.crm_bell",
      reason: "Synthetic disabled control",
      revision: 1,
      state: "disabled",
      updatedAt: NOW,
      updatedBy: "fixture",
      updatedByName: "Fixture",
    });
    await publishWorkflowNotification(ctx, {
      bellTargets: { kind: "exactStaff", staffIds: [f.ids.sales] },
      content: {
        body: "Synthetic",
        entityId: f.queryId,
        entityType: "query",
        title: "Suppressed query",
      },
      emailTargets: { kind: "none" },
    });
  });
  const state = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(state.byHref["/portal/queries"].newActivity).toBe(false);
  expect(state.byHref["/portal/queries"].eventIds).toEqual([f.notice]);
});

test("revoking route permission removes its badge and prevents acknowledging its old activity", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch("staffUsers", f.ids.sales, { roles: ["HR"] }));
  const state = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(state.byHref["/portal/queries"]).toBeUndefined();
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: [f.notice],
    viewerKey: String(f.ids.sales),
  });
  expect(
    (await f.t.run((ctx) => ctx.db.query("portalNavigationActivity").collect()))[0].seenAt
  ).toBeUndefined();
});

test("replaying a delivered event cannot restore an acknowledged dot", async () => {
  const f = await fixture();
  const publish = () =>
    f.t.run((ctx) =>
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "exactStaff", staffIds: [f.ids.sales] },
        content: {
          body: "Synthetic",
          entityId: f.queryId,
          entityType: "query",
          title: "Assigned query",
        },
        emailTargets: { kind: "none" },
        operationalControls: { effectId: "navigation-replay-fixture" },
      })
    );
  await publish();
  const first = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  await f.actor("sales").mutation(api.crm.navShortcuts.acknowledgeActivity, {
    href: "/portal/queries",
    notificationIds: first.byHref["/portal/queries"].eventIds,
    viewerKey: String(f.ids.sales),
  });
  await publish();
  const replay = await f.actor("sales").query(api.crm.navShortcuts.workState, {});
  expect(replay.byHref["/portal/queries"].newActivity).toBe(false);
  expect(replay.byHref["/portal/queries"].eventIds).toEqual(
    first.byHref["/portal/queries"].eventIds
  );
});
