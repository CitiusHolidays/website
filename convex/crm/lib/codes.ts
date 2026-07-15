import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

const CODE_FIELD_BY_TABLE: Record<string, string> = {
  approvalRequests: "requestCode",
  jobCards: "jobCode",
  proposals: "proposalCode",
  queries: "queryCode",
};

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
    const code =
      codeField && typeof (row as Record<string, unknown>)[codeField] === "string"
        ? ((row as Record<string, unknown>)[codeField] as string)
        : null;
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

export async function deleteStorageFile(ctx: MutationCtx, storageId: unknown, label: string) {
  if (!storageId) {
    return;
  }
  try {
    await ctx.storage.delete(storageId as Id<"_storage">);
  } catch (err) {
    console.error(`Failed to delete ${label} from storage:`, err);
  }
}
