import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { RuntimeValue } from "../../lib/runtimeValues";
import { isRuntimeString } from "../../lib/runtimeValues";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./e2eOwnership";

const CODE_CONFIG_BY_TABLE = {
  approvalRequests: {
    field: "requestCode",
    key: "approvalRequests:APR",
    prefix: "APR",
  },
  jobCards: { field: "jobCode", key: "jobCards:JC", prefix: "JC" },
  proposals: { field: "proposalCode", key: "proposals:P", prefix: "P" },
  queries: { field: "queryCode", key: "queries:Q", prefix: "Q" },
} as const;
export const LEGACY_CODE_SEED_SCAN_LIMIT = 500;
const NON_LETTER_PATTERN = /[^A-Za-z]/g;
const WHITESPACE_PATTERN = /\s+/;

export function creatorInitials(name: string) {
  const parts = name
    .trim()
    .split(WHITESPACE_PATTERN)
    .flatMap((part) => {
      const cleaned = part.replace(NON_LETTER_PATTERN, "");
      return cleaned ? [cleaned] : [];
    });

  if (parts.length >= 2) {
    const [first] = parts;
    const [last] = parts.slice(-1);
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase().padEnd(2, "X");
  }
  return "XX";
}

type CodeTableName = keyof typeof CODE_CONFIG_BY_TABLE;

interface CodeRow {
  jobCode?: string;
  proposalCode?: string;
  queryCode?: string;
  requestCode?: string;
}

function codeFromRow(row: CodeRow, codeField: string): string | null {
  if (codeField === "requestCode" && "requestCode" in row && isRuntimeString(row.requestCode)) {
    return row.requestCode;
  }
  if (codeField === "jobCode" && "jobCode" in row && isRuntimeString(row.jobCode)) {
    return row.jobCode;
  }
  if (codeField === "proposalCode" && "proposalCode" in row && isRuntimeString(row.proposalCode)) {
    return row.proposalCode;
  }
  if (codeField === "queryCode" && "queryCode" in row && isRuntimeString(row.queryCode)) {
    return row.queryCode;
  }
  return null;
}

export async function nextCode(
  ctx: MutationCtx,
  tableName: CodeTableName,
  prefix: string,
  options?: { suffix?: string }
) {
  const config = CODE_CONFIG_BY_TABLE[tableName];
  if (prefix !== config.prefix) {
    throw new Error(`Unexpected ${tableName} code prefix`);
  }
  const sequenceKey = config.key;
  const sequence = await ctx.db
    .query("crmCodeSequences")
    .withIndex("by_key", (q) => q.eq("key", sequenceKey))
    .unique();
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = options?.suffix
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const pattern = suffix
    ? new RegExp(`^${escapedPrefix}-(\\d+)(?:-[A-Z]{1,4})?$`)
    : new RegExp(`^${escapedPrefix}-(\\d+)$`);
  let allocated: number;
  if (sequence) {
    allocated = sequence.lastAllocated + 1;
    if (!Number.isSafeInteger(allocated) || allocated < 1) {
      throw new Error(`Invalid ${sequenceKey} sequence state`);
    }
    await patchWithE2eOwnership(ctx, "crmCodeSequences", sequence._id, {
      lastAllocated: allocated,
      updatedAt: Date.now(),
    });
  } else {
    const rows = await ctx.db.query(tableName).take(LEGACY_CODE_SEED_SCAN_LIMIT + 1);
    if (rows.length > LEGACY_CODE_SEED_SCAN_LIMIT) {
      throw new ConvexError(`CRM code sequence ${sequenceKey} requires bounded reconciliation`);
    }
    let max = 0;
    for (const row of rows) {
      const code = codeFromRow(row, config.field);
      if (!code) {
        continue;
      }
      const match = code.match(pattern);
      if (match) {
        max = Math.max(max, Number.parseInt(match[1], 10));
      }
    }
    allocated = max + 1;
    if (!Number.isSafeInteger(allocated)) {
      throw new Error(`Invalid ${sequenceKey} legacy maximum`);
    }
    const now = Date.now();
    await insertWithE2eOwnership(ctx, "crmCodeSequences", {
      key: sequenceKey,
      lastAllocated: allocated,
      legacyRowsScanned: rows.length,
      seededAt: now,
      updatedAt: now,
    });
  }

  const baseCode = `${prefix}-${String(allocated).padStart(4, "0")}`;
  return suffix ? `${baseCode}-${suffix}` : baseCode;
}

export async function deleteStorageFile(ctx: MutationCtx, storageId: RuntimeValue, label: string) {
  if (!storageId) {
    return;
  }
  try {
    // SAFETY: storageId was loaded from a schema-owned attachment storageId field.
    await ctx.storage.delete(storageId as Id<"_storage">);
  } catch (cause) {
    console.error(`Failed to delete ${label} from storage:`, cause);
  }
}
