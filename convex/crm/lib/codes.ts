import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { hasOwnKey, type RuntimeObject, type RuntimeValue } from "../../lib/runtimeValues";

export const CRM_CODE_CONFIG_BY_TABLE = {
  approvalRequests: {
    field: "requestCode",
    key: "approvalRequests:APR",
    prefix: "APR",
  },
  jobCards: { field: "jobCode", key: "jobCards:JC", prefix: "JC" },
  proposals: { field: "proposalCode", key: "proposals:P", prefix: "P" },
  queries: { field: "queryCode", key: "queries:Q", prefix: "Q" },
} as const;
export const CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION = "crm-code-sequence-seed-v1";
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

export type CodeTableName = keyof typeof CRM_CODE_CONFIG_BY_TABLE;

export function isCrmCodeSourceTable(tableName: string): tableName is CodeTableName {
  return (
    tableName === "approvalRequests" ||
    tableName === "jobCards" ||
    tableName === "proposals" ||
    tableName === "queries"
  );
}

export function crmCodeSourcePatchTouchesCode(
  tableName: string,
  value: RuntimeObject
): tableName is CodeTableName {
  return (
    isCrmCodeSourceTable(tableName) && hasOwnKey(value, CRM_CODE_CONFIG_BY_TABLE[tableName].field)
  );
}

export function crmCodeSequenceMigrationKey(tableName: CodeTableName) {
  return `${CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION}:${CRM_CODE_CONFIG_BY_TABLE[tableName].key}`;
}

export function isTrustedCrmCodeAllocator(
  sequence: Doc<"crmCodeSequences"> | null,
  trust: Doc<"crmCodeSequenceTrust"> | null
) {
  return (
    sequence !== null &&
    trust !== null &&
    Number.isSafeInteger(sequence.lastAllocated) &&
    sequence.lastAllocated >= 0 &&
    Number.isSafeInteger(trust.lastAllocated) &&
    trust.lastAllocated >= 0 &&
    sequence.lastAllocated === trust.lastAllocated &&
    trust.version === CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION &&
    !trust.reconciliationRequired
  );
}

export async function assertCrmCodeSourceMutationAllowed(
  ctx: MutationCtx,
  tableName: CodeTableName
) {
  const sequenceKey = CRM_CODE_CONFIG_BY_TABLE[tableName].key;
  const [sequence, trust] = await Promise.all([
    ctx.db
      .query("crmCodeSequences")
      .withIndex("by_key", (q) => q.eq("key", sequenceKey))
      .unique(),
    ctx.db
      .query("crmCodeSequenceTrust")
      .withIndex("by_key", (q) => q.eq("key", sequenceKey))
      .unique(),
  ]);
  if (!isTrustedCrmCodeAllocator(sequence, trust)) {
    throw new ConvexError(`CRM code source ${tableName} is locked for bounded reconciliation`);
  }
}

export async function nextCode(
  ctx: MutationCtx,
  tableName: CodeTableName,
  prefix: string,
  options?: { suffix?: string }
) {
  const config = CRM_CODE_CONFIG_BY_TABLE[tableName];
  if (prefix !== config.prefix) {
    throw new Error(`Unexpected ${tableName} code prefix`);
  }
  const sequenceKey = config.key;
  const [sequence, trust] = await Promise.all([
    ctx.db
      .query("crmCodeSequences")
      .withIndex("by_key", (q) => q.eq("key", sequenceKey))
      .unique(),
    ctx.db
      .query("crmCodeSequenceTrust")
      .withIndex("by_key", (q) => q.eq("key", sequenceKey))
      .unique(),
  ]);
  if ((sequence || trust) && !isTrustedCrmCodeAllocator(sequence, trust)) {
    throw new ConvexError(`CRM code sequence ${sequenceKey} requires bounded reconciliation`);
  }
  const suffix = options?.suffix
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  let allocated: number;
  if (sequence && trust) {
    allocated = sequence.lastAllocated + 1;
    if (!Number.isSafeInteger(allocated) || allocated < 1) {
      throw new Error(`Invalid ${sequenceKey} sequence state`);
    }
    // Global allocator state is infrastructure, not E2E-owned domain data.
    // E2E cleanup may remove the allocated domain row, but gaps remain durable.
    const now = Date.now();
    await Promise.all([
      ctx.db.patch("crmCodeSequences", sequence._id, {
        lastAllocated: allocated,
        updatedAt: now,
      }),
      ctx.db.patch("crmCodeSequenceTrust", trust._id, {
        lastAllocated: allocated,
        updatedAt: now,
      }),
    ]);
  } else {
    const legacyRows = await ctx.db.query(tableName).take(1);
    if (legacyRows.length > 0) {
      throw new ConvexError(`CRM code sequence ${sequenceKey} requires bounded reconciliation`);
    }
    allocated = 1;
    const now = Date.now();
    await ctx.db.insert("crmCodeSequences", {
      key: sequenceKey,
      lastAllocated: allocated,
      legacyRowsScanned: 0,
      seededAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("crmCodeSequenceTrust", {
      activatedAt: now,
      key: sequenceKey,
      lastAllocated: allocated,
      reconciliationRequired: false,
      updatedAt: now,
      version: CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION,
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
