import type { GenericTableInfo, IndexRange, OrderedQuery, PaginationOptions } from "convex/server";
import { ConvexError, type Value } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const CRM_LIST_MAX_PAGE_SIZE = 100;
export const CRM_LIST_MAX_ROWS_READ = 400;
export const CRM_RELATION_BATCH_SIZE = 8;

export interface CrmCursorFilters {
  createdAtFrom?: number;
  createdAtTo?: number;
  equals?: Record<string, boolean | number | string | undefined>;
}

type CreatedAtUpperBoundBuilder = IndexRange & {
  lte: (fieldName: "createdAt", value: number) => IndexRange;
};

export type CreatedAtIndexRangeBuilder = CreatedAtUpperBoundBuilder & {
  gte: (fieldName: "createdAt", value: number) => CreatedAtUpperBoundBuilder;
};

/**
 * Pushes the date window into a `createdAt` index range. Callers may first bind
 * equality fields from a compound index, then pass the next-field builder here.
 */
export function applyCrmCreatedAtIndexRange(
  range: CreatedAtIndexRangeBuilder,
  filters: Pick<CrmCursorFilters, "createdAtFrom" | "createdAtTo">
): IndexRange {
  if (filters.createdAtFrom !== undefined) {
    const lowerBound = range.gte("createdAt", filters.createdAtFrom);
    return filters.createdAtTo === undefined
      ? lowerBound
      : lowerBound.lte("createdAt", filters.createdAtTo);
  }
  return filters.createdAtTo === undefined ? range : range.lte("createdAt", filters.createdAtTo);
}

/**
 * Applies filters to the indexed source query before Convex advances the
 * pagination cursor. This keeps an active filter from being evaluated only
 * against the first client-loaded page.
 */
export function applyCrmCursorFilters<
  TableInfo extends GenericTableInfo,
  QueryBuilder extends OrderedQuery<TableInfo>,
>(source: QueryBuilder, filters: CrmCursorFilters): QueryBuilder {
  // Undefined means "no filter". False, zero, and the empty string are valid exact values.
  const equalities = Object.entries(filters.equals ?? {}).filter((entry) => entry[1] !== undefined);
  if (
    !(filters.createdAtFrom !== undefined || filters.createdAtTo !== undefined || equalities.length)
  ) {
    return source;
  }
  return source.filter((q) => {
    const predicates = equalities.map(([field, value]) =>
      q.eq<Value | undefined>(q.field(field), value)
    );
    if (filters.createdAtFrom !== undefined) {
      predicates.push(q.gte(q.field("createdAt"), filters.createdAtFrom));
    }
    if (filters.createdAtTo !== undefined) {
      predicates.push(q.lte(q.field("createdAt"), filters.createdAtTo));
    }
    return predicates.length === 1 ? predicates[0] : q.and(...predicates);
  });
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
  const processBatch = async (start: number): Promise<void> => {
    if (start >= items.length) {
      return;
    }
    const batch = items.slice(start, start + safeBatchSize);
    output.push(...(await Promise.all(batch.map((item, offset) => mapper(item, start + offset)))));
    await processBatch(start + safeBatchSize);
  };
  await processBatch(0);
  return output;
}

export function compactPageItems<Item>(items: readonly (Item | null)[]): Item[] {
  return items.filter((item): item is Item => item !== null);
}

export async function loadRowsByIdInBatches<TableName extends TableNames>(
  ctx: QueryCtx,
  tableName: TableName,
  rawValues: readonly (Id<TableName> | null | undefined)[],
  maxRows: number
): Promise<Doc<TableName>[]> {
  const values = Array.from(
    new Set(
      rawValues.filter((value): value is Id<TableName> => value !== null && value !== undefined)
    )
  );
  if (values.length === 0) {
    return [];
  }
  const safeLimit = Math.max(1, Math.floor(maxRows));
  if (values.length > safeLimit) {
    throw new ConvexError("List relationship hydration exceeds the page boundary");
  }
  const rows = await mapInBoundedBatches(
    values,
    async (value) => await ctx.db.get(tableName, value),
    CRM_RELATION_BATCH_SIZE
  );
  return compactPageItems(rows);
}
