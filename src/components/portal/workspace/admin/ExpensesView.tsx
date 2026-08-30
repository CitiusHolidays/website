"use client";

import type { MouseEvent } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Button } from "@/components/ui/application-button";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { runMutation } from "@/lib/portal/runMutation";
import { decisionRowAttention } from "../portalAdminUtils";
import type { ExpensesViewProps, PortalExpenseListRow } from "../portalViewTypes";
import { money, openQueryAttachment, strong } from "../portalWorkspaceListHelpers";
import { DeleteButton, EditButton, StatusBadge } from "../portalWorkspaceListUi";
import { usePortalRowActionOwner } from "../usePortalRowActionOwner";

type ExpenseRow = PortalExpenseListRow;
type PortalRowActionOwner = ReturnType<typeof usePortalRowActionOwner>;

function expenseRowAttention(row: ExpenseRow) {
  return decisionRowAttention(row.approvalStatus);
}

function ExpenseProofButton({
  getExpenseAttachmentUrl,
  proof,
}: {
  getExpenseAttachmentUrl: ExpensesViewProps["getExpenseAttachmentUrl"];
  proof: NonNullable<ExpenseRow["proofAttachment"]>;
}) {
  const openProof = () => openQueryAttachment(proof.id, getExpenseAttachmentUrl, "expense");
  return (
    <button className="portal-small-btn" onClick={openProof} type="button">
      {proof.fileName}
    </button>
  );
}

