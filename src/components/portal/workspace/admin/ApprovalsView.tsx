"use client";

import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { runMutation } from "@/lib/portal/runMutation";
import { decisionRowAttention } from "../portalAdminUtils";
import type { ApprovalsViewProps, PortalApprovalListRow } from "../portalViewTypes";
import { money, strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton, StatusBadge } from "../portalWorkspaceListUi";

type ApprovalRow = PortalApprovalListRow;

function approvalRowAttention(row: ApprovalRow) {
  return decisionRowAttention(row.status);
}

function ApprovalRowActions({
  decideApproval,
  deleteItem,
  openModal,
  removeApproval,
  row,
}: Pick<ApprovalsViewProps, "decideApproval" | "deleteItem" | "openModal" | "removeApproval"> & {
  row: ApprovalRow;
}) {
  const toast = usePortalToast();
  const approve = () => {
    runMutation(
      {
        label: "Approval",
        showToast: toast,
        successMessage: "Approval approved.",
      },
      () => decideApproval({ approvalId: String(row.id), status: "Approved" })
    ).catch(() => undefined);
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
          <button className="portal-small-btn" onClick={approve} type="button">
            Approve
          </button>
          <button className="portal-small-btn" onClick={requestDetails} type="button">
            Request Details
          </button>
          <button className="portal-danger-btn" onClick={reject} type="button">
            Reject
          </button>
        </>
      ) : (
        <DeleteButton label={row.requestCode} onClick={remove} />
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
      rowAttention={approvalRowAttention}
      rows={rows}
    />
  );
}
