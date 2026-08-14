import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { publishWorkflowNotification } from "./lib/notifications";
import { notificationTargetProjectionKey } from "./notificationUnreadProjection";

const FIXED_NOW = new Date("2026-08-12T18:00:00.000Z");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function identity(subject: string, email: string) {
  return {
    email,
    issuer: "https://auth.citius.test",
    subject,
    tokenIdentifier: `https://auth.citius.test|${subject}`,
  };
}

const startReconciliation = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { generation: number; scheduled: boolean }
>("crm/notificationUnreadProjectionMigration:startReconciliation");

const continueEntityGroupCleanup = makeFunctionReference<
  "mutation",
  { identities: Array<{ entityId: string; entityType: string }> },
  { deleted: number; remainingEntities: number }
>("crm/notificationCleanup:continueEntityGroupCleanup");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered notification unread projection", () => {
  test("keeps one target total exact when publishers run concurrently", async () => {
    const t = createHarness();

    await t.run(async (ctx) => {
      const content = {
        body: "Concurrent role alert",
        entityType: "query",
        title: "Concurrent role alert",
      };
      await Promise.all([
        publishWorkflowNotification(ctx, {
          bellTargets: { kind: "roles", roles: ["Sales"] },
          content: { ...content, entityId: "query_1" },
          emailTargets: { kind: "none" },
        }),
        publishWorkflowNotification(ctx, {
          bellTargets: { kind: "roles", roles: ["Sales"] },
          content: { ...content, entityId: "query_2" },
          emailTargets: { kind: "none" },
        }),
      ]);
    });

    await t.run(async (ctx) => {
      const targetKey = notificationTargetProjectionKey({ recipientRole: "Sales" });
      const target = await ctx.db
        .query("notificationTargetCounts")
        .withIndex("by_key", (q) => q.eq("key", targetKey))
        .unique();
      expect(target?.total).toBe(2);
      expect(await ctx.db.query("notifications").collect()).toHaveLength(2);
    });
  });

  test("keeps one target total exact when grouped entity cleanup runs concurrently", async () => {
    const t = createHarness();
    const targetKey = notificationTargetProjectionKey({ recipientRole: "Sales" });
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationTargetCounts", {
        key: targetKey,
        total: 2,
        updatedAt: FIXED_NOW.getTime(),
        version: 1,
      });
      await ctx.db.insert("notifications", {
        body: "Query alert",
        createdAt: FIXED_NOW.getTime(),
        entityId: "query_1",
        entityType: "query",
        projectionTargetKey: targetKey,
        projectionVersion: 1,
        recipientRole: "Sales",
        title: "Query alert",
      });
      await ctx.db.insert("notifications", {
        body: "Proposal alert",
        createdAt: FIXED_NOW.getTime(),
        entityId: "proposal_1",
        entityType: "proposal",
        projectionTargetKey: targetKey,
        projectionVersion: 1,
        recipientRole: "Sales",
        title: "Proposal alert",
      });
    });

    await expect(
      t.mutation(continueEntityGroupCleanup, {
        identities: [
          { entityId: "query_1", entityType: "query" },
          { entityId: "proposal_1", entityType: "proposal" },
        ],
      })
    ).resolves.toEqual({ deleted: 2, remainingEntities: 0 });

    await t.run(async (ctx) => {
      const target = await ctx.db
        .query("notificationTargetCounts")
        .withIndex("by_key", (q) => q.eq("key", targetKey))
        .unique();
      expect(target?.total).toBe(0);
      expect(await ctx.db.query("notifications").collect()).toHaveLength(0);
    });
  });

  test("keeps high-history role, direct, role-change, relink, click, and delete totals exact", async () => {
    const t = createHarness();
    const fixture = await t.run(async (ctx) => {
      const insertStaff = async (
        authUserId: string,
        email: string,
        roles: ["Admin"] | ["Sales"]
      ) => {
        await ctx.db.insert("authIdentityLinks", {
          canonicalAuthUserId: `https://auth.citius.test|${authUserId}`,
          createdAt: FIXED_NOW.getTime(),
          legacyAuthUserId: authUserId,
          status: "linked",
          updatedAt: FIXED_NOW.getTime(),
        });
        return await ctx.db.insert("staffUsers", {
          active: true,
          authUserId,
          createdAt: FIXED_NOW.getTime(),
          email,
          emailNormalized: email,
          name: authUserId,
          roles,
          updatedAt: FIXED_NOW.getTime(),
        });
      };
      const staffA = await insertStaff("auth_a", "a@citius.test", ["Sales"]);
      const staffB = await insertStaff("auth_b", "b@citius.test", ["Sales"]);
      await insertStaff("auth_admin", "admin@citius.test", ["Admin"]);
      const staffRoleId = await ctx.db.insert("notifications", {
        body: "Staff and current role",
        createdAt: FIXED_NOW.getTime() + 1001,
        recipientRole: "Sales",
        recipientStaffId: staffA,
        title: "Staff role alert",
      });
      const directId = await ctx.db.insert("notifications", {
        body: "Stable staff target",
        createdAt: FIXED_NOW.getTime() + 1002,
        recipientStaffId: staffA,
        recipientUserId: "old_auth_a",
        title: "Direct alert",
      });
      const legacyReadId = await ctx.db.insert("notifications", {
        body: "Legacy direct read",
        createdAt: FIXED_NOW.getTime() + 1003,
        readAt: FIXED_NOW.getTime(),
        recipientStaffId: staffA,
        title: "Already read",
      });
      return { directId, legacyReadId, staffA, staffB, staffRoleId };
    });

    const roleIds: Id<"notifications">[] = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const batch = await t.run(async (ctx) => {
        const ids: Id<"notifications">[] = [];
        for (let index = offset; index < offset + 100; index += 1) {
          ids.push(
            await ctx.db.insert("notifications", {
              body: `Role history ${index}`,
              createdAt: FIXED_NOW.getTime() + index,
              recipientRole: "Sales",
              title: `Role alert ${index}`,
            })
          );
        }
        return ids;
      });
      roleIds.push(...batch);
    }
    for (let offset = 0; offset < 900; offset += 100) {
      await t.run(async (ctx) => {
        for (const notificationId of roleIds.slice(offset, offset + 100)) {
          await ctx.db.insert("notificationReads", {
            notificationId,
            readAt: FIXED_NOW.getTime() + offset,
            staffId: fixture.staffA,
          });
        }
      });
    }

    const started = await t.mutation(startReconciliation, {});
    expect(started).toEqual({ generation: 1, scheduled: true });
    await t.run(async (ctx) => {
      const readiness = await ctx.db
        .query("notificationUnreadProjectionReadiness")
        .withIndex("by_key", (q) => q.eq("key", "notificationUnread"))
        .unique();
      expect(readiness).toMatchObject({ ready: false, stage: "notifications", status: "running" });
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const asA = t.withIdentity(identity("auth_a", "a@citius.test"));
    const asB = t.withIdentity(identity("auth_b", "b@citius.test"));
    const initialA = await asA.query(api.crm.activity.notificationBellState, { limit: 8 });
    const initialB = await asB.query(api.crm.activity.notificationBellState, { limit: 8 });
    expect(initialA).toMatchObject({ coverage: "complete", unreadCount: 102 });
    expect(initialB).toMatchObject({ coverage: "complete", unreadCount: 1000 });
    expect(initialA.notifications).toHaveLength(8);

    await asA.mutation(api.crm.activity.markNotificationRead, {
      notificationId: String(fixture.directId),
    });
    expect(await asA.query(api.crm.activity.notificationBellState, { limit: 8 })).toMatchObject({
      coverage: "complete",
      unreadCount: 101,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: "https://auth.citius.test|auth_a_relinked",
        createdAt: FIXED_NOW.getTime() + 2000,
        legacyAuthUserId: "auth_a_relinked",
        status: "linked",
        updatedAt: FIXED_NOW.getTime() + 2000,
      });
      await ctx.db.patch("staffUsers", fixture.staffA, {
        authUserId: "auth_a_relinked",
        roles: ["Operations"],
        updatedAt: FIXED_NOW.getTime() + 2000,
      });
    });
    const asRelinkedA = t.withIdentity(identity("auth_a_relinked", "a@citius.test"));
    expect(
      await asRelinkedA.query(api.crm.activity.notificationBellState, { limit: 8 })
    ).toMatchObject({ coverage: "complete", unreadCount: 0 });
    await t.run(async (ctx) => {
      await ctx.db.patch("staffUsers", fixture.staffA, {
        roles: ["Sales"],
        updatedAt: FIXED_NOW.getTime() + 2001,
      });
    });
    expect(
      await asRelinkedA.query(api.crm.activity.notificationBellState, { limit: 8 })
    ).toMatchObject({ coverage: "complete", unreadCount: 101 });

    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    await asAdmin.mutation(api.crm.activity.removeNotification, {
      notificationId: String(roleIds[999]),
    });
    expect(
      await asRelinkedA.query(api.crm.activity.notificationBellState, { limit: 8 })
    ).toMatchObject({ coverage: "complete", unreadCount: 100 });
    expect(await asB.query(api.crm.activity.notificationBellState, { limit: 8 })).toMatchObject({
      coverage: "complete",
      unreadCount: 999,
    });

    await t.run(async (ctx) => {
      const readiness = await ctx.db
        .query("notificationUnreadProjectionReadiness")
        .withIndex("by_key", (q) => q.eq("key", "notificationUnread"))
        .unique();
      expect(readiness).toMatchObject({
        ready: true,
        residuals: 0,
        stage: "complete",
        status: "complete",
      });
      const direct = await ctx.db.get("notifications", fixture.directId);
      const staffRole = await ctx.db.get("notifications", fixture.staffRoleId);
      const legacyReceipt = await ctx.db
        .query("notificationReads")
        .withIndex("by_notification_staff", (q) =>
          q.eq("notificationId", fixture.legacyReadId).eq("staffId", fixture.staffA)
        )
        .unique();
      expect(direct?.projectionVersion).toBe(1);
      expect(staffRole?.projectionVersion).toBe(1);
      expect(legacyReceipt?.projectionVersion).toBe(1);
    });
  });
});
