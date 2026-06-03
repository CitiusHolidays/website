import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";
import { fiscalYearForDate, type LeaveType } from "./leavePolicy";
import { PERMISSIONS, requireStaff } from "./lib";

const CL_SL_LAPSE_TYPES: LeaveType[] = ["Casual", "Sick"];
const LAPSE_TIMEZONE = "Asia/Kolkata";

const CL_SL_LAPSE_DAY_PARTS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAPSE_TIMEZONE,
  month: "numeric",
  day: "numeric",
});

const CL_SL_LAPSE_ISO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: LAPSE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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

async function hasLapseEntry(
  ctx: { db: any },
  staffId: Id<"staffUsers">,
  fiscalYear: string,
  leaveType: LeaveType,
) {
  const entries = await ctx.db
    .query("staffLeaveLedger")
    .withIndex("by_staffId_and_fiscalYear", (q: any) =>
      q.eq("staffId", staffId).eq("fiscalYear", fiscalYear),
    )
    .collect();
  return entries.some((entry: any) => entry.leaveType === leaveType && entry.entryType === "lapse");
}

export async function lapseClSlForFiscalYear(ctx: { db: any }, fiscalYear: string) {
  const staffRows = await ctx.db
    .query("staffUsers")
    .withIndex("by_active", (q: any) => q.eq("active", true))
    .collect();
  const now = Date.now();
  const lapseCounts = await Promise.all(
    staffRows.map(async (staff: Doc<"staffUsers">) => {
      const staffLapses = await Promise.all(
        CL_SL_LAPSE_TYPES.map(async (leaveType) => {
          if (await hasLapseEntry(ctx, staff._id, fiscalYear, leaveType)) {
            return 0;
          }

          const balance = await ctx.db
            .query("staffLeaveBalances")
            .withIndex("by_staffId_and_fiscalYear_and_leaveType", (q: any) =>
              q.eq("staffId", staff._id).eq("fiscalYear", fiscalYear).eq("leaveType", leaveType),
            )
            .first();

          const availableDays = balance?.availableDays ?? 0;
          if (availableDays <= 0) {
            return 0;
          }

          await ctx.db.insert("staffLeaveLedger", {
            staffId: staff._id,
            fiscalYear,
            leaveType,
            entryType: "lapse",
            days: availableDays,
            note: `Unused ${leaveType} leave lapsed on 31 March (${fiscalYear}).`,
            createdBy: "system",
            createdAt: now,
          });

          if (balance) {
            await ctx.db.patch(balance._id, {
              availableDays: 0,
              updatedAt: now,
            });
          }

          return 1;
        }),
      );
      return staffLapses.reduce<number>((sum, count) => sum + count, 0);
    }),
  );
  const lapsedRows = lapseCounts.reduce((sum, count) => sum + count, 0);

  return { fiscalYear, lapsedRows };
}

export const runClSlLapse = mutation({
  args: {
    fiscalYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_LEAVE);
    const fiscalYear =
      args.fiscalYear ?? fiscalYearEndingOn31March() ?? fiscalYearForDate("2025-03-31");
    return await lapseClSlForFiscalYear(ctx, fiscalYear);
  },
});

export const checkAndRunClSlLapse = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiscalYear = fiscalYearEndingOn31March();
    if (!fiscalYear) {
      return { skipped: true, reason: "not_lapse_day" };
    }
    const result = await lapseClSlForFiscalYear(ctx, fiscalYear);
    return { skipped: false, ...result };
  },
});
