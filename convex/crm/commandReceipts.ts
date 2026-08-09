import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

const COMMAND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CommandActor {
  authUserId?: string;
  email?: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

export async function digestCommandPayload(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(payload)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function actorKey(access: CommandActor) {
  const key = access.authUserId ?? access.email;
  if (!key) {
    throw new ConvexError("Authenticated command actor is required");
  }
  return key;
}

export async function resolveCommandReceipt(
  ctx: MutationCtx,
  args: {
    access: CommandActor;
    commandId: string;
    operation: string;
    payload: unknown;
    targetId: string;
  }
) {
  if (!COMMAND_ID_PATTERN.test(args.commandId)) {
    throw new ConvexError("Command ID must be a UUID");
  }
  const payloadDigest = await digestCommandPayload(args.payload);
  const resolvedActorKey = actorKey(args.access);
  const receipt = await ctx.db
    .query("commandReceipts")
    .withIndex("by_actor_operation_command", (q) =>
      q
        .eq("actorKey", resolvedActorKey)
        .eq("operation", args.operation)
        .eq("commandId", args.commandId)
    )
    .unique();
  if (receipt && (receipt.targetId !== args.targetId || receipt.payloadDigest !== payloadDigest)) {
    throw new ConvexError("Command ID was already used with different input");
  }
  return {
    actorKey: resolvedActorKey,
    payloadDigest,
    replayedResultId: receipt?.resultId,
  };
}

export async function storeCommandReceipt(
  ctx: MutationCtx,
  args: {
    actorKey: string;
    commandId: string;
    operation: string;
    payloadDigest: string;
    resultId: string;
    targetId: string;
  }
) {
  await ctx.db.insert("commandReceipts", {
    actorKey: args.actorKey,
    commandId: args.commandId,
    createdAt: Date.now(),
    operation: args.operation,
    payloadDigest: args.payloadDigest,
    resultId: args.resultId,
    targetId: args.targetId,
  });
}
