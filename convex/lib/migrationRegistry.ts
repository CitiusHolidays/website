import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

type Registry = Doc<"dataMigrationRegistry">;

/** Where a migration's registry row stands after a page: the fields every status write sets. */
interface RegistryProgress {
  cursor: Registry["cursor"];
  legacyRemaining: number;
  stage: string;
  status: Registry["status"];
}

/**
 * The status fields of every `dataMigrationRegistry` write, and the only place `verifiedAt` is
 * set. A row is verified exactly when it has a verification time: "verified" stamps `now`, any
 * other status clears it, so a restarted or failed row never keeps an old one. A verified row
 * has finished (stage "complete"), has no cursor left and no residuals; anything else throws
 * instead of storing a contradiction the status readers would have to reconcile.
 * migrationRegistry.test.ts scans the Convex source and keeps every registry writer on this path.
 */
export function migrationRegistryState<Progress extends RegistryProgress>(
  progress: Progress,
  now: number
) {
  if (
    progress.status === "verified" &&
    (progress.stage !== "complete" || progress.cursor !== null || progress.legacyRemaining !== 0)
  ) {
    throw new ConvexError(
      `A migration can be verified only when complete with no cursor and no residuals (stage ${progress.stage}, ${progress.legacyRemaining} remaining)`
    );
  }
  return {
    ...progress,
    updatedAt: now,
    verifiedAt: progress.status === "verified" ? now : undefined,
  };
}

/**
 * A registry row for a migration starting, or restarting after "failed", at the first page of
 * `stage`: running, every counter at zero, no verification time.
 */
export function startedMigrationRegistry(stage: string, now: number) {
  return {
    converted: 0,
    processed: 0,
    startedAt: now,
    ...migrationRegistryState(
      { cursor: null, legacyRemaining: 0, stage, status: "running" as const },
      now
    ),
  };
}