function ExpenseRowActions({
  actionOwner,
  decideExpenseFinance,
  decideExpenseManager,
  deleteItem,
  openModal,
  removeExpense,
  removeExpenseProof,
  row,
  submitExpenseForApproval,
}: Pick<
  ExpensesViewProps,
  | "decideExpenseFinance"
  | "decideExpenseManager"
  | "deleteItem"
  | "openModal"
  | "removeExpense"
  | "removeExpenseProof"
  | "submitExpenseForApproval"
> & { actionOwner: PortalRowActionOwner; row: ExpenseRow }) {
  const toast = usePortalToast();
  const rowId = String(row.id);
  const pendingAction = actionOwner.pendingActionForRow(rowId);
  const rowActionPending = pendingAction !== null;
  const runOwnedAction = (
    event: MouseEvent<HTMLButtonElement>,
    actionKey: string,
    action: () => Promise<void>
  ) => {
    actionOwner.runAction({ action, actionKey, rowId, trigger: event.currentTarget });
  };
  const edit = () => {
    openModal("expense", {
      amount: String(row.amount),
      cardAmount: String(row.cardAmount),
      cashAmount: String(row.cashAmount),
      category: row.category,
      currency: row.currency,
      entityId: String(row.id),
      epayAmount: String(row.epayAmount),
      expenseDate: row.expenseDate,
      expenseType: row.jobCardId ? "jobCard" : "office",
      jobCardId: row.jobCardId || "",
      notes: row.notes,
      paidBy: row.paidBy,
      particulars: row.particulars,
      tourManagerName: row.tourManagerName,
    });
  };
  const submit = (event: MouseEvent<HTMLButtonElement>) => {
    runOwnedAction(event, "submit", async () => {
      await runMutation(
        {
          label: "Expense approval",
          showToast: toast,
          successMessage: "Expense submitted for approval.",
        },
        () => submitExpenseForApproval({ expenseId: rowId })
      );
    });
  };
  const managerApprove = (event: MouseEvent<HTMLButtonElement>) => {
    runOwnedAction(event, "managerApprove", async () => {
      await runMutation(
        {
          label: "Manager approval",
          showToast: toast,
          successMessage: "Expense manager-approved.",
        },
        () => decideExpenseManager({ expenseId: rowId, status: "Approved" })
      );
    });
  };
  const managerReject = (event: MouseEvent<HTMLButtonElement>) => {
    runOwnedAction(event, "managerReject", async () => {
      await runMutation(
        { label: "Manager approval", showToast: toast, successMessage: "Expense rejected." },
        () => decideExpenseManager({ expenseId: rowId, status: "Rejected" })
      );
    });
  };
  const financeApprove = (event: MouseEvent<HTMLButtonElement>) => {
    runOwnedAction(event, "financeApprove", async () => {
      await runMutation(
        {
          label: "Finance approval",
          showToast: toast,
          successMessage: "Expense finance-approved.",
        },
        () =>
          decideExpenseFinance({
            expenseId: rowId,
            reimbursementStatus: "Pending",
            status: "Approved",
          })
      );
    });
  };
  const financeReject = (event: MouseEvent<HTMLButtonElement>) => {
    runOwnedAction(event, "financeReject", async () => {
      await runMutation(
        { label: "Finance approval", showToast: toast, successMessage: "Expense rejected." },
        () =>
          decideExpenseFinance({
            expenseId: rowId,
            reimbursementStatus: "Not Submitted",
            status: "Rejected",
          })
      );
    });
  };
  const removeProof = (event: MouseEvent<HTMLButtonElement>) => {
    const proof = row.proofAttachment;
    if (!proof) {
      return;
    }
    runOwnedAction(event, "removeProof", async () => {
      await runMutation(
        { label: "Expense proof", showToast: toast, successMessage: "Expense proof removed." },
        () => removeExpenseProof({ attachmentId: proof.id })
      );
    });
  };
  const remove = () => {
    deleteItem(`${row.category} expense`, removeExpense, { expenseId: String(row.id) });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {row.approvalStatus === "Approved" ? null : (
        <EditButton disabled={rowActionPending} onClick={edit} />
      )}
      {row.submittedForApprovalAt ? null : (
        <Button
          aria-label={`Submit ${row.category} expense for approval`}
          className="portal-small-btn"
          disabled={rowActionPending}
          loading={pendingAction === "submit"}
          onClick={submit}
          type="button"
        >
          {pendingAction === "submit" ? "Submitting…" : "Submit for approval"}
        </Button>
      )}
      {row.canApproveManager ? (
        <>
          <Button
            aria-label={`Manager approve ${row.category} expense`}
            className="portal-small-btn"
            disabled={rowActionPending}
            loading={pendingAction === "managerApprove"}
            onClick={managerApprove}
            type="button"
          >
            {pendingAction === "managerApprove" ? "Manager approving…" : "Manager approve"}
          </Button>
          <Button
            aria-label={`Manager reject ${row.category} expense`}
            className="portal-danger-btn"
            disabled={rowActionPending}
            loading={pendingAction === "managerReject"}
            onClick={managerReject}
            type="button"
          >
            {pendingAction === "managerReject" ? "Manager rejecting…" : "Manager reject"}
          </Button>
        </>
      ) : null}
      {row.canApproveFinance ? (
        <>
          <Button
            aria-label={`Finance approve ${row.category} expense`}
            className="portal-small-btn"
            disabled={rowActionPending}
            loading={pendingAction === "financeApprove"}
            onClick={financeApprove}
            type="button"
          >
            {pendingAction === "financeApprove" ? "Finance approving…" : "Finance approve"}
          </Button>
          <Button
            aria-label={`Finance reject ${row.category} expense`}
            className="portal-danger-btn"
            disabled={rowActionPending}
            loading={pendingAction === "financeReject"}
            onClick={financeReject}
            type="button"
          >
            {pendingAction === "financeReject" ? "Finance rejecting…" : "Finance reject"}
          </Button>
        </>
      ) : null}
      {row.proofAttachment ? (
        <Button
          aria-label={`Remove proof from ${row.category} expense`}
          className="portal-small-btn"
          disabled={rowActionPending}
          loading={pendingAction === "removeProof"}
          onClick={removeProof}
          type="button"
        >
          {pendingAction === "removeProof" ? "Removing proof…" : "Remove expense proof"}
        </Button>
      ) : null}
      {row.canDelete ? (
        <DeleteButton
          disabled={rowActionPending}
          label={`${row.category} expense`}
          onClick={remove}
        />
      ) : (
        <PortalTooltip content="Expenses that entered approval are retained as audit records.">
          <span className="self-center text-brand-muted text-xs">Retained for audit</span>
        </PortalTooltip>
      )}
    </div>
  );
}

