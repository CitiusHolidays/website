import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { toNumber } from "@/lib/portal/formUtils";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";

export function createAdministrationModalCommands(deps) {
  return {
    approvalDecide: async (form) =>
      await deps.decideApproval({
        approvalId: form.approvalId,
        decisionNote: form.decisionNote,
        status: form.approvalStatus,
      }),
    expense: async (form) => {
      const payload = {
        amount: getExpenseSplitTotal({
          cardAmount: form.cardAmount,
          cashAmount: form.cashAmount,
          epayAmount: form.epayAmount,
        }),
        cardAmount: toNumber(form.cardAmount, 0),
        cashAmount: toNumber(form.cashAmount, 0),
        category: form.category,
        currency: form.currency,
        epayAmount: toNumber(form.epayAmount, 0),
        expenseDate: form.expenseDate,
        notes: form.notes,
        paidBy: form.paidBy,
        particulars: form.particulars,
        tourManagerName: form.tourManagerName,
      };
      const result = form.entityId
        ? await deps.updateExpense({ expenseId: form.entityId, ...payload })
        : await deps.createExpense({
            ...payload,
            jobCardId: form.expenseType === "jobCard" ? form.jobCardId : undefined,
          });
      const expenseId = form.entityId || result?.id;
      if (expenseId && deps.pendingExpenseProofFiles.length > 0) {
        await deps.uploadExpenseProofFiles({
          attachExpenseProof: deps.attachExpenseProof,
          expenseId,
          files: deps.pendingExpenseProofFiles.slice(0, 1),
          generateUploadUrl: deps.generateExpenseUploadUrl,
        });
      }
    },
    invoice: async (form) => {
      const payload = {
        dueDate: form.dueDate,
        expectedAmount: toNumber(form.expectedAmount, 0),
        invoiceNumber: form.invoiceNumber,
        receivedAmount: toNumber(form.receivedAmount, 0),
      };
      if (form.entityId) {
        await deps.updateInvoice({ invoiceId: form.entityId, ...payload });
      } else {
        await deps.createInvoice({ jobCardId: form.jobCardId, ...payload });
      }
    },
    leave_create: async (form) => {
      const payload = {
        endDate: form.endDate,
        leaveType: form.leaveType,
        reason: form.reason,
        startDate: form.startDate,
      };
      if (form.entityId) {
        await deps.updateLeave({ leaveId: form.entityId, ...payload });
      } else if (deps.has(P.MANAGE_LEAVE)) {
        await deps.createLeave({
          staffId: form.staffId,
          ...payload,
          status: form.status || "Pending",
        });
      } else {
        await deps.createLeave(payload);
      }
    },
    staff: async (form) => {
      const result = await deps.upsertStaff({
        active: Boolean(form.staffActive),
        confirmationDate: form.confirmationDate,
        department: form.department,
        email: form.staffEmail,
        emailAlertRoles: form.emailAlertRoles || [],
        employmentStatus: form.employmentStatus,
        function: form.staffFunction,
        joiningDate: form.joiningDate,
        leaveHeadApproverId: form.leaveHeadApproverId || undefined,
        leavePolicyGroup: form.leavePolicyGroup,
        location: form.location,
        marriageLeaveUsed: Boolean(form.marriageLeaveUsed),
        maternityEventsUsed: toNumber(form.maternityEventsUsed, 0),
        mobile: form.mobile,
        name: form.staffName,
        paternityEventsUsed: toNumber(form.paternityEventsUsed, 0),
        reportingManagerName: form.reportingManagerName || undefined,
        reportingManagerStaffId: form.reportingManagerStaffId || undefined,
        roles: form.staffRoles,
        staffId: form.staffId || undefined,
      });
      return result?.created
        ? `Staff added. A verification email was sent to ${form.staffEmail}. They must verify their email before receiving a password setup link.`
        : undefined;
    },
  };
}
