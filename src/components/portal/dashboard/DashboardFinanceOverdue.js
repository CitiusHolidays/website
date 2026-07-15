"use client";

import Link from "next/link";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import {
  getInvoiceAttention,
  invoiceDueDatePresentation,
} from "@/lib/portal/invoiceListPresentation";
import { DashboardPanel } from "./DashboardPanel";
import { formatMoney } from "./utils";

export function DashboardFinanceOverdue({ invoices, dateRange }) {
  const rows = invoices || [];

  return (
    <DashboardPanel title="Overdue invoices">
      <SelectableDataTable
        columns={[
          {
            id: "invoice",
            kind: "identity",
            label: "Invoice",
            render: (row) => (
              <Link
                className="font-semibold text-citius-blue hover:underline"
                href={buildDashboardListUrl({ dateRange, view: "finance" })}
              >
                {row.invoiceNumber}
              </Link>
            ),
            sortValue: (row) => row.invoiceNumber,
          },
          {
            id: "client",
            label: "Client",
            render: (row) => row.clientName || "—",
            sortValue: (row) => row.clientName,
          },
          {
            id: "due",
            label: "Due",
            render: (row) => (
              <span className="tabular-nums">
                {invoiceDueDatePresentation(row.dueDate).display}
              </span>
            ),
            sortValue: (row) => invoiceDueDatePresentation(row.dueDate).sortValue,
          },
          {
            align: "right",
            id: "balance",
            label: "Balance",
            render: (row) => formatMoney(row.balanceAmount),
            sortValue: (row) => row.balanceAmount,
          },
        ]}
        compact
        empty="No overdue balances in this period."
        rowAttention={(row) =>
          getInvoiceAttention({ ...row, balanceAmount: Number(row.balanceAmount) || 1 })
        }
        rows={rows}
      />
    </DashboardPanel>
  );
}
