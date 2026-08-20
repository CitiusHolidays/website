import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalConfirmProvider } from "@/components/portal/PortalConfirmDialog";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { ActivityView } from "./admin/ActivityView";
import { ApprovalsView } from "./admin/ApprovalsView";
import { ExpensesView } from "./admin/ExpensesView";
import { FinanceView } from "./admin/FinanceView";
import { LeaveView } from "./admin/LeaveView";
import { SettingsView } from "./admin/SettingsView";
import { TicketDashboardView } from "./ticketing/TicketDashboardView";
import { TicketsView } from "./ticketing/TicketsView";

const noop = () => undefined;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/ticketing",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalToastProvider>
        <PortalConfirmProvider>{element}</PortalConfirmProvider>
      </PortalToastProvider>
    )
  );
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const noopMutation = async () => undefined;
const noopDelete = async () => undefined;
const noopBulkDelete = async () => true;
const noopUrl = async () => "https://example.com/file";
const manageTicketing = (permission) => permission === P.MANAGE_TICKETING;
const manageFinance = (permission) =>
  permission === P.MANAGE_FINANCE ||
  permission === P.MANAGE_EXPENSES ||
  permission === P.APPROVE_EXPENSES;
const manageExpenses = (permission) => permission === P.MANAGE_EXPENSES;
const approveExpenses = (permission) => permission === P.APPROVE_EXPENSES;
const manageLeave = (permission) => permission === P.MANAGE_LEAVE;

function ActivityHarness({ deleteCalls, readCalls }) {
  const deleteItem = (...args) => {
    deleteCalls.push(args);
    return Promise.resolve();
  };
  const markNotificationRead = (args) => {
    readCalls.push(args);
    return Promise.resolve();
  };
  return (
    <ActivityView
      activity={[{ actorName: "System", createdAt: "2026-07-14", id: "act-1", message: "Updated" }]}
      canViewActivityLog
      deleteItem={deleteItem}
      markNotificationRead={markNotificationRead}
      notifications={[
        {
          body: "Review proposal",
          createdAt: "2026-07-14",
          entityId: "proposal-1",
          entityType: "proposal",
          id: "notif-1",
          title: "Proposal ready",
        },
      ]}
      removeNotification={noopMutation}
    />
  );
}

