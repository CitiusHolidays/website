import { describe, expect, test } from "bun:test";
import { notificationSummaryForAccess } from "./notificationSummary";

describe("notificationSummaryForAccess", () => {
  test("counts unread notifications outside the dropdown limit", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      _id: `notification_${index}`,
      title: `Notification ${index}`,
      body: "",
      recipientRole: "Sales",
      readAt: index < 10 ? undefined : Date.now(),
      createdAt: Date.now() - index,
    }));

    expect(
      notificationSummaryForAccess(rows, {
        authUserId: "user_sales",
        roles: ["Sales"],
      }),
    ).toEqual({ unreadCount: 10 });
  });
});
