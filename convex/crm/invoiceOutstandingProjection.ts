import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import {
  hasOutstandingInvoiceBalance,
  INVOICE_OUTSTANDING_PROJECTION_KEY,
  INVOICE_OUTSTANDING_PROJECTION_VERSION,
  invoiceOutstandingProjectionMismatch,
  isInvoiceOutstandingProjectionReady,
} from "./invoiceOutstandingPolicy";

const INVOICE_PROJECTION_PAGE_SIZE = 50;

const projectionStageValidator = v.union(
  v.literal("backfill"),
  v.literal("verify"),
  v.literal("complete")
);
const projectionStatusValidator = v.union(
  v.literal("running"),
  v.literal("complete"),
  v.literal("failed")
);
const projectionResultValidator = v.object({
  generation: v.number(),
  processed: v.number(),
  ready: v.boolean(),
  residuals: v.number(),
  scheduled: v.boolean(),
  stage: projectionStageValidator,
  status: projectionStatusValidator,
});
const projectionStatusResultValidator = v.union(v.null(), projectionResultValidator);

type ProjectionReadiness = Doc<"invoiceOutstandingProjectionReadiness">;
type ProjectionStage = ProjectionReadiness["stage"];
interface ProjectionPageArgs {
  cursor: string | null;
  generation: number;
  stage: ProjectionStage;
  [key: string]: unknown;
}

function projectionResult(state: ProjectionReadiness, scheduled: boolean) {
  return {
    generation: state.generation,
    processed: state.processed,
    ready: state.ready,
    residuals: state.residuals,
    scheduled,
    stage: state.stage,
    status: state.status,
  };
}

type ProjectionResult = ReturnType<typeof projectionResult>;
const processProjectionPageReference = makeFunctionReference<
  "action",
  ProjectionPageArgs,
  ProjectionResult
>("crm/invoiceOutstandingProjection:processProjectionPage");
const reconcileProjectionPageReference = makeFunctionReference<
  "mutation",
  ProjectionPageArgs,
  ProjectionResult
>("crm/invoiceOutstandingProjection:reconcileProjectionPage");
const recordProjectionFailureReference = makeFunctionReference<
  "mutation",
  ProjectionPageArgs & { failureCode: string },
  ProjectionResult
>("crm/invoiceOutstandingProjection:recordProjectionFailure");

async function loadProjectionReadiness(ctx: Pick<QueryCtx, "db">) {
  return await ctx.db
    .query("invoiceOutstandingProjectionReadiness")
    .withIndex("by_key", (q) => q.eq("key", INVOICE_OUTSTANDING_PROJECTION_KEY))
    .unique();
}

function pageArgs(state: ProjectionReadiness) {
  return {
    cursor: state.cursor,
    generation: state.generation,
    stage: state.stage,
  };
}

async function scheduleProjectionPage(ctx: MutationCtx, state: ProjectionReadiness) {
  await ctx.scheduler.runAfter(0, processProjectionPageReference, pageArgs(state));
}

export const startProjectionReconciliation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await loadProjectionReadiness(ctx);
    if (
      existing &&
      (existing.status === "running" || isInvoiceOutstandingProjectionReady(existing))
    ) {
      return projectionResult(existing, existing.status === "running");
    }
    const now = Date.now();
    const value = {
      cursor: null,
      generation: (existing?.generation ?? 0) + 1,
      key: INVOICE_OUTSTANDING_PROJECTION_KEY,
      processed: 0,
      ready: false,
      residuals: 0,
      stage: "backfill" as const,
      startedAt: now,
      status: "running" as const,
      updatedAt: now,
      version: INVOICE_OUTSTANDING_PROJECTION_VERSION,
    };
    let stateId: ProjectionReadiness["_id"];
    if (existing) {
      await ctx.db.replace("invoiceOutstandingProjectionReadiness", existing._id, value);
      stateId = existing._id;
    } else {
      stateId = await ctx.db.insert("invoiceOutstandingProjectionReadiness", value);
    }
    const state = await ctx.db.get("invoiceOutstandingProjectionReadiness", stateId);
    if (!state) {
      throw new Error("Invoice outstanding projection state disappeared after creation");
    }
    await scheduleProjectionPage(ctx, state);
    return projectionResult(state, true);
  },
  returns: projectionResultValidator,
});