describe("Mounted portal ticketing and administration views", () => {
  test("Ticket dashboard preserves canonical ticket status presentation", async () => {
    const view = await mount(
      <TicketDashboardView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={manageTicketing}
        openModal={noop}
        removeManyTickets={noopMutation}
        removeTicket={noopMutation}
        summary={{
          attention: 1,
          fitTickets: 2,
          groupTickets: 3,
          issued: 4,
          issuedSeats: 5,
          pending: 2,
          pnrCount: 1,
          preview: [
            {
              id: "ticket-1",
              jobCode: "JC-0001-NS",
              ticketNumber: "999-111",
              ticketStatus: "Pending Issue",
              travellerName: "Asha Patel",
            },
          ],
          totalSeats: 8,
        }}
      />
    );

    expect(view.container.textContent).toContain("Pending Issue");
    expect(view.container.textContent).toContain("Pending issue — ticket not issued");
    expect(view.container.textContent).toContain("Asha Patel");

    await view.unmount();
  });

  test("Tickets list preserves travel batch labels and bulk selection affordance", async () => {
    const view = await mount(
      <TicketsView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={manageTicketing}
        openModal={noop}
        removeManyTickets={noopMutation}
        removeTicket={noopMutation}
        rows={[
          {
            id: "ticket-1",
            jobCode: "JC-0001-NS",
            ticketNumber: "999-111",
            ticketStatus: "Issued",
            travelBatchReference: "Batch A",
            travellerName: "Asha Patel",
          },
        ]}
      />
    );

    expect(view.container.textContent).toContain("Batch A");
    expect(view.container.textContent).toContain("Issued");
    expect(view.container.querySelector('input[type="checkbox"]')).toBeTruthy();

    await view.unmount();
  });

  test("Finance invoices preserve DD/MM/YYYY due dates", async () => {
    const view = await mount(
      <FinanceView
        deleteItem={noopDelete}
        has={manageFinance}
        openModal={noop}
        removeInvoice={noopMutation}
        rows={[
          {
            balanceAmount: 1000,
            clientName: "Acme Group",
            dueDate: "2026-07-14",
            expectedAmount: 5000,
            id: "inv-1",
            invoiceNumber: "INV-001",
            jobCode: "JC-0001-NS",
            receivedAmount: 4000,
            status: "Part Paid",
          },
        ]}
      />
    );

    expect(view.container.textContent).toContain("INV-001");
    expect(view.container.textContent).toContain("14/07/2026");

    await view.unmount();
  });

  test("Finance hides partial aggregate values while the bounded snapshot is preparing", async () => {
    const view = await mount(
      <FinanceView
        deleteItem={noopDelete}
        has={manageFinance}
        openModal={noop}
        overview={{
          aggregateCoverage: { complete: false },
          fundProjections: {
            advancePipeline: 999,
            expectedCollections: 999,
            pendingExpenseApprovals: 999,
            pendingReimbursements: 999,
          },
          summary: {
            approvedExpenses: 999,
            clientOutstanding: 999,
            totalRevenue: 999,
          },
        }}
        removeInvoice={noopMutation}
        rows={[]}
      />
    );

    expect(view.container.textContent).toContain("Finance totals are preparing");
    expect(view.container.textContent).not.toContain("Total Revenue");

    await view.unmount();
  });

  test("Finance exposes independent cursor controls for P&L and outstanding details", async () => {
    const loadPnl = mock(() => undefined);
    const loadOutstanding = mock(() => undefined);
    const view = await mount(
      <FinanceView
        deleteItem={noopDelete}
        has={manageFinance}
        openModal={noop}
        overview={{
          aggregateCoverage: { complete: true },
          fundProjections: {
            advancePipeline: 3500,
            expectedCollections: 1000,
            pendingExpenseApprovals: 0,
            pendingReimbursements: 0,
          },
          outstanding: [
            {
              clientName: "Acme Group",
              dueAmount: 1000,
              dueDate: "2026-07-14",
              id: "inv-1",
              jobCode: "JC-0001-NS",
              status: "Overdue",
            },
          ],
          outstandingPagination: { canLoadMore: true, loadMore: loadOutstanding },
          pnl: [
            {
              clientName: "Acme Group",
              expense: 1000,
              id: "job-1",
              jobCode: "JC-0001-NS",
              marginPercent: 80,
              profit: 4000,
              revenue: 5000,
            },
          ],
          pnlPagination: { canLoadMore: true, loadMore: loadPnl },
          summary: {
            approvedExpenses: 1000,
            clientOutstanding: 1000,
            totalRevenue: 5000,
          },
        }}
        removeInvoice={noopMutation}
        rows={[]}
      />
    );

    const loadMoreButtons = [...view.container.querySelectorAll("button")].filter(
      (button) => button.textContent?.trim() === "Load more records"
    );
    expect(loadMoreButtons.length).toBeGreaterThanOrEqual(2);
    await act(async () => loadMoreButtons[0]?.click());
    expect(loadPnl).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  test("Expenses preserve dates and expose deletion only for never-submitted drafts", async () => {
    const view = await mount(
      <ExpensesView
        decideExpenseFinance={noopMutation}
        decideExpenseManager={noopMutation}
        deleteItem={noopDelete}
        getExpenseAttachmentUrl={noopUrl}
        has={manageExpenses}
        openModal={noop}
        removeExpense={noopMutation}
        removeExpenseProof={noopMutation}
        rows={[
          {
            amount: 1200,
            approvalStatus: "Pending",
            canApproveFinance: true,
            canDelete: false,
            category: "Meals",
            expenseDate: "2026-07-14",
            id: "exp-1",
            jobCode: "JC-0001-NS",
            submittedForApprovalAt: "2026-07-14T00:00:00.000Z",
          },
          {
            amount: 600,
            approvalStatus: "Pending",
            canDelete: true,
            category: "Transport",
            expenseDate: "2026-07-15",
            id: "exp-2",
            jobCode: "Office",
          },
        ]}
        submitExpenseForApproval={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("14/07/2026");
    expect(view.container.textContent).toContain("Finance approve");
    expect(view.container.textContent).toContain("Retained for audit");
    expect(view.container.querySelectorAll('[aria-label="Delete Transport expense"]')).toHaveLength(
      2
    );
    expect(view.container.querySelector('[aria-label="Delete Meals expense"]')).toBeNull();

    await view.unmount();
  });

  test("Approvals preserve pending decision actions", async () => {
    const view = await mount(
      <ApprovalsView
        decideApproval={noopMutation}
        deleteItem={noopDelete}
        has={approveExpenses}
        openModal={noop}
        removeApproval={noopMutation}
        rows={[
          {
            amount: 5000,
            id: "approval-1",
            requestCode: "APR-001",
            requestedByName: "Nina Sales",
            status: "Pending",
            type: "Expense",
          },
        ]}
      />
    );

    expect(view.container.textContent).toContain("APR-001");
    expect(view.container.textContent).toContain("Approve");
    expect(view.container.textContent).toContain("Request Details");

    await view.unmount();
  });

  test("Leave view preserves two-stage and final authority approvals", async () => {
    const view = await mount(
      <LeaveView
        access={{ roles: ["HR"], staffId: "staff-hr" }}
        decideLeave={noopMutation}
        deleteItem={noopDelete}
        has={manageLeave}
        leaveBalances={[{ availableDays: 8, fiscalYear: "2026-27", leaveType: "Casual" }]}
        openModal={noop}
        removeLeave={noopMutation}
        rows={[
          {
            canApproveFinal: true,
            canApproveHead: true,
            canApproveHr: true,
            canReject: true,
            department: "Sales",
            endDate: "2026-07-20",
            headReviewStatus: "Pending",
            hrReviewStatus: "Pending",
            id: "leave-1",
            leaveType: "Casual",
            staffId: "staff-1",
            staffName: "Nina Sales",
            startDate: "2026-07-18",
            status: "Pending",
          },
        ]}
      />
    );

    expect(view.container.textContent).toContain("Approve (Head)");
    expect(view.container.textContent).toContain("Approve (HR)");
    expect(view.container.textContent).toContain("Approve (Final Authority)");
    expect(view.container.textContent).toContain("My leave balances");

    await view.unmount();
  });

  test("Activity notifications stay unread until clicked and support deep links", async () => {
    const deleteCalls = [];
    const pushed = [];
    const readCalls = [];

    mock.module("next/navigation", () => ({
      useRouter: () => ({ push: (href) => pushed.push(href) }),
    }));

    const view = await mount(<ActivityHarness deleteCalls={deleteCalls} readCalls={readCalls} />);

    expect(view.container.textContent).toContain("Unread");
    expect(readCalls).toEqual([]);
    await act(async () =>
      view.container
        .querySelector('button[aria-label="Delete Proposal ready"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(deleteCalls).toHaveLength(1);
    expect(readCalls).toEqual([]);
    expect(pushed).toEqual([]);
    const row = view.container.querySelector('[role="button"]');
    expect(row).toBeTruthy();
    await act(async () => row?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(readCalls).toEqual([{ notificationId: "notif-1" }]);
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toContain("/portal/proposals");
    expect(pushed[0]).toContain("open=proposal");
    expect(pushed[0]).toContain("id=proposal-1");

    await view.unmount();
    mock.restore();
  });

  test("Settings preserves staff onboarding and workbook actions", async () => {
    const view = await mount(
      <SettingsView
        deleteItem={noopDelete}
        dropdowns={{ department: ["Sales", "Operations"] }}
        openModal={noop}
        removeStaff={noopMutation}
        search=""
        staff={[
          {
            active: true,
            email: "nina@citiusholidays.com",
            id: "staff-1",
            name: "Nina Sales",
            onboardingStatus: "pending",
            roles: ["Sales"],
          },
        ]}
        startStaffOnboarding={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("Open workbook import");
    expect(view.container.textContent).toContain("Resend verification");
    expect(view.container.textContent).toContain("Nina Sales");
    expect(view.container.textContent).toContain("Additional email alert roles");
    expect(view.container.textContent).toContain("No additional email alert roles");

    await view.unmount();
  });
});
