import { v } from "convex/values";

export const METRIC_SOURCE_TYPES = [
  "approvalRequests",
  "expenseEntries",
  "invoices",
  "jobCards",
  "pnrs",
  "proposals",
  "queries",
  "tickets",
  "travellers",
  "visaRecords",
] as const;

export type MetricSourceType = (typeof METRIC_SOURCE_TYPES)[number];
export type MetricValues = Record<string, number>;
export type AggregatePeriodType = "day" | "month";

export const metricSourceTypeValidator = v.union(
  v.literal("approvalRequests"),
  v.literal("expenseEntries"),
  v.literal("invoices"),
  v.literal("jobCards"),
  v.literal("pnrs"),
  v.literal("proposals"),
  v.literal("queries"),
  v.literal("tickets"),
  v.literal("travellers"),
  v.literal("visaRecords")
);
