import { ConvexError } from "convex/values";
import { isRuntimeString } from "./runtimeValues";

export function assertPaymentMutationSecret(secret: string | undefined) {
  const expected = process.env.PAYMENT_MUTATION_SECRET;
  if (!isRuntimeString(expected) || expected.trim().length === 0 || secret !== expected) {
    throw new ConvexError("Invalid payment mutation secret");
  }
}
