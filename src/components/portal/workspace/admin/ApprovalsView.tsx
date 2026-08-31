"use client";

import type { MouseEvent } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Button } from "@/components/ui/application-button";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { runMutation } from "@/lib/portal/runMutation";
import { decisionRowAttention } from "../portalAdminUtils";
import type { ApprovalsViewProps, PortalApprovalListRow } from "../portalViewTypes";
import { money, strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton, StatusBadge } from "../portalWorkspaceListUi";
import { usePortalRowActionOwner } from "../usePortalRowActionOwner";

type ApprovalRow = PortalApprovalListRow;
type PortalRowActionOwner = ReturnType<typeof usePortalRowActionOwner>;

function approvalRowAttention(row: ApprovalRow) {
  return decisionRowAttention(row.status);
}

function ApprovalRowActions({
  actionOwner,
  decideApproval,
  deleteItem,
  openModal,
  removeApproval,
  row,
}: Pick<ApprovalsViewProps, "decideApproval" | "deleteItem" | "openModal" | "removeApproval"> & {
  actionOwner: PortalRowActionOwner;
  row: ApprovalRow;
}) {
  const toast = usePortalToast();
  const rowId = String(row.id);
  const pendingAction = actionOwner.pendingActionForRow(rowId);
  const rowActionPending = pendingAction !== null;
  const approve = (event: MouseEvent<HTMLButtonElement>) => {
    actionOwner.runAction({
      action: async () => {
        await runMutation(
          {
            label: "Approval",
            showToast: toast,
            successMessage: "Approval approved.",
          },
          () => decideApproval({ approvalId: rowId, status: "Approved" })
        );
      },
      actionKey: "approve",
      rowId,
      trigger: event.currentTarget,
    });
  };
  const requestDetails = () => {
    openModal("approvalDecide", {
      approvalId: String(row.id),
      approvalStatus: "Needs Info",
      decisionNote: "",
    });
  };
  const reject = () => {
    openModal("approvalDecide", {
      approvalId: String(row.id),
      approvalStatus: "Rejected",
      decisionNote: "",
    });
  };
  const remove = () => {
    deleteItem(row.requestCode, removeApproval, { approvalId: String(row.id) });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {row.status === "Pending" ? (
        <>
          <Button
            aria-label={`${pendingAction === "approve" ? "Approving" : "Approve"} ${row.requestCode}`}
            className="portal-small-btn"
            disabled={rowActionPending}
            loading={pendingAction === "approve"}
            onClick={approve}
            type="button"
          >
            {pendingAction === "approve" ? "Approving…" : "Approve"}
          </Button>
          <Button
            aria-label={`Request details for ${row.requestCode}`}
            className="portal-small-btn"
            disabled={rowActionPending}
            onClick={requestDetails}
            type="button"
          >
            Request Details
          </Button>
          <Button
            aria-label={`Reject ${row.requestCode}`}
            className="portal-danger-btn"
            disabled={rowActionPending}
            onClick={reject}
            type="button"
          >
            Reject
          </Button>
        </>
      ) : (
        <DeleteButton disabled={rowActionPending} label={row.requestCode} onClick={remove} />
      )}
    </div>
  );
}

export function ApprovalsView({
  rows,
  has,
  openModal,
  decideApproval,
  deleteItem,
  removeApproval,
}: ApprovalsViewProps) {
  const actionOwner = usePortalRowActionOwner();

  return (
    <SelectableDataTable
      columns={[
        {
          id: "code",
          kind: "identity",
          label: "Code",
          render: (row: ApprovalRow) => strong(row.requestCode),
          sortValue: (row: ApprovalRow) => row.requestCode,
        },
        {
          id: "type",
          label: "Type",
          render: (row: ApprovalRow) => <Badge label={row.type} tone="blue" />,
          sortValue: (row: ApprovalRow) => row.type || "",
        },
        {
          id: "requested-by",
          label: "Requested By",
          render: (row: ApprovalRow) => row.requestedByName,
          sortValue: (row: ApprovalRow) => row.requestedByName || "",
        },
        {
          hideable: true,
          id: "summary",
          label: "Summary",
          render: (row: ApprovalRow) => row.summary,
        },
        {
          align: "right",
          id: "amount",
          label: "Amount",
          render: (row: ApprovalRow) => money(row.amount),
          sortValue: (row: ApprovalRow) => row.amount,
        },
        {
          id: "status",
          kind: "status",
          label: "Status",
          render: (row: ApprovalRow) => <StatusBadge domain="approval" status={row.status} />,
          sortValue: (row: ApprovalRow) => row.status || "",
        },
        {
          hideable: true,
          id: "note",
          label: "Note",
          render: (row: ApprovalRow) => row.decisionNote || "-",
        },
        {
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: ApprovalRow) =>
            has(P.APPROVE_EXPENSES) ? (
              <ApprovalRowActions
                actionOwner={actionOwner}
                decideApproval={decideApproval}
                deleteItem={deleteItem}
                openModal={openModal}
                removeApproval={removeApproval}
                row={row}
              />
            ) : null,
        },
      ]}
      empty="No approvals in the queue."
      layoutKey="approvals:list"
      rowAttention={approvalRowAttention}
      rows={rows}
    />
  );
}
