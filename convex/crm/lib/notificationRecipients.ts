import type { Id } from "../../_generated/dataModel";

/**
 * Whether a staff member may see a notification. Leaf module: the notification writers, readers,
 * projections and the email ledger all import it, so it must not import any of them.
 */
export function canReceiveNotification(
  notification: {
    recipientStaffId?: Id<"staffUsers">;
    recipientUserId?: string;
    recipientRole?: string;
  },
  access: { staffId?: Id<"staffUsers"> | null; authUserId?: string | null; roles: string[] }
) {
  const roleSet = new Set(access.roles);
  if (
    notification.recipientStaffId &&
    String(notification.recipientStaffId) !== String(access.staffId ?? "")
  ) {
    return false;
  }
  if (notification.recipientUserId && notification.recipientUserId !== access.authUserId) {
    return String(notification.recipientStaffId ?? "") === String(access.staffId ?? "");
  }
  if (notification.recipientRole && !roleSet.has(notification.recipientRole)) {
    return false;
  }
  return true;
}
