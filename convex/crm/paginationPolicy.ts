import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";

export const CRM_LIST_MAX_PAGE_SIZE = 100;
export const CRM_LIST_MAX_ROWS_READ = 400;
export const CRM_RELATION_BATCH_SIZE = 8;

export interface CrmCursorFilters {
  createdAtFrom?: number;
  createdAtTo?: number;
  equals?: Record<string, boolean | number | string | undefined>;
}

/**
 * Applies filters to the indexed source query before Convex advances the
 * pagination cursor. This keeps an active filter from being evaluated only
 * against the first client-loaded page.
 */
export function applyCrmCursorFilters<QueryBuilder extends { filter: (predicate: any) => any }>(
  source: QueryBuilder,
  filters: CrmCursorFilters
): QueryBuilder {
  const equalities = Object.entries(filters.equals ?? {}).filter((entry) => Boolean(entry[1]));
  if (
    !(filters.createdAtFrom !== undefined || filters.createdAtTo !== undefined || equalities.length)
  ) {
    return source;
  }
  return source.filter((q: any) => {
    const predicates = equalities.map(([field, value]) => q.eq(q.field(field), value));
    if (filters.createdAtFrom !== undefined) {
      predicates.push(q.gte(q.field("createdAt"), filters.createdAtFrom));
    }
    if (filters.createdAtTo !== undefined) {
      predicates.push(q.lte(q.field("createdAt"), filters.createdAtTo));
    }
    return predicates.length === 1 ? predicates[0] : q.and(...predicates);
  }) as QueryBuilder;
}

export function boundedPaginationOptions(options: PaginationOptions): PaginationOptions {
  return {
    ...options,
    maximumRowsRead: Math.min(
      options.maximumRowsRead ?? CRM_LIST_MAX_ROWS_READ,
      CRM_LIST_MAX_ROWS_READ
    ),
    numItems: Math.max(1, Math.min(options.numItems, CRM_LIST_MAX_PAGE_SIZE)),
  };
}

export async function mapInBoundedBatches<Input, Output>(
  items: readonly Input[],
  mapper: (item: Input, index: number) => Promise<Output>,
  batchSize = CRM_RELATION_BATCH_SIZE
): Promise<Output[]> {
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const output: Output[] = [];
  for (let start = 0; start < items.length; start += safeBatchSize) {
    const batch = items.slice(start, start + safeBatchSize);
    output.push(...(await Promise.all(batch.map((item, offset) => mapper(item, start + offset)))));
  }
  return output;
}

export function compactPageItems<Item>(items: readonly (Item | null)[]): Item[] {
  return items.filter((item): item is Item => item !== null);
}

export async function loadRowsByIdInBatches<Row = Record<string, unknown>>(
  ctx: any,
  rawValues: readonly unknown[],
  maxRows: number
): Promise<Row[]> {
  const values = Array.from(new Set(rawValues.filter(Boolean)));
  if (values.length === 0) {
    return [];
  }
  const safeLimit = Math.max(1, Math.floor(maxRows));
  if (values.length > safeLimit) {
    throw new ConvexError("List relationship hydration exceeds the page boundary");
  }
  const rows = await mapInBoundedBatches(
    values,
    async (value) => await ctx.db.get(value),
    CRM_RELATION_BATCH_SIZE
  );
  return compactPageItems(rows) as Row[];
}
