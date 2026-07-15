"use client";

import { CheckCircle2, CircleDollarSign, ClipboardList, FileText, RefreshCw } from "lucide-react";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import {
  getInvoiceAttention,
  invoiceDueDatePresentation,
} from "@/lib/portal/invoiceListPresentation";
import type {
  FinanceViewProps,
  PortalFinanceOutstandingRow,
  PortalFinancePnlRow,
  PortalInvoiceListRow,
} from "../portalViewTypes";
import { money, strong } from "../portalWorkspaceListHelpers";
import { DeleteButton, EditButton, Panel, StatCard, StatusBadge } from "../portalWorkspaceListUi";

type InvoiceRow = PortalInvoiceListRow;

export function FinanceView({
  rows,
  overview,
  openModal,
  has,
  deleteItem,
  removeInvoice,
}: FinanceViewProps) {
  return (
    <div className="space-y-5">
      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              Icon={CircleDollarSign}
              label="Total Revenue"
              value={money(overview.summary.totalRevenue)}
            />
            <StatCard
              Icon={FileText}
              label="Client Outstanding"
              value={money(overview.summary.clientOutstanding)}
            />
            <StatCard
              Icon={ClipboardList}
              label="Approved Expenses"
              value={money(overview.summary.approvedExpenses)}
            />
          </div>
          {overview.fundProjections && (
            <Panel title="Fund projections">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  Icon={CircleDollarSign}
                  label="Expected collections"
                  value={money(overview.fundProjections.expectedCollections)}
                />
                <StatCard
                  Icon={ClipboardList}
                  label="Advance pipeline"
                  value={money(overview.fundProjections.advancePipeline)}
                />
                <StatCard
                  Icon={RefreshCw}
                  label="Pending reimbursements"
                  value={money(overview.fundProjections.pendingReimbursements)}
                />
                <StatCard
                  Icon={CheckCircle2}
                  label="Expense approvals due"
                  value={money(overview.fundProjections.pendingExpenseApprovals)}
                />
              </div>
            </Panel>
          )}
          <Panel title="Tour-wise P&L">
            <SelectableDataTable
              columns={[
                {
                  id: "job",
                  kind: "identity",
                  label: "JC",
                  render: (row: PortalFinancePnlRow) => row.jobCode,
                  sortValue: (row: PortalFinancePnlRow) => row.jobCode,
                },
                {
                  id: "group",
                  label: "Group",
                  render: (row: PortalFinancePnlRow) => row.clientName,
                  sortValue: (row: PortalFinancePnlRow) => row.clientName,
                },
                {
                  align: "right",
                  id: "revenue",
                  label: "Revenue",
                  render: (row: PortalFinancePnlRow) => money(row.revenue),
                  sortValue: (row: PortalFinancePnlRow) => row.revenue,
                },
                {
                  align: "right",
                  id: "expense",
                  label: "Expense",
                  render: (row: PortalFinancePnlRow) => money(row.expense),
                  sortValue: (row: PortalFinancePnlRow) => row.expense,
                },
                {
                  align: "right",
                  id: "profit",
                  label: "Profit",
                  render: (row: PortalFinancePnlRow) => money(row.profit),
                  sortValue: (row: PortalFinancePnlRow) => row.profit,
                },
                {
                  align: "right",
                  id: "margin",
                  label: "Margin",
                  render: (row: PortalFinancePnlRow) => `${row.marginPercent}%`,
                  sortValue: (row: PortalFinancePnlRow) => row.marginPercent,
                },
              ]}
              compact
              empty="No Job Cards available."
              rows={overview.pnl || []}
            />
          </Panel>
          <Panel title="Outstanding payments">
            <SelectableDataTable
              columns={[
                {
                  id: "client",
                  kind: "identity",
                  label: "Client",
                  render: (row: PortalFinanceOutstandingRow) => strong(row.clientName),
                  sortValue: (row: PortalFinanceOutstandingRow) => row.clientName,
                },
                {
                  id: "job",
                  label: "JC",
                  render: (row: PortalFinanceOutstandingRow) => row.jobCode,
                  sortValue: (row: PortalFinanceOutstandingRow) => row.jobCode,
                },
                {
                  align: "right",
                  id: "due",
                  label: "Due",
                  render: (row: PortalFinanceOutstandingRow) => money(row.dueAmount),
                  sortValue: (row: PortalFinanceOutstandingRow) => row.dueAmount,
                },
                {
                  id: "due-date",
                  label: "Due Date",
                  render: (row: PortalFinanceOutstandingRow) => (
                    <span className="tabular-nums">
                      {invoiceDueDatePresentation(String(row.dueDate || "")).display}
                    </span>
                  ),
                  sortValue: (row: PortalFinanceOutstandingRow) =>
                    invoiceDueDatePresentation(String(row.dueDate || "")).sortValue,
                },
                {
                  id: "status",
                  kind: "status",
                  label: "Status",
                  render: (row: PortalFinanceOutstandingRow) => (
                    <StatusBadge domain="invoice" status={row.status} />
                  ),
                  sortValue: (row: PortalFinanceOutstandingRow) => row.status || "",
                },
              ]}
              compact
              empty="No outstanding balances."
              rows={overview.outstanding || []}
            />
          </Panel>
        </>
      )}
      <SelectableDataTable
        columns={[
          {
            id: "invoice",
            kind: "identity",
            label: "Invoice",
            render: (row: InvoiceRow) => strong(row.invoiceNumber),
            sortValue: (row: InvoiceRow) => row.invoiceNumber,
          },
          {
            id: "job",
            label: "Job",
            render: (row: InvoiceRow) => row.jobCode,
            sortValue: (row: InvoiceRow) => row.jobCode || "",
          },
          {
            id: "client",
            label: "Client",
            render: (row: InvoiceRow) => row.clientName,
            sortValue: (row: InvoiceRow) => row.clientName || "",
          },
          {
            align: "right",
            id: "expected",
            label: "Expected",
            render: (row: InvoiceRow) => money(row.expectedAmount),
            sortValue: (row: InvoiceRow) => row.expectedAmount,
          },
          {
            align: "right",
            id: "received",
            label: "Received",
            render: (row: InvoiceRow) => money(row.receivedAmount),
            sortValue: (row: InvoiceRow) => row.receivedAmount,
          },
          {
            align: "right",
            id: "balance",
            label: "Balance",
            render: (row: InvoiceRow) => money(row.balanceAmount),
            sortValue: (row: InvoiceRow) => row.balanceAmount,
          },
          {
            id: "due-date",
            label: "Due Date",
            render: (row: InvoiceRow) => (
              <span className="tabular-nums">
                {invoiceDueDatePresentation(row.dueDate).display}
              </span>
            ),
            sortValue: (row: InvoiceRow) => invoiceDueDatePresentation(row.dueDate).sortValue,
          },
          {
            id: "status",
            kind: "status",
            label: "Status",
            render: (row: InvoiceRow) => <StatusBadge domain="invoice" status={row.status} />,
            sortValue: (row: InvoiceRow) => row.status || "",
          },
          {
            id: "action",
            kind: "action",
            label: "Action",
            render: (row: InvoiceRow) =>
              has(P.MANAGE_FINANCE) && (
                <div className="flex flex-wrap gap-2">
                  <EditButton
                    onClick={() =>
                      openModal("invoice", {
                        dueDate: row.dueDate,
                        entityId: row.id,
                        expectedAmount: String(row.expectedAmount),
                        invoiceNumber: row.invoiceNumber,
                        jobCardId: row.jobCardId,
                        receivedAmount: String(row.receivedAmount),
                      })
                    }
                  />
                  <DeleteButton
                    label={row.invoiceNumber}
                    onClick={() =>
                      deleteItem(row.invoiceNumber, removeInvoice, {
                        invoiceId: String(row.id),
                      })
                    }
                  />
                </div>
              ),
          },
        ]}
        empty="No invoices yet."
        rowAttention={(row: InvoiceRow) =>
          getInvoiceAttention(row as Parameters<typeof getInvoiceAttention>[0])
        }
        rows={rows}
      />
    </div>
  );
}
