import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { PERMISSIONS, requireStaff } from "./lib";

const DROPDOWNS: Record<string, string[]> = {
  queryType: [
    "MICE",
    "MICE Bidding",
    "Cement",
    "Cement Bidding",
    "FIT",
    "Family Group",
    "B2B",
    "Spiritual",
  ],
  salesStatus: ["Proposal in discussion", "Change in destination", "Order Confirmed", "Order Lost"],
  contractingStatus: [
    "Query Received",
    "Proposal in progress",
    "Proposal sent",
    "Change in destination",
    "Order Confirmed",
  ],
  lostReason: ["Price", "Competition", "Not travelling", "Other"],
  travelType: ["Domestic Travel", "International Travel"],
  visaStatus: [
    "Not Required",
    "Not Started",
    "Checklist Shared",
    "Documents Pending",
    "Documents Verified",
    "Appointment Scheduled",
    "Submitted",
    "Awaiting",
    "Approved",
    "Rejected",
    "Re-applied",
  ],
  ticketStatus: [
    "Pending Issue",
    "Issued",
    "Name Change Required",
    "Reissue Required",
    "Cancelled",
    "Refund Pending",
    "Refunded",
  ],
  paymentType: ["Company Paid", "Self Paid", "Upgraded Self Paid"],
  roomType: ["SGL", "Twin", "DBL", "Child with Bed", "Family Room"],
  foodPreference: ["Veg", "Non-Veg", "Jain", "Vegan"],
  callingStatus: ["Pending", "Done", "No response"],
  guestType: ["Employee", "Client", "VIP"],
};

const PRESET_TABLES = ["roleDefinitions", "dropdownOptions", "paymentTerms"] as const;

async function deletePresetRows(ctx: MutationCtx) {
  const deleted: Record<string, number> = {};

  await Promise.all(
    PRESET_TABLES.map(async (table) => {
      const rows = await ctx.db.query(table).collect();
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
      deleted[table] = rows.length;
    }),
  );

  return { deleted };
}

export const listDropdowns = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return DROPDOWNS;
  },
});

export const clearPortalPresetData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    return await deletePresetRows(ctx);
  },
});

export const clearPortalPresetDataInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await deletePresetRows(ctx);
  },
});

export const setDropdownOptionActive = mutation({
  args: {
    optionId: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_DROPDOWNS);
    const id = ctx.db.normalizeId("dropdownOptions", args.optionId);
    if (!id) {
      return null;
    }
    await ctx.db.patch(id, { active: args.active, updatedAt: Date.now() });
    return { id };
  },
});