export const reconcileProjectionPage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    generation: v.number(),
    stage: projectionStageValidator,
  },
  handler: async (ctx, args) => {
    const state = await loadProjectionReadiness(ctx);
    if (!state) {
      throw new Error("Invoice outstanding projection state not found");
    }
    if (
      state.generation !== args.generation ||
      state.status !== "running" ||
      state.stage !== args.stage ||
      state.cursor !== args.cursor
    ) {
      return projectionResult(state, false);
    }
    if (state.stage === "complete") {
      return projectionResult(state, false);
    }

    const page = await ctx.db
      .query("invoices")
      .withIndex("by_createdAt")
      .paginate({ cursor: state.cursor, numItems: INVOICE_PROJECTION_PAGE_SIZE });
    let residuals = 0;
    for (const invoice of page.page) {
      if (!invoiceOutstandingProjectionMismatch(invoice)) {
        continue;
      }
      if (state.stage === "backfill") {
        // biome-ignore lint/performance/noAwaitInLoops: projection repairs are intentionally bounded in one transaction.
        await ctx.db.patch("invoices", invoice._id, {
          hasOutstandingBalance: hasOutstandingInvoiceBalance(invoice.balanceAmount),
        });
      } else {
        residuals += 1;
      }
    }

    const now = Date.now();
    const processed = state.processed + page.page.length;
    const nextResiduals = state.residuals + residuals;
    if (!page.isDone) {
      await ctx.db.patch("invoiceOutstandingProjectionReadiness", state._id, {
        cursor: page.continueCursor,
        processed,
        residuals: nextResiduals,
        updatedAt: now,
      });
    } else if (state.stage === "backfill") {
      await ctx.db.patch("invoiceOutstandingProjectionReadiness", state._id, {
        cursor: null,
        processed,
        residuals: 0,
        stage: "verify",
        updatedAt: now,
      });
    } else {
      await ctx.db.patch("invoiceOutstandingProjectionReadiness", state._id, {
        cursor: null,
        ...(nextResiduals > 0 ? { failureCode: "projection_residuals" } : {}),
        processed,
        ready: nextResiduals === 0,
        residuals: nextResiduals,
        stage: "complete",
        status: nextResiduals === 0 ? "complete" : "failed",
        updatedAt: now,
      });
    }

    const updated = await loadProjectionReadiness(ctx);
    if (!updated) {
      throw new Error("Invoice outstanding projection state disappeared after page update");
    }
    const scheduled = updated.status === "running" && updated.stage !== "complete";
    if (scheduled) {
      await scheduleProjectionPage(ctx, updated);
    }
    return projectionResult(updated, scheduled);
  },
  returns: projectionResultValidator,
});

export const recordProjectionFailure = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    failureCode: v.string(),
    generation: v.number(),
    stage: projectionStageValidator,
  },
  handler: async (ctx, args) => {
    const state = await loadProjectionReadiness(ctx);
    if (!state) {
      throw new Error("Invoice outstanding projection state not found");
    }
    if (
      state.generation === args.generation &&
      state.status === "running" &&
      state.stage === args.stage &&
      state.cursor === args.cursor
    ) {
      await ctx.db.patch("invoiceOutstandingProjectionReadiness", state._id, {
        failureCode: args.failureCode.slice(0, 80),
        ready: false,
        status: "failed",
        updatedAt: Date.now(),
      });
    }
    const updated = await loadProjectionReadiness(ctx);
    return projectionResult(updated ?? state, false);
  },
  returns: projectionResultValidator,
});

export const processProjectionPage = internalAction({
  args: {
    cursor: v.union(v.string(), v.null()),
    generation: v.number(),
    stage: projectionStageValidator,
  },
  handler: async (ctx, args): Promise<ReturnType<typeof projectionResult>> => {
    try {
      return await ctx.runMutation(reconcileProjectionPageReference, args);
    } catch (error) {
      return await ctx.runMutation(recordProjectionFailureReference, {
        ...args,
        failureCode: error instanceof Error ? error.name : "UnknownFailure",
      });
    }
  },
  returns: projectionResultValidator,
});

export const getProjectionStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const state = await loadProjectionReadiness(ctx);
    return state
      ? projectionResult(state, state.status === "running" && state.stage !== "complete")
      : null;
  },
  returns: projectionStatusResultValidator,
});
