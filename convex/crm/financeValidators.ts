import { v } from "convex/values";

export const expenseCurrencyValidator = v.union(
  v.literal("INR"),
  v.literal("USD"),
  v.literal("AED"),
  v.literal("EUR"),
  v.literal("THB"),
  v.literal("SGD")
);

export const expenseDecisionValidator = v.union(v.literal("Approved"), v.literal("Rejected"));
