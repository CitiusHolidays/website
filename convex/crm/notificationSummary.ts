import { canReceiveNotification } from "./lib";

type NotificationAccess = {
  authUserId?: string | null;
  roles: string[];
};

type NotificationRow = {
  recipientUserId?: string;
  recipientRole?: string;
  readAt?: number;
};

export function notificationSummaryForAccess(rows: NotificationRow[], access: NotificationAccess) {
  return {
    unreadCount: rows.filter((row) => canReceiveNotification(row, access) && !row.readAt).length,
  };
}
