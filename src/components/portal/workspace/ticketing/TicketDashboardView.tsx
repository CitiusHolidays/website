"use client";

import { FileText, Plane, RefreshCw, Ticket, Users } from "lucide-react";
import { LoadingPanel } from "../portalAdminHelpers";
import type { TicketDashboardViewProps } from "../portalViewTypes";
import { StatCard } from "../portalWorkspaceListUi";
import { TicketsView } from "./TicketsView";

export function TicketDashboardView({
  summary,
  tickets,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeTicket,
  removeManyTickets,
}: TicketDashboardViewProps) {
  if (!summary) {
    return <LoadingPanel />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard Icon={Ticket} label="Issued" value={summary.issued ?? 0} />
        <StatCard Icon={Plane} label="Pending" value={summary.pending ?? 0} />
        <StatCard Icon={RefreshCw} label="Attention" value={summary.attention ?? 0} />
        <StatCard Icon={Ticket} label="FIT Tickets" value={summary.fitTickets ?? 0} />
        <StatCard Icon={Users} label="Group Tickets" value={summary.groupTickets ?? 0} />
        <StatCard Icon={FileText} label="PNRs" value={summary.pnrCount ?? 0} />
        <StatCard
          Icon={Users}
          label="Issued Seats"
          value={`${summary.issuedSeats ?? 0}/${summary.totalSeats ?? 0}`}
        />
      </div>
      <TicketsView
        deleteItem={deleteItem}
        deleteSelected={deleteSelected}
        has={has}
        openModal={openModal}
        removeManyTickets={removeManyTickets}
        removeTicket={removeTicket}
        rows={tickets.slice(0, 8)}
      />
    </div>
  );
}
