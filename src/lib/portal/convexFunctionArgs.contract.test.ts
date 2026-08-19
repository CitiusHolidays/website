import { describe, expect, test } from "bun:test";
import type { api, internal } from "@convex/_generated/api";
import type { FunctionArgs } from "convex/server";

type IsNever<Value> = [Value] extends [never] ? true : false;

const ARGUMENT_CONTRACTS: [
  IsNever<FunctionArgs<typeof api.crm.finance.updateExpense>["expenseId"]>,
  IsNever<FunctionArgs<typeof internal.crm.importActions.continuePassengerExport>["operationId"]>,
  IsNever<FunctionArgs<typeof internal.crm.imports.getPassengerExportSourcePage>["jobCardId"]>,
  IsNever<FunctionArgs<typeof api.crm.jobCards.createFromQuery>["confirmedPax"]>,
  IsNever<FunctionArgs<typeof api.crm.jobCards.createTravelBatch>["jobCardId"]>,
  IsNever<FunctionArgs<typeof api.crm.leave.create>["startDate"]>,
  IsNever<FunctionArgs<typeof api.crm.leave.decide>["leaveId"]>,
  IsNever<FunctionArgs<typeof api.crm.proposals.create>["queryIds"]>,
  IsNever<FunctionArgs<typeof api.crm.proposals.update>["proposalId"]>,
  IsNever<FunctionArgs<typeof api.crm.queries.applySalesDecision>["commandId"]>,
  IsNever<FunctionArgs<typeof api.crm.queries.updateContractingProgress>["queryId"]>,
] = [false, false, false, false, false, false, false, false, false, false, false];

describe("Convex function argument contracts", () => {
  test("keep validator-driven arguments instead of collapsing to EmptyObject", () => {
    expect(ARGUMENT_CONTRACTS.every((isNever) => !isNever)).toBe(true);
  });
});
