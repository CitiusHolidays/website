import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { RuntimeValue } from "../../lib/runtimeValues";
import { isRuntimeString } from "../../lib/runtimeValues";

const CODE_FIELD_BY_TABLE = {
  approvalRequests: "requestCode",
  jobCards: "jobCode",
  proposals: "proposalCode",
  queries: "queryCode",
} satisfies Record<string, string>;

export function creatorInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .flatMap((part) => {
      const cleaned = part.replace(/[^A-Za-z]/g, "");
      return cleaned ? [cleaned] : [];
    });

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase().padEnd(2, "X");
  }
  return "XX";
}

type CodeTableName = "approvalRequests" | "jobCards" | "proposals" | "queries";

type CodeRow = {
  jobCode?: string;
  proposalCode?: string;
  queryCode?: string;
  requestCode?: string;
};

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
  ctx: QueryCtx | MutationCtx,
  tableName: CodeTableName,
  prefix: string,
  options?: { suffix?: string }
) {
  const codeField = CODE_FIELD_BY_TABLE[tableName];
  const rows = await ctx.db.query(tableName).collect();
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = options?.suffix
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const pattern = suffix
    ? new RegExp(`^${escapedPrefix}-(\\d+)(?:-[A-Z]{1,4})?$`)
    : new RegExp(`^${escapedPrefix}-(\\d+)$`);
  let max = 0;

  for (const row of rows) {
    const code = codeField ? codeFromRow(row, codeField) : null;
    if (!code) {
      continue;
    }
    const match = code.match(pattern);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  const baseCode = `${prefix}-${String(max + 1).padStart(4, "0")}`;
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
