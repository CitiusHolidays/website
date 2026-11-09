import { canReceiveNotification } from "./lib/notificationRecipients";

interface NotificationAccess {
  authUserId?: string | null;
  roles: string[];
}

interface NotificationRow {
  readAt?: number;
  recipientRole?: string;
  recipientUserId?: string;
}

export function notificationSummaryForAccess(rows: NotificationRow[], access: NotificationAccess) {
  return {
    unreadCount: rows.filter((row) => canReceiveNotification(row, access) && !row.readAt).length,
  };
}
