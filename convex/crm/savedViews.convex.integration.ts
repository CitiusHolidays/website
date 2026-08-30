import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const FIXED_NOW = new Date("2026-08-30T12:00:00.000Z").getTime();

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

describe("registered saved view ownership", () => {
  test("keeps shared layouts manager-owned, role-scoped, and mutation-protected", async () => {
    const t = createHarness();
    await t.run(async (ctx) => {
      for (const staff of [
        { authUserId: "auth_admin", email: "admin@citius.test", roles: ["Admin"] as const },
        {
          authUserId: "auth_director",
          email: "director@citius.test",
          roles: ["Directors"] as const,
        },
        {
          authUserId: "auth_director_cement",
          email: "director-cement@citius.test",
          roles: ["Director Cement"] as const,
        },
        { authUserId: "auth_finance", email: "finance@citius.test", roles: ["Finance"] as const },
        { authUserId: "auth_sales", email: "sales@citius.test", roles: ["Sales"] as const },
      ]) {
        await ctx.db.insert("staffUsers", {
          active: true,
          authUserId: `https://auth.citius.test|${staff.authUserId}`,
          createdAt: FIXED_NOW,
          email: staff.email,
          emailNormalized: staff.email,
          name: staff.authUserId,
          roles: [...staff.roles],
          updatedAt: FIXED_NOW,
        });
      }
    });

    const admin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const director = t.withIdentity(identity("auth_director", "director@citius.test"));
    const directorCement = t.withIdentity(
      identity("auth_director_cement", "director-cement@citius.test")
    );
    const finance = t.withIdentity(identity("auth_finance", "finance@citius.test"));
    const sales = t.withIdentity(identity("auth_sales", "sales@citius.test"));
    const financePrivate = await finance.mutation(api.crm.savedViews.create, {
      filterState: { status: "Pending" },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "My finance queue",
      pathname: "/portal/finance",
      view: "finance",
    });
    const directorPrivate = await director.mutation(api.crm.savedViews.create, {
      filterState: { status: "Open" },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "My director queue",
      pathname: "/portal/job-cards",
      view: "job-cards",
    });
    const created = await admin.mutation(api.crm.savedViews.create, {
      filterState: {
        columns: ["invoice", "amount", "status"],
        kind: "portal-table-layout-v1",
        scope: "finance:invoices",
        sort: { columnId: "amount", direction: "desc" },
      },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "Finance review",
      pathname: "/portal/finance",
      sharedRole: "Finance",
      view: "finance",
    });
    const malformed = await admin.mutation(api.crm.savedViews.create, {
      filterState: {
        columns: "status",
        kind: "portal-table-layout-v1",
        scope: "finance:invoices",
        sort: null,
      },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "Stale finance layout",
      pathname: "/portal/finance",
      sharedRole: "Finance",
      view: "finance",
    });
    const directorsShared = await admin.mutation(api.crm.savedViews.create, {
      filterState: { status: "Open" },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "Directors overview",
      pathname: "/portal/job-cards",
      sharedRole: "Directors",
      view: "job-cards",
    });
    const mixedOwnership = await t.run(
      async (ctx) =>
        await ctx.db.insert("portalSavedViews", {
          createdAt: FIXED_NOW,
          createdBy: "https://auth.citius.test|auth_admin",
          filterState: {
            columns: ["invoice"],
            kind: "portal-table-layout-v1",
            scope: "finance:invoices",
            sort: null,
          },
          isFavorite: false,
          isPinnedToDashboard: false,
          name: "Mixed legacy ownership",
          ownerAuthUserId: "https://auth.citius.test|auth_sales",
          pathname: "/portal/finance",
          sharedRole: "Finance",
          updatedAt: FIXED_NOW,
          view: "finance",
        })
    );

    const adminResult = await admin.query(api.crm.savedViews.listForPortal, {
      view: "finance",
    });
    expect(adminResult.overflowBuckets).toEqual([]);
    expect(adminResult.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canMutate: true, id: created.id, sharedRole: "Finance" }),
        expect.objectContaining({ canMutate: true, id: malformed.id, sharedRole: "Finance" }),
        expect.objectContaining({ canMutate: true, id: mixedOwnership, sharedRole: "Finance" }),
      ])
    );
    const directorResult = await director.query(api.crm.savedViews.listForPortal, {
      view: "finance",
    });
    expect(directorResult.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canMutate: true, id: created.id, sharedRole: "Finance" }),
        expect.objectContaining({ canMutate: true, id: malformed.id, sharedRole: "Finance" }),
        expect.objectContaining({ canMutate: true, id: mixedOwnership, sharedRole: "Finance" }),
      ])
    );
    const directorOwnResult = await director.query(api.crm.savedViews.listForPortal, {
      view: "job-cards",
    });
    expect(directorOwnResult.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canMutate: true,
          id: directorsShared.id,
          sharedRole: "Directors",
        }),
        expect.objectContaining({ canMutate: true, id: directorPrivate.id, sharedRole: null }),
      ])
    );
    const financeResult = await finance.query(api.crm.savedViews.listForPortal, {
      view: "finance",
    });
    expect(financeResult.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canMutate: false, id: created.id, sharedRole: "Finance" }),
        expect.objectContaining({ canMutate: false, id: malformed.id, sharedRole: "Finance" }),
        expect.objectContaining({ canMutate: false, id: mixedOwnership, sharedRole: "Finance" }),
        expect.objectContaining({ canMutate: true, id: financePrivate.id, sharedRole: null }),
      ])
    );
    expect((await sales.query(api.crm.savedViews.listForPortal, { view: "finance" })).rows).toEqual(
      []
    );
    const directorShared = await director.mutation(api.crm.savedViews.create, {
      filterState: { status: "Open" },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "Directors layout",
      pathname: "/portal/job-cards",
      sharedRole: "Directors",
      view: "job-cards",
    });
    await expect(
      director.mutation(api.crm.savedViews.update, {
        name: "Director-managed layout",
        savedViewId: String(directorShared.id),
      })
    ).resolves.toEqual({ id: directorShared.id });
    await expect(
      director.mutation(api.crm.savedViews.remove, { savedViewId: String(directorShared.id) })
    ).resolves.toEqual({ id: directorShared.id });
    await expect(
      directorCement.mutation(api.crm.savedViews.create, {
        filterState: { status: "Open" },
        isFavorite: false,
        isPinnedToDashboard: false,
        name: "Unauthorized Director Cement layout",
        pathname: "/portal/job-cards",
        sharedRole: "Director Cement",
        view: "job-cards",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      finance.mutation(api.crm.savedViews.update, {
        name: "Unauthorized rename",
        savedViewId: String(created.id),
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      finance.mutation(api.crm.savedViews.remove, { savedViewId: String(created.id) })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      finance.mutation(api.crm.savedViews.remove, { savedViewId: String(mixedOwnership) })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      sales.mutation(api.crm.savedViews.remove, { savedViewId: String(created.id) })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      admin.mutation(api.crm.savedViews.remove, { savedViewId: String(financePrivate.id) })
    ).rejects.toThrow("FORBIDDEN");

    await expect(
      admin.mutation(api.crm.savedViews.remove, { savedViewId: String(malformed.id) })
    ).resolves.toEqual({ id: malformed.id });
    await expect(
      admin.mutation(api.crm.savedViews.remove, { savedViewId: String(mixedOwnership) })
    ).resolves.toEqual({ id: mixedOwnership });
    await expect(
      admin.mutation(api.crm.savedViews.remove, { savedViewId: String(created.id) })
    ).resolves.toEqual({ id: created.id });
    expect(
      (await finance.query(api.crm.savedViews.listForPortal, { view: "finance" })).rows
    ).toEqual([
      expect.objectContaining({ canMutate: true, id: financePrivate.id, sharedRole: null }),
    ]);
  });

  test("caps shared-view writes with an actionable delete-first recovery", async () => {
    const t = createHarness();
    const adminAuthUserId = "https://auth.citius.test|auth_admin";
    const sharedIds = await t.run(async (ctx) => {
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: adminAuthUserId,
        createdAt: FIXED_NOW,
        email: "admin@citius.test",
        emailNormalized: "admin@citius.test",
        name: "Admin",
        roles: ["Admin"],
        updatedAt: FIXED_NOW,
      });
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: "https://auth.citius.test|auth_finance",
        createdAt: FIXED_NOW,
        email: "finance@citius.test",
        emailNormalized: "finance@citius.test",
        name: "Finance",
        roles: ["Finance"],
        updatedAt: FIXED_NOW,
      });
      return await Promise.all(
        Array.from({ length: 100 }, (_, index) =>
          ctx.db.insert("portalSavedViews", {
            createdAt: FIXED_NOW + index,
            createdBy: adminAuthUserId,
            filterState: { status: `state-${index}` },
            isFavorite: false,
            isPinnedToDashboard: false,
            name: `Finance view ${index + 1}`,
            pathname: "/portal/finance",
            sharedRole: "Finance",
            updatedAt: FIXED_NOW + index,
            view: "finance",
          })
        )
      );
    });
    const admin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const createArgs = {
      filterState: { status: "Pending" },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "One more finance view",
      pathname: "/portal/finance",
      sharedRole: "Finance",
      view: "finance",
    } as const;

    await expect(admin.mutation(api.crm.savedViews.create, createArgs)).rejects.toThrow(
      "Saved view limit reached for Finance role. Delete an existing saved view before creating another."
    );
    const atLimit = await admin.query(api.crm.savedViews.listForPortal, { view: "finance" });
    expect(atLimit.overflowBuckets).toEqual([]);
    expect(atLimit.rows).toHaveLength(100);
    const overflowId = await t.run(
      async (ctx) =>
        await ctx.db.insert("portalSavedViews", {
          createdAt: FIXED_NOW + 101,
          createdBy: adminAuthUserId,
          filterState: { status: "legacy-overflow" },
          isFavorite: false,
          isPinnedToDashboard: false,
          name: "Legacy overflow view",
          pathname: "/portal/finance",
          sharedRole: "Finance",
          updatedAt: FIXED_NOW + 101,
          view: "finance",
        })
    );
    const overflowed = await admin.query(api.crm.savedViews.listForPortal, { view: "finance" });
    expect(overflowed.overflowBuckets).toEqual([
      {
        canDelete: true,
        kind: "shared",
        label: "Finance role",
        sharedRole: "Finance",
      },
    ]);
    expect(overflowed.rows).toHaveLength(100);
    expect(overflowed.rows.map((row) => row.id)).not.toContain(overflowId);
    const finance = t.withIdentity(identity("auth_finance", "finance@citius.test"));
    const financeOverflowed = await finance.query(api.crm.savedViews.listForPortal, {
      view: "finance",
    });
    expect(financeOverflowed.overflowBuckets).toEqual([
      {
        canDelete: false,
        kind: "shared",
        label: "Finance role",
        sharedRole: "Finance",
      },
    ]);
    await expect(
      admin.mutation(api.crm.savedViews.remove, { savedViewId: String(sharedIds[0]) })
    ).resolves.toEqual({ id: sharedIds[0] });
    const revealed = await admin.query(api.crm.savedViews.listForPortal, { view: "finance" });
    expect(revealed.overflowBuckets).toEqual([]);
    expect(revealed.rows).toHaveLength(100);
    expect(revealed.rows.map((row) => row.id)).toContain(overflowId);
    await expect(
      admin.mutation(api.crm.savedViews.remove, { savedViewId: String(sharedIds[1]) })
    ).resolves.toEqual({ id: sharedIds[1] });
    await expect(admin.mutation(api.crm.savedViews.create, createArgs)).resolves.toEqual({
      id: expect.any(String),
    });
  });

  test("keeps mixed shared rows outside private quota and identifies private overflow", async () => {
    const t = createHarness();
    const salesAuthUserId = "https://auth.citius.test|auth_sales";
    const privateIds = await t.run(async (ctx) => {
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: salesAuthUserId,
        createdAt: FIXED_NOW,
        email: "sales@citius.test",
        emailNormalized: "sales@citius.test",
        name: "Sales",
        roles: ["Sales"],
        updatedAt: FIXED_NOW,
      });
      await ctx.db.insert("portalSavedViews", {
        createdAt: FIXED_NOW,
        createdBy: salesAuthUserId,
        filterState: { status: "legacy-shared" },
        isFavorite: false,
        isPinnedToDashboard: false,
        name: "Mixed legacy row",
        ownerAuthUserId: salesAuthUserId,
        pathname: "/portal/finance",
        sharedRole: "Finance",
        updatedAt: FIXED_NOW,
        view: "finance",
      });
      return await Promise.all(
        Array.from({ length: 99 }, (_, index) =>
          ctx.db.insert("portalSavedViews", {
            createdAt: FIXED_NOW + index + 1,
            createdBy: salesAuthUserId,
            filterState: { status: `private-${index}` },
            isFavorite: false,
            isPinnedToDashboard: false,
            name: `Private sales view ${index + 1}`,
            ownerAuthUserId: salesAuthUserId,
            pathname: "/portal/queries",
            updatedAt: FIXED_NOW + index + 1,
            view: "queries",
          })
        )
      );
    });
    const sales = t.withIdentity(identity("auth_sales", "sales@citius.test"));
    const createArgs = {
      filterState: { status: "Open" },
      isFavorite: false,
      isPinnedToDashboard: false,
      name: "Private view 100",
      pathname: "/portal/queries",
      view: "queries",
    } as const;

    await expect(sales.mutation(api.crm.savedViews.create, createArgs)).resolves.toEqual({
      id: expect.any(String),
    });
    await expect(sales.mutation(api.crm.savedViews.create, createArgs)).rejects.toThrow(
      "Saved view limit reached for your account. Delete an existing saved view before creating another."
    );
    const overflowId = await t.run(
      async (ctx) =>
        await ctx.db.insert("portalSavedViews", {
          createdAt: FIXED_NOW + 101,
          createdBy: salesAuthUserId,
          filterState: { status: "legacy-overflow" },
          isFavorite: false,
          isPinnedToDashboard: false,
          name: "Private overflow view",
          ownerAuthUserId: salesAuthUserId,
          pathname: "/portal/queries",
          updatedAt: FIXED_NOW + 101,
          view: "queries",
        })
    );
    const overflowed = await sales.query(api.crm.savedViews.listForPortal, { view: "queries" });
    expect(overflowed.overflowBuckets).toEqual([
      {
        canDelete: true,
        kind: "private",
        label: "your account",
        sharedRole: null,
      },
    ]);
    expect(overflowed.rows).toHaveLength(100);
    expect(overflowed.rows.map((row) => row.id)).not.toContain(overflowId);

    await sales.mutation(api.crm.savedViews.remove, { savedViewId: String(privateIds[0]) });
    const revealed = await sales.query(api.crm.savedViews.listForPortal, { view: "queries" });
    expect(revealed.overflowBuckets).toEqual([]);
    expect(revealed.rows).toHaveLength(100);
    expect(revealed.rows.map((row) => row.id)).toContain(overflowId);
  });
});
