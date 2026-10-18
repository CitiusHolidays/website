import { ConvexError } from "convex/values";
import { isRuntimeString } from "@/lib/runtimeValues";
export const travelCard = "min-w-0 rounded-3xl border border-brand-border bg-white p-5 sm:p-6";
export const travelFormCard =
  "min-w-0 rounded-3xl border border-[#0B1026]/10 bg-[#FDFBF7] p-5 sm:p-6";

export function travelError(cause: unknown, fallback: string) {
  return cause instanceof ConvexError && isRuntimeString(cause.data) ? cause.data : fallback;
}
