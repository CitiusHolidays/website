import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "../_generated/server";
import { fiscalYearForDate, type LeaveType } from "./leavePolicy";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  leaveLapseCheckResultValidator,
  leaveLapseResultValidator,
  leaveLapseStatusResultValidator,
} from "./staffSettingsReturnContracts";

const CL_SL_LAPSE_TYPES: LeaveType[] = ["Casual", "Sick"];
const FISCAL_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;
const LAPSE_TIMEZONE = "Asia/Kolkata";
const STAFF_PAGE_SIZE = 20;

const CL_SL_LAPSE_DAY_PARTS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "numeric",
  timeZone: LAPSE_TIMEZONE,
});

const CL_SL_LAPSE_ISO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: LAPSE_TIMEZONE,
  year: "numeric",
});

export function isClSlLapseDay(value = new Date()) {
  const parts = CL_SL_LAPSE_DAY_PARTS_FORMATTER.formatToParts(value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return month === 3 && day === 31;
}

export function fiscalYearEndingOn31March(value = new Date()) {
  if (!isClSlLapseDay(value)) {
    return null;
  }
  const isoDate = CL_SL_LAPSE_ISO_DATE_FORMATTER.format(value);
  return fiscalYearForDate(isoDate);
}

export function assertClSlLapseFiscalYear(fiscalYear: string) {
  const match = FISCAL_YEAR_PATTERN.exec(fiscalYear);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new ConvexError("Fiscal year must use the YYYY-YYYY format with consecutive years");
  }
  return fiscalYear;
}

type LeaveLapseRun = Doc<"staffLeaveLapseRuns">;

function lapseRunResult(run: LeaveLapseRun, scheduled: boolean) {
  return {
    continuation: run.continuation,
    fiscalYear: run.fiscalYear,
    generation: run.generation,
    lapsedRows: run.lapsedRows,
    processedStaff: run.processedStaff,
    runId: run._id,
    scheduled,
    status: run.status,
  };
}

async function loadLapseState(ctx: { db: MutationCtx["db"] }, fiscalYear: string) {
  return await ctx.db
    .query("staffLeaveLapseState")
    .withIndex("by_fiscalYear", (q) => q.eq("fiscalYear", fiscalYear))
    .unique();
}

