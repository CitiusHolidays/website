import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { authorizedCustomerIdentityIds } from "../lib/customerIdentityAccess";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { canReceiveNotification } from "./lib/notifications";
import { getRolePermissions } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";
import { createNavigationWorkReader } from "./navigationWork";

async function identityIdsForStaff(ctx: MutationCtx, staff: Doc<"staffUsers">) {
  if (!staff.authUserId) {
    return [""];
  }
  const ids = new Set([staff.authUserId]);
  const batches = await Promise.all([
    ctx.db
      .query("authIdentityLinks")
      .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", staff.authUserId ?? ""))
      .take(3),
    ctx.db
      .query("authIdentityLinks")
      .withIndex("by_canonicalAuthUserId", (q) =>
        q.eq("canonicalAuthUserId", staff.authUserId ?? "")
      )
      .take(3),
  ]);
  const verified = await Promise.all(
    batches
      .flat()
      .filter((link) => link.status === "linked")
      .map((link) =>
        authorizedCustomerIdentityIds(ctx, {
          subject: link.legacyAuthUserId,
          tokenIdentifier: link.canonicalAuthUserId,
        })
      )
  );
  for (const candidates of verified) {
    if (candidates.includes(staff.authUserId)) {
      for (const id of candidates) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}
function accessForStaff(staff: Doc<"staffUsers">): PortalAccess {
  return {
    allowed: true,
    authUserId: staff.authUserId,
    email: staff.email,
    name: staff.name,
    permissions: getRolePermissions(staff.roles),
    roles: staff.roles,
    staffId: staff._id,
  };
}

// One latest arrival per person/destination persists independently of the bell's
// limited recent feed. Publication and this projection commit atomically.
type NavigationNotice = Pick<
  Doc<"notifications">,
  | "_id"
  | "createdAt"
  | "entityId"
  | "entityType"
  | "recipientStaffId"
  | "recipientUserId"
  | "recipientRole"
>;
export async function projectNavigationActivity(
  ctx: MutationCtx,
  notices: NavigationNotice[],
  activeStaff: Doc<"staffUsers">[]
) {
  const supported = notices.filter(
    (notice) =>
      ["query", "proposal", "jobCard", "ticket"].includes(notice.entityType ?? "") &&
      notice.entityId
  );
  if (!supported.length) {
    return;
  }
  const recipients = activeStaff.filter(
    (staff) =>
      staff.active &&
      supported.some((notice) => canReceiveNotification(notice, accessForStaff(staff)))
  );
  await Promise.all(
    recipients.map(async (staff) => {
      const access = accessForStaff(staff);
      const reader = await createNavigationWorkReader(
        ctx,
        access,
        await identityIdsForStaff(ctx, staff)
      );
      const destinations = await Promise.all(
        supported
          .filter((notice) => canReceiveNotification(notice, access))
          .map(async (notice) =>
            (await reader.destinations(notice)).map((href) => ({ href, notice }))
          )
      );
      const latest = new Map(destinations.flat().map(({ href, notice }) => [href, notice]));
      await Promise.all(
        [...latest].map(async ([href, notice]) => {
          const current = await ctx.db
            .query("portalNavigationActivity")
            .withIndex("by_staffId_and_href", (q) => q.eq("staffId", staff._id).eq("href", href))
            .unique();
          if (current?.notificationId === notice._id) {
            return;
          }
          const patch = {
            notificationId: notice._id,
            seenAt: undefined,
            updatedAt: notice.createdAt,
          };
          if (current) {
            await patchWithE2eOwnership(ctx, "portalNavigationActivity", current._id, patch);
          } else {
            await insertWithE2eOwnership(ctx, "portalNavigationActivity", {
              ...patch,
              href,
              staffId: staff._id,
            });
          }
        })
      );
    })
  );
}
