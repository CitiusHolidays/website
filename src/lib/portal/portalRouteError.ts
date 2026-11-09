import { ConvexError } from "convex/values";
import { isRuntimeString } from "@/lib/runtimeValues";

export type PortalRouteErrorKind = "forbidden" | "missing" | "unavailable";

// Record lookups throw messages such as "Invalid Job Card id" or "Job Card not found".
const MISSING_RECORD_PATTERN = /\bnot found\b|^invalid\b.*\bid$/i;

/**
 * Sorts an error that reached a Staff Workspace error boundary. Convex errors thrown by a
 * client-side query keep their data; anything else, including a server-rendered error whose
 * message production hides, counts as a page that could not load.
 */
export function classifyPortalRouteError(cause: unknown): PortalRouteErrorKind {
  if (!(cause instanceof ConvexError && isRuntimeString(cause.data))) {
    return "unavailable";
  }
  if (cause.data === "FORBIDDEN") {
    return "forbidden";
  }
  return MISSING_RECORD_PATTERN.test(cause.data.trim()) ? "missing" : "unavailable";
}
