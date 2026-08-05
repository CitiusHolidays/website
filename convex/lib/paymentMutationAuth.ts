import { ConvexError } from "convex/values";

export function assertPaymentMutationSecret(secret: string | undefined) {
  const expected = process.env.PAYMENT_MUTATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid payment mutation secret");
  }
}
