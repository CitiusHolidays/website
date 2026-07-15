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

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/ticketing",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
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

describe("mounted portal ticketing and administration views", () => {
  test("Ticket dashboard preserves canonical ticket status presentation", async () => {
    const view = await mount(
      <TicketDashboardView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={manageTicketing}
        openModal={() => undefined}
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
          totalSeats: 8,
        }}
        tickets={[
          {
            id: "ticket-1",
            jobCode: "JC-0001-NS",
            ticketNumber: "999-111",
            ticketStatus: "Pending Issue",
            travellerName: "Asha Patel",
          },
        ]}
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
        openModal={() => undefined}
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
        openModal={() => undefined}
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

  test("Expenses preserve expense dates and finance decision actions", async () => {
    const view = await mount(
      <ExpensesView
        decideExpenseFinance={noopMutation}
        decideExpenseManager={noopMutation}
        deleteItem={noopDelete}
        getExpenseAttachmentUrl={noopUrl}
        has={(permission) => permission === P.MANAGE_EXPENSES}
        openModal={() => undefined}
        removeExpense={noopMutation}
        removeExpenseProof={noopMutation}
        rows={[
          {
            amount: 1200,
            approvalStatus: "Pending",
            canApproveFinance: true,
            category: "Meals",
            expenseDate: "2026-07-14",
            id: "exp-1",
            jobCode: "JC-0001-NS",
          },
        ]}
        submitExpenseForApproval={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("14/07/2026");
    expect(view.container.textContent).toContain("Finance approve");

    await view.unmount();
  });

  test("Approvals preserve pending decision actions", async () => {
    const view = await mount(
      <ApprovalsView
        decideApproval={noopMutation}
        deleteItem={noopDelete}
        has={(permission) => permission === P.APPROVE_EXPENSES}
        openModal={() => undefined}
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
        has={(permission) => permission === P.MANAGE_LEAVE}
        leaveBalances={[{ availableDays: 8, fiscalYear: "2026-27", leaveType: "Casual" }]}
        openModal={() => undefined}
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
    const pushed = [];
    const readCalls = [];

    mock.module("next/navigation", () => ({
      useRouter: () => ({ push: (href) => pushed.push(href) }),
    }));

    const view = await mount(
      <ActivityView
        activity={[
          { actorName: "System", createdAt: "2026-07-14", id: "act-1", message: "Updated" },
        ]}
        deleteItem={noopDelete}
        markNotificationRead={async (args) => {
          readCalls.push(args);
        }}
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

    expect(view.container.textContent).toContain("Unread");
    const row = view.container.querySelector('[role="button"]');
    expect(row).toBeTruthy();
    await act(async () => row?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(readCalls).toEqual([{ notificationId: "notif-1" }]);
    expect(pushed.length).toBe(1);

    await view.unmount();
    mock.restore();
  });

  test("Settings preserves staff onboarding and workbook actions", async () => {
    const view = await mount(
      <SettingsView
        deleteItem={noopDelete}
        dropdowns={{ department: ["Sales", "Operations"] }}
        openModal={() => undefined}
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

    await view.unmount();
  });
});
