# Expense lifecycle normalization

The Finance API now rejects approval and reimbursement combinations outside the checked-in
matrix in `convex/crm/expenseLifecycle.ts`. Existing rows must be reviewed before repair because
expense records are audit evidence.

1. Identify the exact Convex deployment and take a backup.
2. Run `crm/expenseLifecycleMigration:repairExpenseLifecycle` with `dryRun: true` and no cursor.
3. Record `scanned`, `inconsistent`, `continueCursor`, deployment, operator, and timestamp in the
   release evidence. Continue with the returned cursor until `isDone` is true.
4. Review the inconsistent count with Finance. The deterministic repair maps Pending/Reimbursed
   to Pending/Pending, Approved/Not Submitted to Approved/Pending, and every Rejected row to
   Rejected/Not Submitted.
5. After approval, repeat each page with `dryRun: false`, preserving the returned cursor between
   calls. Do not run this step concurrently.
6. Repeat the dry run from the first page and require zero inconsistent rows. Run the focused
   Expense tests and record the result. Production execution remains a separate authorized action.

The migration never deletes an Expense or Approval Request and never rewrites amounts, proofs,
reviewers, or timestamps other than the repaired row's `updatedAt`.
