import { describe, expect, spyOn, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { RuntimeObject } from "../lib/runtimeValues";
import type { PortalAccess } from "./lib";
// biome-ignore lint/performance/noNamespaceImport: Bun spies must patch the live module exports used by the mutation.
import * as lib from "./lib";
import { moveSalesPipelineStage } from "./queries";

function access(overrides: Partial<PortalAccess> = {}): PortalAccess {
  return {
    allowed: true,
    authUserId: "auth_sales",
    email: "sales@citiusholidays.com",
    name: "Sales User",
    permissions: ["manage:queries"],
    roles: ["Sales"],
    staffId: "staff_sales",
    ...overrides,
  };
}

function mutationContext(queryOverrides: RuntimeObject = {}) {
  const query = {
    _id: "queries_1",
    leadStage: "Inquiry",
    queryCode: "Q-0001",
    queryType: "FIT",
    salesOwnerId: "auth_sales",
    salesOwnerName: "Sales User",
    salesStatus: "Proposal in discussion",
    ...queryOverrides,
  };
  const patches: RuntimeObject[] = [];
  return {
    ctx: {
      db: {
        get: async () => query,
        normalizeId: (_table: string, id: string) => id,
        patch: async (_table: string, _id: string, patch: RuntimeObject) => patches.push(patch),
      },
      scheduler: { runAfter: async () => undefined },
    },
    patches,
  };
}

describe("MoveSalesPipelineStage mutation", () => {
  test("Persists one allowed move and records one activity without notifications", async () => {
    const { ctx, patches } = mutationContext();
    const requireStaff = spyOn(lib, "requireStaff").mockResolvedValue(access());
    const createActivity = spyOn(lib, "createActivity").mockResolvedValue(undefined);
    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await (moveSalesPipelineStage as any)._handler(ctx, {
        expectedLeadStage: "Inquiry",
        queryId: "queries_1",
        targetStage: "Proposal",
      });
      expect(result).toMatchObject({
        fromStage: "Inquiry",
        id: "queries_1",
        toStage: "Proposal",
      });
      expect(patches).toHaveLength(1);
      expect(patches[0]).toMatchObject({ leadStage: "Proposal" });
      expect(createActivity).toHaveBeenCalledTimes(1);
    } finally {
      requireStaff.mockRestore();
      createActivity.mockRestore();
    }
  });

  test("Rejects stale cards before writing", async () => {
    const { ctx, patches } = mutationContext({ leadStage: "Negotiation" });
    const requireStaff = spyOn(lib, "requireStaff").mockResolvedValue(access());
    try {
      await expect(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        (moveSalesPipelineStage as any)._handler(ctx, {
          expectedLeadStage: "Inquiry",
          queryId: "queries_1",
          targetStage: "Proposal",
        })
      ).rejects.toEqual(new ConvexError("Pipeline card is out of date. Refresh and try again."));
      expect(patches).toEqual([]);
    } finally {
      requireStaff.mockRestore();
    }
  });

  test("Rechecks Sales authority and Cement scope", async () => {
    const { ctx, patches } = mutationContext();
    const requireStaff = spyOn(lib, "requireStaff").mockResolvedValue(
      access({ roles: ["Contracting"] })
    );
    try {
      await expect(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        (moveSalesPipelineStage as any)._handler(ctx, {
          expectedLeadStage: "Inquiry",
          queryId: "queries_1",
          targetStage: "Proposal",
        })
      ).rejects.toEqual(new ConvexError("Only Sales can move Sales Pipeline cards"));

      requireStaff.mockResolvedValue(access({ roles: ["Director Cement"] }));
      await expect(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        (moveSalesPipelineStage as any)._handler(ctx, {
          expectedLeadStage: "Inquiry",
          queryId: "queries_1",
          targetStage: "Proposal",
        })
      ).rejects.toEqual(new ConvexError("Cement roles can only move Cement query types"));
      expect(patches).toEqual([]);
    } finally {
      requireStaff.mockRestore();
    }
  });
});