async function startLapseRun(
  ctx: MutationCtx,
  args: {
    fiscalYear: string;
    initiatedBy: string;
    trigger: "automatic" | "manual";
  }
) {
  const fiscalYear = assertClSlLapseFiscalYear(args.fiscalYear);
  const existingState = await loadLapseState(ctx, fiscalYear);
  const existingRun = existingState?.activeRunId
    ? await ctx.db.get("staffLeaveLapseRuns", existingState.activeRunId)
    : null;
  if (
    existingRun &&
    (existingRun.status === "queued" ||
      existingRun.status === "running" ||
      existingRun.status === "completed")
  ) {
    return lapseRunResult(
      existingRun,
      existingRun.status === "queued" || existingRun.status === "running"
    );
  }

  const now = Date.now();
  const generation = (existingState?.generation ?? 0) + 1;
  const runId = await ctx.db.insert("staffLeaveLapseRuns", {
    continuation: 0,
    createdAt: now,
    cutoffAt: now,
    fiscalYear,
    generation,
    initiatedBy: args.initiatedBy,
    lapsedRows: 0,
    processedStaff: 0,
    status: "queued",
    trigger: args.trigger,
    updatedAt: now,
  });
  if (existingState) {
    await ctx.db.patch("staffLeaveLapseState", existingState._id, {
      activeRunId: runId,
      generation,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("staffLeaveLapseState", {
      activeRunId: runId,
      fiscalYear,
      generation,
      updatedAt: now,
    });
  }
  await ctx.scheduler.runAfter(0, internal.crm.leaveLapse.processClSlLapsePage, {
    continuation: 0,
    generation,
    runId,
  });
  const run = await ctx.db.get("staffLeaveLapseRuns", runId);
  if (!run) {
    throw new Error("Leave lapse run disappeared after creation");
  }
  return lapseRunResult(run, true);
}

async function hasLapseEntry(
  ctx: { db: MutationCtx["db"] },
  staffId: Id<"staffUsers">,
  fiscalYear: string,
  leaveType: LeaveType
) {
  return Boolean(
    await ctx.db
      .query("staffLeaveLedger")
      .withIndex("by_staffId_and_fiscalYear_and_leaveType_and_entryType", (q) =>
        q
          .eq("staffId", staffId)
          .eq("fiscalYear", fiscalYear)
          .eq("leaveType", leaveType)
          .eq("entryType", "lapse")
      )
      .first()
  );
}

async function lapseStaffBalance(
  ctx: MutationCtx,
  run: LeaveLapseRun,
  staffId: Id<"staffUsers">,
  leaveType: LeaveType,
  now: number
) {
  if (await hasLapseEntry(ctx, staffId, run.fiscalYear, leaveType)) {
    return 0;
  }
  const balance = await ctx.db
    .query("staffLeaveBalances")
    .withIndex("by_staffId_and_fiscalYear_and_leaveType", (q) =>
      q.eq("staffId", staffId).eq("fiscalYear", run.fiscalYear).eq("leaveType", leaveType)
    )
    .first();
  const availableDays = balance?.availableDays ?? 0;
  if (!balance || availableDays <= 0) {
    return 0;
  }
  await ctx.db.insert("staffLeaveLedger", {
    createdAt: now,
    createdBy: "system",
    days: availableDays,
    entryType: "lapse",
    fiscalYear: run.fiscalYear,
    leaveType,
    note: `Unused ${leaveType} leave lapsed on 31 March (${run.fiscalYear}).`,
    staffId,
  });
  await ctx.db.patch("staffLeaveBalances", balance._id, {
    availableDays: 0,
    updatedAt: now,
  });
  return 1;
}

export const applyClSlLapsePage = internalMutation({
  args: {
    continuation: v.number(),
    generation: v.number(),
    runId: v.id("staffLeaveLapseRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get("staffLeaveLapseRuns", args.runId);
    if (!run) {
      throw new Error("Leave lapse run not found");
    }
    const state = await loadLapseState(ctx, run.fiscalYear);
    if (
      state?.activeRunId !== run._id ||
      state.generation !== args.generation ||
      run.generation !== args.generation ||
      run.continuation !== args.continuation ||
      (run.status !== "queued" && run.status !== "running")
    ) {
      return lapseRunResult(run, false);
    }

    const page = await ctx.db
      .query("staffUsers")
      .withIndex("by_active_and_createdAt", (q) =>
        q.eq("active", true).lte("createdAt", run.cutoffAt)
      )
      .paginate({ cursor: run.cursor ?? null, numItems: STAFF_PAGE_SIZE });
    const now = Date.now();
    let lapsedRows = 0;
    for (const staff of page.page) {
      for (const leaveType of CL_SL_LAPSE_TYPES) {
        // biome-ignore lint/performance/noAwaitInLoops: one transaction must atomically observe and patch each balance.
        lapsedRows += await lapseStaffBalance(ctx, run, staff._id, leaveType, now);
      }
    }

    const continuation = run.continuation + 1;
    const status = page.isDone ? ("completed" as const) : ("running" as const);
    await ctx.db.patch("staffLeaveLapseRuns", run._id, {
      ...(page.isDone ? { completedAt: now, cursor: undefined } : { cursor: page.continueCursor }),
      continuation,
      lapsedRows: run.lapsedRows + lapsedRows,
      processedStaff: run.processedStaff + page.page.length,
      startedAt: run.startedAt ?? now,
      status,
      updatedAt: now,
    });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crm.leaveLapse.processClSlLapsePage, {
        continuation,
        generation: run.generation,
        runId: run._id,
      });
    }
    const updated = await ctx.db.get("staffLeaveLapseRuns", run._id);
    if (!updated) {
      throw new Error("Leave lapse run disappeared after page update");
    }
    return lapseRunResult(updated, !page.isDone);
  },
  returns: leaveLapseResultValidator,
});

export const recordClSlLapseFailure = internalMutation({
  args: {
    continuation: v.number(),
    failureCode: v.string(),
    generation: v.number(),
    runId: v.id("staffLeaveLapseRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get("staffLeaveLapseRuns", args.runId);
    if (!run) {
      throw new Error("Leave lapse run not found");
    }
    const state = await loadLapseState(ctx, run.fiscalYear);
    if (
      state?.activeRunId === run._id &&
      state.generation === args.generation &&
      run.generation === args.generation &&
      run.continuation === args.continuation &&
      (run.status === "queued" || run.status === "running")
    ) {
      await ctx.db.patch("staffLeaveLapseRuns", run._id, {
        failureCode: args.failureCode.slice(0, 80),
        status: "failed",
        updatedAt: Date.now(),
      });
    }
    const updated = await ctx.db.get("staffLeaveLapseRuns", run._id);
    return lapseRunResult(updated ?? run, false);
  },
  returns: leaveLapseResultValidator,
});

export const processClSlLapsePage = internalAction({
  args: {
    continuation: v.number(),
    generation: v.number(),
    runId: v.id("staffLeaveLapseRuns"),
  },
  handler: async (ctx, args): Promise<ReturnType<typeof lapseRunResult>> => {
    try {
      return await ctx.runMutation(internal.crm.leaveLapse.applyClSlLapsePage, args);
    } catch (error) {
      const failureCode = error instanceof Error ? error.name : "UnknownFailure";
      return await ctx.runMutation(internal.crm.leaveLapse.recordClSlLapseFailure, {
        ...args,
        failureCode,
      });
    }
  },
  returns: leaveLapseResultValidator,
});

export const startClSlLapseRun = internalMutation({
  args: {
    fiscalYear: v.string(),
    initiatedBy: v.string(),
    trigger: v.union(v.literal("automatic"), v.literal("manual")),
  },
  handler: async (ctx, args) => await startLapseRun(ctx, args),
  returns: leaveLapseResultValidator,
});

export const runClSlLapse = mutation({
  args: {
    fiscalYear: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_LEAVE);
    return await startLapseRun(ctx, {
      fiscalYear: args.fiscalYear,
      initiatedBy: access.authUserId ?? "staff",
      trigger: "manual",
    });
  },
  returns: leaveLapseResultValidator,
});

export const getClSlLapseStatus = query({
  args: {
    fiscalYear: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_LEAVE);
    const fiscalYear = assertClSlLapseFiscalYear(args.fiscalYear);
    const state = await ctx.db
      .query("staffLeaveLapseState")
      .withIndex("by_fiscalYear", (q) => q.eq("fiscalYear", fiscalYear))
      .unique();
    const run = state?.activeRunId
      ? await ctx.db.get("staffLeaveLapseRuns", state.activeRunId)
      : null;
    return run ? lapseRunResult(run, run.status === "queued" || run.status === "running") : null;
  },
  returns: leaveLapseStatusResultValidator,
});

export const checkAndRunClSlLapse = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiscalYear = fiscalYearEndingOn31March();
    if (!fiscalYear) {
      return { reason: "not_lapse_day" as const, skipped: true as const };
    }
    const result = await startLapseRun(ctx, {
      fiscalYear,
      initiatedBy: "system",
      trigger: "automatic",
    });
    return { skipped: false as const, ...result };
  },
  returns: leaveLapseCheckResultValidator,
});
