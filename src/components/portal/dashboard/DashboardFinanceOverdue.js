"use client";

import Link from "next/link";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";
import { formatMoney } from "./utils";

export function DashboardFinanceOverdue({ invoices, dateRange }) {
  const rows = invoices || [];

  return (
    <DashboardPanel title="Overdue invoices">
      {!rows.length ? (
        <DashboardEmpty label="No overdue balances in this period." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand-border text-xs text-brand-muted">
                <th className="py-2 pr-3 font-semibold">Invoice</th>
                <th className="py-2 pr-3 font-semibold">Client</th>
                <th className="py-2 pr-3 font-semibold">Due</th>
                <th className="py-2 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-brand-border/60 last:border-0">
                  <td className="py-2 pr-3">
                    <Link
                      href={buildDashboardListUrl({ view: "finance", dateRange })}
                      className="font-semibold text-citius-blue hover:underline"
                    >
                      {row.invoiceNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{row.clientName || "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.dueDate || "—"}</td>
                  <td className="py-2 tabular-nums font-medium">
                    {formatMoney(row.balanceAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}
