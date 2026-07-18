import { ConvexError } from "convex/values";

export function assertE2eSecret(secret: string, expected = process.env.E2E_SEED_SECRET) {
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid E2E seed secret");
  }
}
