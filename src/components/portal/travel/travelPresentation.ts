import { ConvexError } from "convex/values";
import { isRuntimeString } from "@/lib/runtimeValues";
export const travelCard = "min-w-0 rounded-xl border border-brand-border bg-white p-5 sm:p-6";
export const travelFormCard = "min-w-0 rounded-xl border border-brand-border bg-white p-5 sm:p-6";

export function travelError(cause: unknown, fallback: string) {
  return cause instanceof ConvexError && isRuntimeString(cause.data) ? cause.data : fallback;
}
