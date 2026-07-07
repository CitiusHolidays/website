import { describe, expect, test } from "bun:test";
import { notificationSummaryForAccess } from "./notificationSummary";

describe("notificationSummaryForAccess", () => {
  test("counts unread notifications outside the dropdown limit", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      _id: `notification_${index}`,
      body: "",
      createdAt: Date.now() - index,
      readAt: index < 10 ? undefined : Date.now(),
      recipientRole: "Sales",
      title: `Notification ${index}`,
    }));

    expect(
      notificationSummaryForAccess(rows, {
        authUserId: "user_sales",
        roles: ["Sales"],
      })
    ).toEqual({ unreadCount: 10 });
  });
});