export function ExpensesView({
  rows,
  filtersActive = false,
  openModal,
  has,
  deleteItem,
  removeExpense,
  submitExpenseForApproval,
  decideExpenseManager,
  decideExpenseFinance,
  getExpenseAttachmentUrl,
  removeExpenseProof,
}: ExpensesViewProps) {
  const actionOwner = usePortalRowActionOwner();

  return (
    <SelectableDataTable
      columns={[
        {
          id: "job",
          kind: "identity",
          label: "Job",
          render: (row: ExpenseRow) => row.jobCode,
          sortValue: (row: ExpenseRow) => row.jobCode || "",
        },
        {
          id: "date",
          label: "Date",
          render: (row: ExpenseRow) => formatDisplayDate(row.expenseDate),
          sortValue: (row: ExpenseRow) => row.expenseDate,
        },
        {
          id: "category",
          label: "Category",
          render: (row: ExpenseRow) => strong(row.category),
          sortValue: (row: ExpenseRow) => row.category,
        },
        {
          hideable: true,
          id: "particulars",
          label: "Particulars",
          render: (row: ExpenseRow) => row.particulars || "-",
        },
        {
          hideable: true,
          id: "currency",
          label: "Currency",
          render: (row: ExpenseRow) => row.currency,
        },
        {
          align: "right",
          id: "amount",
          label: "Amount",
          render: (row: ExpenseRow) => money(row.amount),
          sortValue: (row: ExpenseRow) => row.amount,
        },
        {
          hideable: true,
          id: "split",
          label: "Split",
          render: (row: ExpenseRow) =>
            `Card ${money(row.cardAmount)} / Cash ${money(row.cashAmount)} / E-Pay ${money(row.epayAmount)}`,
        },
        {
          hideable: true,
          id: "paid-by",
          label: "Paid By",
          render: (row: ExpenseRow) => row.paidBy,
        },
        {
          hideable: true,
          id: "proof",
          label: "Proof",
          render: (row: ExpenseRow) => {
            const proof = row.proofAttachment;
            return proof ? (
              <ExpenseProofButton getExpenseAttachmentUrl={getExpenseAttachmentUrl} proof={proof} />
            ) : (
              "-"
            );
          },
        },
        {
          id: "approval",
          kind: "status",
          label: "Approval",
          render: (row: ExpenseRow) => (
            <div className="space-y-1">
              <StatusBadge domain="expense" status={row.approvalStatus} />
              <div className="text-brand-muted text-xs">
                Manager: {row.managerReviewStatus || "Pending"}
              </div>
              <div className="text-brand-muted text-xs">
                Finance: {row.financeReviewStatus || "Pending"}
              </div>
            </div>
          ),
          sortValue: (row: ExpenseRow) => row.approvalStatus || "",
        },
        {
          hideable: true,
          id: "reimbursement",
          label: "Reimbursement",
          render: (row: ExpenseRow) => row.reimbursementStatus,
        },
        {
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: ExpenseRow) =>
            (has(P.MANAGE_EXPENSES) || has(P.CREATE_EXPENSES) || has(P.MANAGE_ALL_EXPENSES)) && (
              <ExpenseRowActions
                actionOwner={actionOwner}
                decideExpenseFinance={decideExpenseFinance}
                decideExpenseManager={decideExpenseManager}
                deleteItem={deleteItem}
                openModal={openModal}
                removeExpense={removeExpense}
                removeExpenseProof={removeExpenseProof}
                row={row}
                submitExpenseForApproval={submitExpenseForApproval}
              />
            ),
        },
      ]}
      empty="No expenses yet."
      filtersActive={filtersActive}
      rowAttention={expenseRowAttention}
      rows={rows}
    />
  );
}
