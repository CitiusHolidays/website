import { describe, expect, test } from "bun:test";
import { canReceiveNotification } from "./lib";
import { getNotificationHref } from "./notificationPaths";

describe("notification paths", () => {
  test("matches contracting query titles to team assignment on queries list", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query_1",
        title: "Query submitted to Contracting",
      }),
    ).toBe("/portal/queries?open=assignQueryTeams&id=query_1");
  });

  test("maps sales review notifications to sales decision modal", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query_1",
        title: "Proposal ready for review",
      }),
    ).toBe("/portal/queries?open=salesDecision&id=query_1");
  });

  test("maps accounts job card alerts to accounts workspace", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query_1",
        title: "Order confirmed — open Job Card",
      }),
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query_1");
  });

  test("maps owner assignment titles to job card modals", () => {
    expect(
      getNotificationHref({
        entityType: "jobCard",
        entityId: "job_1",
        title: "Assign operations owner",
      }),
    ).toBe("/portal/job-cards?open=assignOperationsOwner&id=job_1");
  });

  test("falls back to activity when entity is missing", () => {
    expect(getNotificationHref({ entityType: "", entityId: "", title: "Ping" })).toBe(
      "/portal/activity",
    );
  });
});

describe("canReceiveNotification", () => {
  const access = { authUserId: "user_a", roles: ["Sales", "Operations"] };

  test("allows notifications targeted at the signed-in user", () => {
    expect(
      canReceiveNotification({ recipientUserId: "user_a" }, access),
    ).toBe(true);
  });

  test("rejects notifications for a different user", () => {
    expect(
      canReceiveNotification({ recipientUserId: "user_b" }, access),
    ).toBe(false);
  });

  test("allows role-targeted notifications when the user has the role", () => {
    expect(canReceiveNotification({ recipientRole: "Operations" }, access)).toBe(true);
  });

  test("rejects role-targeted notifications without the role", () => {
    expect(canReceiveNotification({ recipientRole: "Finance" }, access)).toBe(false);
  });
});
