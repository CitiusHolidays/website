import { type Infer, v } from "convex/values";

export const REPORT_PROGRAMMES = [
  "MICE / Corporate",
  "Incentive Tour",
  "Leisure / FIT / Group",
  "Other",
] as const;
export const REPORT_HITS = [
  "Hotel / accommodation",
  "Food / restaurants",
  "Transport / transfers",
  "Activities / sightseeing",
  "Event venue / production",
  "Tour Manager / team",
  "Supplier / DMC coordination",
  "Client communication",
] as const;
export const REPORT_MISSES = [...REPORT_HITS, "Itinerary / timing", "Budget / costing"] as const;
export const REPORT_SUPPLIERS = [
  "Hotel",
  "Restaurant / catering",
  "Transport provider",
  "DMC / local operator",
  "Event venue / production",
  "Airline",
] as const;
export const REPORT_PERFORMANCE = [
  ["overall", "How would you rate the overall tour?"],
  ["satisfaction", "How satisfied was the client / group?"],
  ["itinerary", "How smoothly was the itinerary executed?"],
  ["services", "How well did the hotel, food and transport meet expectations?"],
  ["handling", "How effectively did the team handle unexpected situations?"],
] as const;
const optionalRating = v.union(v.number(), v.null());
const yesNo = v.union(v.literal(""), v.literal("Yes"), v.literal("No"));
export const postTourReportContentValidator = v.object({
  assessment: v.object({
    learnings: v.string(),
    rating: optionalRating,
    repeat: v.string(),
    status: v.string(),
  }),
  closure: v.object({
    additionalCost: yesNo,
    billing: v.union(v.literal(""), v.literal("Completed"), v.literal("Pending")),
    budgetVariation: yesNo,
    pendingDetails: v.string(),
    refundPending: yesNo,
  }),
  highlights: v.string(),
  hits: v.array(v.string()),
  issue: v.string(),
  misses: v.array(v.string()),
  nextTime: v.string(),
  performance: v.object({
    handling: optionalRating,
    itinerary: optionalRating,
    overall: optionalRating,
    satisfaction: optionalRating,
    services: optionalRating,
  }),
  resolution: v.string(),
  suppliers: v.array(
    v.object({
      category: v.string(),
      followUp: v.string(),
      rating: v.union(v.number(), v.literal("na"), v.null()),
    })
  ),
  tour: v.object({
    client: v.string(),
    destination: v.string(),
    endDate: v.string(),
    guests: v.union(v.number(), v.null()),
    programme: v.string(),
    startDate: v.string(),
    tourManager: v.string(),
  }),
});
export type PostTourReportContent = Infer<typeof postTourReportContentValidator>;
export function emptyPostTourReport(
  tour?: Partial<PostTourReportContent["tour"]>
): PostTourReportContent {
  return {
    assessment: { learnings: "", rating: null, repeat: "", status: "" },
    closure: {
      additionalCost: "",
      billing: "",
      budgetVariation: "",
      pendingDetails: "",
      refundPending: "",
    },
    highlights: "",
    hits: [],
    issue: "",
    misses: [],
    nextTime: "",
    performance: {
      handling: null,
      itinerary: null,
      overall: null,
      satisfaction: null,
      services: null,
    },
    resolution: "",
    suppliers: REPORT_SUPPLIERS.map((category) => ({ category, followUp: "", rating: null })),
    tour: {
      client: "",
      destination: "",
      endDate: "",
      guests: null,
      programme: "",
      startDate: "",
      tourManager: "",
      ...tour,
    },
  };
}
export function reportNeedsClosureDetails(closure: PostTourReportContent["closure"]) {
  return (
    closure.additionalCost === "Yes" ||
    closure.budgetVariation === "Yes" ||
    closure.refundPending === "Yes" ||
    closure.billing === "Pending"
  );
}
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: string) {
  if (!DATE_ONLY.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validRating(value: number | null, max: number) {
  return value !== null && Number.isInteger(value) && value >= 1 && value <= max;
}
function reportTextError(content: PostTourReportContent): string | null {
  const allText = [
    content.tour.client,
    content.tour.destination,
    content.tour.tourManager,
    content.highlights,
    content.issue,
    content.resolution,
    content.nextTime,
    content.closure.pendingDetails,
    content.assessment.learnings,
    ...content.suppliers.map((s) => s.followUp),
  ];
  if (allText.some((value) => value.length > 4000)) {
    return "Keep each comment or detail within 4,000 characters.";
  }
  if (
    content.tour.client.length > 200 ||
    content.tour.destination.length > 200 ||
    content.tour.tourManager.length > 200
  ) {
    return "Keep tour names and destination within 200 characters.";
  }
  if (
    content.tour.programme &&
    !REPORT_PROGRAMMES.some((value) => value === content.tour.programme)
  ) {
    return "Choose a listed programme type.";
  }
  return null;
}
function reportSelectionError(content: PostTourReportContent): string | null {
  if (
    content.hits.length > REPORT_HITS.length ||
    new Set(content.hits).size !== content.hits.length ||
    content.hits.some((value) => !REPORT_HITS.some((option) => option === value))
  ) {
    return "Choose valid, distinct Hits.";
  }
  if (
    content.misses.length > REPORT_MISSES.length ||
    new Set(content.misses).size !== content.misses.length ||
    content.misses.some((value) => !REPORT_MISSES.some((option) => option === value))
  ) {
    return "Choose valid, distinct Misses.";
  }
  if (
    content.suppliers.length !== REPORT_SUPPLIERS.length ||
    content.suppliers.some((supplier, index) => supplier.category !== REPORT_SUPPLIERS[index])
  ) {
    return "Keep the six supplier categories in their original order.";
  }
  if (
    Object.values(content.performance).some((value) => value !== null && !validRating(value, 5)) ||
    content.suppliers.some(
      (s) => s.rating !== "na" && s.rating !== null && !validRating(s.rating, 5)
    )
  ) {
    return "Choose performance and supplier ratings from 1 to 5; use N.A. only for suppliers.";
  }
  if (content.assessment.rating !== null && !validRating(content.assessment.rating, 10)) {
    return "Choose the final tour rating from 1 to 10.";
  }
  return null;
}
function reportTourError(content: PostTourReportContent): string | null {
  if (
    content.tour.guests !== null &&
    (!Number.isSafeInteger(content.tour.guests) ||
      content.tour.guests < 1 ||
      content.tour.guests > 100_000)
  ) {
    return "Enter a whole guest count from 1 to 100,000.";
  }
  if (
    (content.tour.startDate && !validDate(content.tour.startDate)) ||
    (content.tour.endDate && !validDate(content.tour.endDate)) ||
    (content.tour.startDate &&
      content.tour.endDate &&
      content.tour.endDate < content.tour.startDate)
  ) {
    return "Choose valid tour dates with the end on or after the start.";
  }
  if (
    content.assessment.status &&
    !["Excellent", "Good", "Needs Improvement"].includes(content.assessment.status)
  ) {
    return "Choose a listed overall status.";
  }
  if (
    content.assessment.repeat &&
    !["Yes", "Yes, with changes", "No"].includes(content.assessment.repeat)
  ) {
    return "Choose whether to repeat this destination and itinerary.";
  }
  return null;
}
function reportSubmissionError(content: PostTourReportContent): string | null {
  if (
    !(
      content.tour.client.trim() &&
      content.tour.destination.trim() &&
      content.tour.tourManager.trim() &&
      validDate(content.tour.startDate) &&
      validDate(content.tour.endDate)
    ) ||
    content.tour.guests === null
  ) {
    return "Complete the required tour details.";
  }
  if (Object.values(content.performance).some((value) => value === null)) {
    return "Rate all five tour performance questions.";
  }
  if (!content.highlights.trim()) {
    return "Add the three biggest highlights of the tour.";
  }
  if (
    content.misses.length &&
    !(content.issue.trim() && content.resolution.trim() && content.nextTime.trim())
  ) {
    return "For an improvement area, describe the issue, resolution and what to do differently.";
  }
  if (content.suppliers.some((s) => s.rating === null)) {
    return "Rate each supplier category or choose N.A.";
  }
  if (
    content.suppliers.some(
      (s) => s.rating !== "na" && s.rating !== null && s.rating <= 2 && !s.followUp.trim()
    )
  ) {
    return "For suppliers rated 1 or 2, explain what went wrong and whether to use them again.";
  }
  if (
    !(
      content.closure.additionalCost &&
      content.closure.budgetVariation &&
      content.closure.refundPending &&
      content.closure.billing
    )
  ) {
    return "Complete the financial and operational closure choices.";
  }
  if (reportNeedsClosureDetails(content.closure) && !content.closure.pendingDetails.trim()) {
    return "Add the amount, reason and responsible person for the closure issue.";
  }
  if (
    content.assessment.rating === null ||
    !content.assessment.status ||
    !content.assessment.repeat ||
    !content.assessment.learnings.trim()
  ) {
    return "Complete the final assessment and top three learnings.";
  }
  return null;
}
export function postTourReportError(
  content: PostTourReportContent,
  submitting: boolean
): string | null {
  const error =
    reportTextError(content) ?? reportSelectionError(content) ?? reportTourError(content);
  if (error || !submitting) {
    return error;
  }
  return reportSubmissionError(content);
}
