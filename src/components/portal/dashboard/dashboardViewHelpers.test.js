import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { buildWorkQueueRows } from "./dashboardViewHelpers";

function parsed(href) {
  return new URL(href, "https://portal.test");
}

describe("Dashboard work queue reconciliation", () => {
  test("Keeps all six authorized queues and encodes their exact filters", () => {
    const permissions = new Set([
      P.MANAGE_JOB_CARDS,
      P.VIEW_APPROVALS,
      P.VIEW_CONTRACTING,
      P.VIEW_FINANCE,
      P.VIEW_OPERATIONS,
      P.VIEW_TICKETING,
      P.VIEW_VISA,
    ]);
    const rows = buildWorkQueueRows({
      dateRange: { from: "2026-01-01", to: "2026-01-31" },
      has: (permission) => permissions.has(permission),
      summary: {
        departmentWorkflow: [{ label: "Contracting in progress", value: 2 }],
        metrics: { pendingApprovals: 4, ticketsPending: 0, visaPending: 5 },
        progress: { rooming: { done: 2, total: 5 } },
        ticketAttentionQueue: [],
      },
      urgentActionCategories: [
        { complete: true, count: 3, type: "accounts" },
        { complete: false, count: 6, type: "ticketing" },
      ],
      urgentActions: [],
    });

    expect(rows.map((row) => row.label)).toEqual([
      "Job Cards Pending",
      "Proposal with Contracting",
      "Visa Follow-ups",
      "Rooming Follow-ups",
      "Finance Approvals",
      "Ticketing Follow-ups",
    ]);
    const byLabel = new Map(rows.map((row) => [row.label, parsed(row.href)]));
    expect(byLabel.get("Job Cards Pending").searchParams.get("f_jobCardState")).toBe("Not opened");
    expect(byLabel.get("Proposal with Contracting").searchParams.get("f_contractingStatus")).toBe(
      "Query Received|Proposal in progress"
    );
    expect(byLabel.get("Visa Follow-ups").searchParams.get("f_status")).toBe(
      "Not Started|Checklist Shared|Documents Pending|Awaiting"
    );
    expect(byLabel.get("Rooming Follow-ups").searchParams.get("f_roomingStatus")).toBe("Pending");
    expect(byLabel.get("Finance Approvals").searchParams.get("f_status")).toBe("Pending");
    expect(byLabel.get("Ticketing Follow-ups").searchParams.get("f_ticketStatus")).toBe(
      "Name Change Required|Reissue Required|Refund Pending"
    );
    expect(rows.find((row) => row.label === "Ticketing Follow-ups")?.valueComplete).toBe(false);
  });
});
