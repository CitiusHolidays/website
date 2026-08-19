"use client";

import { useCallback } from "react";
import { formatDate } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import {
  canCreateJobCardFromAccounts,
  canManageJobCardCreatorAccess,
} from "@/lib/portal/permissions";
import { runMutation } from "@/lib/portal/runMutation";
import type {
  AccountsJobCardViewProps,
  PortalJobCardListRow,
  PortalQueryListRow,
} from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, Panel } from "../portalWorkspaceListUi";
import { PAYMENT_TERMS_REFERENCE_ROWS, paymentTermLabel } from "./paymentTerms";

type CreatorRow = AccountsJobCardViewProps["creators"][number];

function CreatorAccessButton({
  row,
  setJobCardCreatorAccess,
}: {
  row: CreatorRow;
  setJobCardCreatorAccess: AccountsJobCardViewProps["setJobCardCreatorAccess"];
}) {
  const toast = usePortalToast();
  const toggleAccess = useCallback(
    () =>
      runMutation(
        {
          showToast: toast,
          successMessage: row.jobCardCreatorEnabled
            ? "Job Card creator access removed."
            : "Job Card creator access enabled.",
        },
        () => setJobCardCreatorAccess({ enabled: !row.jobCardCreatorEnabled, staffId: row.id })
      ),
    [row.id, row.jobCardCreatorEnabled, setJobCardCreatorAccess, toast]
  );
  return (
    <button className="portal-small-btn" onClick={toggleAccess} type="button">
      {row.jobCardCreatorEnabled ? "Disable" : "Enable"}
    </button>
  );
}

function AccountQueryAction({
  canCreateJobCards,
  linkedJob,
  openModal,
  row,
}: {
  canCreateJobCards: boolean;
  linkedJob: PortalJobCardListRow | undefined;
  openModal: AccountsJobCardViewProps["openModal"];
  row: PortalQueryListRow;
}) {
  const openFiles = useCallback(() => {
    if (linkedJob) {
      openModal("commercialFiles", { entityId: String(linkedJob.id), entryPoint: "jobCard" });
    }
  }, [linkedJob, openModal]);
  const openJobCard = useCallback(() => {
    openModal("jobCard", {
      clientName: row.clientName,
      confirmedPax: String(row.paxCount),
      destination: row.destination,
      queryId: String(row.id),
      travelEndDate: row.travelEndDate,
      travelStartDate: row.travelStartDate,
    });
  }, [openModal, row]);

  if (linkedJob) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-brand-muted text-xs">
          Linked to {linkedJob.jobCode}
        </span>
        <button className="portal-small-btn" onClick={openFiles} type="button">
          Files
        </button>
      </div>
    );
  }
  if (!canCreateJobCards) {
    return <Badge label="View only" tone="slate" />;
  }
  return (
    <button className="portal-small-btn" onClick={openJobCard} type="button">
      Open JC
    </button>
  );
}

export function AccountsJobCardView({
  rows,
  jobCards,
  creators,
  setJobCardCreatorAccess,
  openModal,
  access,
}: AccountsJobCardViewProps) {
  const confirmed = rows.filter(
    (row) => row.salesStatus === "Order Confirmed" || row.contractingStatus === "Order Confirmed"
  );
  const jobByQuery = jobCards.reduce((map, job) => {
    if (job.queryId) {
      map.set(String(job.queryId), job);
    }
    return map;
  }, new Map<string, PortalJobCardListRow>());
  const canAssignCreator = canManageJobCardCreatorAccess(access);
  const canCreateJobCards = canCreateJobCardFromAccounts(access, creators);

  return (
    <div className="space-y-5">
      <Panel title="Job Card creators">
        <SelectableDataTable
          columns={[
            { id: "name", label: "Name", render: (row) => strong(row.name) },
            { id: "email", label: "Email", render: (row) => row.email },
            { id: "role", label: "Role", render: (row) => row.roles.join(", ") },
            {
              id: "create-access",
              label: "Create access",
              render: (row) => (
                <Badge
                  label={row.jobCardCreatorEnabled ? "Enabled" : "View only"}
                  tone={row.jobCardCreatorEnabled ? "green" : "slate"}
                />
              ),
            },
            {
              id: "action",
              kind: "action",
              label: "Action",
              render: (row) =>
                canAssignCreator ? (
                  <CreatorAccessButton
                    row={row}
                    setJobCardCreatorAccess={setJobCardCreatorAccess}
                  />
                ) : (
                  <span className="font-semibold text-brand-muted text-xs">Managed by head</span>
                ),
            },
          ]}
          compact
          empty="No Accounts staff found."
          rows={creators}
        />
      </Panel>
      <Panel title="Payment terms reference">
        <SelectableDataTable
          columns={[
            { id: "type", label: "Type", render: (row) => strong(row.type) },
            { id: "advance", label: "Advance", render: (row) => row.advance },
            { id: "balance", label: "Balance", render: (row) => row.balance },
            {
              id: "notification",
              label: "Notification",
              render: (row) => row.notify,
            },
          ]}
          compact
          empty="No payment terms configured."
          rows={PAYMENT_TERMS_REFERENCE_ROWS}
        />
      </Panel>
      <SelectableDataTable
        columns={[
          { id: "query", label: "Query", render: (row) => row.queryCode },
          { id: "client", label: "Client", render: (row) => strong(row.clientName) },
          {
            id: "confirmed",
            label: "Confirmed",
            render: (row) => (
              <span className="text-brand-muted text-xs">{formatDate(row.confirmedAt)}</span>
            ),
          },
          {
            id: "destination",
            label: "Destination",
            render: (row) => row.destination || "TBD",
          },
          { id: "pax", label: "Pax", render: (row) => row.paxCount },
          {
            id: "payment-terms",
            label: "Payment Terms",
            render: (row) => paymentTermLabel(row.queryType),
          },
          {
            id: "job-card",
            label: "Job Card",
            render: (row) => {
              const linkedJob = jobByQuery.get(String(row.id));
              return linkedJob ? (
                <div>
                  <Badge label={linkedJob.jobCode} tone="green" />
                  <div className="mt-1 text-brand-muted text-xs">
                    Opened {formatDate(linkedJob.createdAt)}
                  </div>
                </div>
              ) : (
                <Badge label="Not opened" tone="orange" />
              );
            },
          },
          {
            id: "action",
            kind: "action",
            label: "Action",
            render: (row: PortalQueryListRow) => {
              const linkedJob = jobByQuery.get(String(row.id));
              return (
                <AccountQueryAction
                  canCreateJobCards={canCreateJobCards}
                  linkedJob={linkedJob}
                  openModal={openModal}
                  row={row}
                />
              );
            },
          },
        ]}
        empty="No confirmed orders waiting for Job Card creation."
        rows={confirmed}
      />
    </div>
  );
}
