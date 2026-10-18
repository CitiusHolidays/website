import { ConvexError, v } from "convex/values";

export const staffTravelStatusValidator = v.union(v.literal("planned"), v.literal("cancelled"));
export const tourExperienceSourceValidator = v.union(
  v.literal("self_reported"),
  v.literal("staff_recorded")
);
export const staffTravelOutputValidator = v.object({
  canManage: v.boolean(),
  createdAt: v.number(),
  destination: v.string(),
  endDate: v.string(),
  id: v.id("staffTravelPlans"),
  isCurrent: v.boolean(),
  jobCardId: v.union(v.id("jobCards"), v.null()),
  jobCode: v.string(),
  personName: v.string(),
  staffId: v.id("staffUsers"),
  startDate: v.string(),
  status: staffTravelStatusValidator,
  updatedAt: v.number(),
});
export const externalTourManagerOutputValidator = v.object({
  active: v.boolean(),
  canManage: v.boolean(),
  createdAt: v.number(),
  destinations: v.array(v.string()),
  email: v.string(),
  experienceSummary: v.string(),
  experienceYears: v.union(v.number(), v.null()),
  id: v.id("externalTourManagerProfiles"),
  name: v.string(),
  phone: v.string(),
  reportedPastTours: v.union(v.number(), v.null()),
  reportedPastToursNote: v.string(),
  reportedPastToursSource: tourExperienceSourceValidator,
  updatedAt: v.number(),
});
export const externalTourManagerFields = {
  destinations: v.array(v.string()),
  email: v.optional(v.string()),
  experienceSummary: v.optional(v.string()),
  experienceYears: v.optional(v.union(v.number(), v.null())),
  name: v.string(),
  phone: v.optional(v.string()),
  reportedPastTours: v.optional(v.union(v.number(), v.null())),
  reportedPastToursNote: v.optional(v.string()),
  reportedPastToursSource: v.optional(tourExperienceSourceValidator),
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function checkedTravelDates(startDate: string, endDate: string) {
  for (const date of [startDate, endDate]) {
    if (
      !(DATE_PATTERN.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00.000Z`))) ||
      new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
    ) {
      throw new ConvexError("Enter valid travel dates in YYYY-MM-DD format");
    }
  }
  if (startDate > endDate) {
    throw new ConvexError("Travel start date must be on or before the end date");
  }
}
