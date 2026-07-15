import { v } from "convex/values";

export const expenseIdResultValidator = v.object({ id: v.id("expenseEntries") });
export const expenseAttachmentRecordResultValidator = v.union(
  v.null(),
  v.object({
    expenseId: v.id("expenseEntries"),
    fileName: v.string(),
    id: v.id("attachments"),
    mimeType: v.string(),
    storageId: v.string(),
  })
);

const shortcutValidator = v.object({
  dateLabel: v.string(),
  href: v.string(),
  id: v.string(),
  label: v.string(),
});
export const navShortcutListResultValidator = v.object({
  jobCards: v.array(shortcutValidator),
  proposals: v.array(shortcutValidator),
  queries: v.array(shortcutValidator),
  tickets: v.array(shortcutValidator),
});

export const reportsOverviewResultValidator = v.object({
  aggregateCoverage: v.object({
    bucketCount: v.number(),
    complete: v.boolean(),
    detailRowLimit: v.number(),
    freshnessMinutes: v.number(),
    updatedAt: v.union(v.string(), v.null()),
  }),
  locationHeadcount: v.array(v.object({ count: v.number(), id: v.string(), location: v.string() })),
  revenueByType: v.array(
    v.object({ count: v.number(), queryType: v.string(), revenue: v.number() })
  ),
  summary: v.object({
    confirmedQueries: v.number(),
    confirmedRevenue: v.number(),
    lostQueries: v.number(),
    totalPipelineBudget: v.number(),
  }),
});

const searchReadinessDetailValidator = v.object({
  generation: v.number(),
  state: v.string(),
  updatedAt: v.union(v.number(), v.null()),
  version: v.union(v.number(), v.null()),
});
export const listSearchReadinessResultValidator = v.object({
  details: v.object({
    jobCards: searchReadinessDetailValidator,
    proposals: searchReadinessDetailValidator,
    queries: searchReadinessDetailValidator,
    travellers: searchReadinessDetailValidator,
  }),
  errorSummary: v.null(),
  ready: v.boolean(),
  tables: v.object({
    jobCards: v.boolean(),
    proposals: v.boolean(),
    queries: v.boolean(),
    travellers: v.boolean(),
  }),
  version: v.number(),
});
