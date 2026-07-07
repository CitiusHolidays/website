"use client";

import Link from "next/link";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";
import { formatMoney } from "./utils";

export function DashboardFinanceOverdue({ invoices, dateRange }) {
  const rows = invoices || [];

  return (
    <DashboardPanel title="Overdue invoices">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-brand-border border-b text-brand-muted text-xs">
                <th className="py-2 pr-3 font-semibold">Invoice</th>
                <th className="py-2 pr-3 font-semibold">Client</th>
                <th className="py-2 pr-3 font-semibold">Due</th>
                <th className="py-2 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-brand-border/60 border-b last:border-0" key={row.id}>
                  <td className="py-2 pr-3">
                    <Link
                      className="font-semibold text-citius-blue hover:underline"
                      href={buildDashboardListUrl({ dateRange, view: "finance" })}
                    >
                      {row.invoiceNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{row.clientName || "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.dueDate || "—"}</td>
                  <td className="py-2 font-medium tabular-nums">
                    {formatMoney(row.balanceAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DashboardEmpty label="No overdue balances in this period." />
      )}
    </DashboardPanel>
  );
}
