import { ConvexError } from "convex/values";
import { env } from "../_generated/server";

export function assertPaymentMutationSecret(secret: string | undefined) {
  const expected = env.PAYMENT_MUTATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid payment mutation secret");
  }
}

export function assertPaymentMutationSourceAllowed(
  source: "webhook" | "checkout" | "fixture" | "manual" | undefined,
  isFixture: boolean | undefined
) {
  const nonProduction = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  if (!nonProduction && (source === "fixture" || isFixture === true)) {
    throw new ConvexError("Payment fixtures are disabled in production");
  }
}
