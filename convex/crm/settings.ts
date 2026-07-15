import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { PERMISSIONS } from "./lib/rolePolicy";
import { requireStaff } from "./lib/staffAccess";
import {
  clearPresetsResultValidator,
  dropdownsResultValidator,
  nullableDropdownIdResultValidator,
} from "./staffSettingsReturnContracts";

const DROPDOWNS: Record<string, string[]> = {
  callingStatus: ["Pending", "Done", "No response"],
  contractingStatus: [
    "Query Received",
    "Proposal in progress",
    "Proposal sent",
    "Change in destination",
    "Date/Destination Change Required",
    "Order Confirmed",
  ],
  foodPreference: ["Veg", "Non-Veg", "Jain", "Vegan"],
  guestType: ["Employee", "Client", "VIP"],
  lostReason: ["Price", "Competition", "Not travelling", "Other"],
  paymentType: ["Company Paid", "Self Paid", "Upgraded Self Paid"],
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
  roomType: ["Single", "Twin", "Double", "Triple", "Child with Bed", "Family Room"],
  salesStatus: [
    "Proposal in discussion",
    "Change in destination",
    "Date/Destination Change Required",
    "Order Confirmed",
    "Order Lost",
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
};

const PRESET_TABLES = ["roleDefinitions", "dropdownOptions", "paymentTerms"] as const;

async function deletePresetRows(ctx: MutationCtx) {
  const deleted = {
    dropdownOptions: 0,
    paymentTerms: 0,
    roleDefinitions: 0,
  };

  await Promise.all(
    PRESET_TABLES.map(async (table) => {
      const rows = await ctx.db.query(table).collect();
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
      deleted[table] = rows.length;
    })
  );

  return { deleted };
}

export const listDropdowns = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return DROPDOWNS;
  },
  returns: dropdownsResultValidator,
});

export const clearPortalPresetData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    return await deletePresetRows(ctx);
  },
  returns: clearPresetsResultValidator,
});

export const clearPortalPresetDataInternal = internalMutation({
  args: {},
  handler: async (ctx) => await deletePresetRows(ctx),
});

export const setDropdownOptionActive = mutation({
  args: {
    active: v.boolean(),
    optionId: v.string(),
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
  returns: nullableDropdownIdResultValidator,
});
