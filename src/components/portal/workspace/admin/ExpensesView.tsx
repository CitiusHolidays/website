"use client";

import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { runMutation } from "@/lib/portal/runMutation";
import { decisionRowAttention } from "../portalAdminUtils";
import type { ExpensesViewProps, PortalExpenseListRow } from "../portalViewTypes";
import { money, openQueryAttachment, strong } from "../portalWorkspaceListHelpers";
import { DeleteButton, EditButton, StatusBadge } from "../portalWorkspaceListUi";

type ExpenseRow = PortalExpenseListRow;

function expenseRowAttention(row: ExpenseRow) {
  return decisionRowAttention(row.approvalStatus);
}

const useTypedPortalToast = usePortalToast as unknown as () => {
  error: (message: string) => unknown;
  success: (message: string) => unknown;
};

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
  const toast = useTypedPortalToast();

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
              <button
                className="portal-small-btn"
                onClick={() => openQueryAttachment(proof.id, getExpenseAttachmentUrl, "expense")}
                type="button"
              >
                {proof.fileName}
              </button>
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
            has(P.MANAGE_EXPENSES) && (
              <div className="flex flex-wrap gap-2">
                {row.approvalStatus !== "Approved" && (
                  <EditButton
                    onClick={() =>
                      openModal("expense", {
                        amount: String(row.amount),
                        cardAmount: String(row.cardAmount),
                        cashAmount: String(row.cashAmount),
                        category: row.category,
                        currency: row.currency,
                        entityId: row.id,
                        epayAmount: String(row.epayAmount),
                        expenseDate: row.expenseDate,
                        expenseType: row.jobCardId ? "jobCard" : "office",
                        jobCardId: row.jobCardId || "",
                        notes: row.notes,
                        paidBy: row.paidBy,
                        particulars: row.particulars,
                        tourManagerName: row.tourManagerName,
                      })
                    }
                  />
                )}
                {!row.submittedForApprovalAt && (
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      runMutation(
                        {
                          label: "Expense approval",
                          showToast: toast,
                          successMessage: "Expense submitted for approval.",
                        },
                        () => submitExpenseForApproval({ expenseId: String(row.id) })
                      ).catch(() => {})
                    }
                    type="button"
                  >
                    Submit for approval
                  </button>
                )}
                {row.canApproveManager && (
                  <>
                    <button
                      className="portal-small-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Manager approval",
                            showToast: toast,
                            successMessage: "Expense manager-approved.",
                          },
                          () =>
                            decideExpenseManager({
                              expenseId: String(row.id),
                              status: "Approved",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Manager approve
                    </button>
                    <button
                      className="portal-danger-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Manager approval",
                            showToast: toast,
                            successMessage: "Expense rejected.",
                          },
                          () =>
                            decideExpenseManager({
                              expenseId: String(row.id),
                              status: "Rejected",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Manager reject
                    </button>
                  </>
                )}
                {row.canApproveFinance && (
                  <>
                    <button
                      className="portal-small-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Finance approval",
                            showToast: toast,
                            successMessage: "Expense finance-approved.",
                          },
                          () =>
                            decideExpenseFinance({
                              expenseId: String(row.id),
                              reimbursementStatus: "Pending",
                              status: "Approved",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Finance approve
                    </button>
                    <button
                      className="portal-danger-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Finance approval",
                            showToast: toast,
                            successMessage: "Expense rejected.",
                          },
                          () =>
                            decideExpenseFinance({
                              expenseId: String(row.id),
                              reimbursementStatus: "Not Submitted",
                              status: "Rejected",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Finance reject
                    </button>
                  </>
                )}
                {row.proofAttachment && (
                  <button
                    className="portal-small-btn"
                    onClick={() => {
                      const proof = row.proofAttachment;
                      if (!proof) {
                        return;
                      }
                      runMutation(
                        {
                          label: "Expense proof",
                          showToast: toast,
                          successMessage: "Expense proof removed.",
                        },
                        () => removeExpenseProof({ attachmentId: proof.id })
                      ).catch(() => undefined);
                    }}
                    type="button"
                  >
                    Remove expense proof
                  </button>
                )}
                <DeleteButton
                  label={`${row.category} expense`}
                  onClick={() =>
                    deleteItem(`${row.category} expense`, removeExpense, {
                      expenseId: String(row.id),
                    })
                  }
                />
              </div>
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
