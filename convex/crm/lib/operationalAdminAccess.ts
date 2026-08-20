import { ConvexError } from "convex/values";
import { isAdmin, requireStaff } from "./staffAccess";

export async function requireOperationalAdmin(ctx: Parameters<typeof requireStaff>[0]) {
  const access = await requireStaff(ctx);
  if (!(access.staffId && isAdmin(access))) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}
