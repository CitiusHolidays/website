type NotificationAccess = {
  authUserId?: string | null;
  roles: string[];
};

type NotificationRow = {
  recipientUserId?: string;
  recipientRole?: string;
  readAt?: number;
};

function canSeeNotification(row: NotificationRow, access: NotificationAccess) {
  const roleSet = new Set(access.roles);
  return (
    (!row.recipientUserId || row.recipientUserId === access.authUserId) &&
    (!row.recipientRole || roleSet.has(row.recipientRole))
  );
}

export function notificationSummaryForAccess(rows: NotificationRow[], access: NotificationAccess) {
  return {
    unreadCount: rows.filter((row) => canSeeNotification(row, access) && !row.readAt).length,
  };
}
