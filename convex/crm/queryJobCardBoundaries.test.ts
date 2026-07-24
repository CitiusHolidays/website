import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  isFinanceHeadStaff as focusedIsFinanceHeadStaff,
  queryRequiresTicketingWork as focusedQueryRequiresTicketingWork,
} from "./jobCardNotifications";
import * as jobCards from "./jobCards";
import {
  formatTravelBatchCode as facadeFormatTravelBatchCode,
  nextTravelBatchIdentity as facadeNextTravelBatchIdentity,
  parseTravelBatchSequence as facadeParseTravelBatchSequence,
  isFinanceHeadStaff,
  queryRequiresTicketingWork,
} from "./jobCards";
import * as queries from "./queries";
import {
  buildQueryStatusPatch as facadeBuildQueryStatusPatch,
  isJobCardCreatorNotificationTarget as facadeIsJobCardCreatorNotificationTarget,
  queryAssignmentHeadRoles as facadeQueryAssignmentHeadRoles,
  resolveSalesPipelineStage as facadeResolveSalesPipelineStage,
} from "./queries";
import { isJobCardCreatorNotificationTarget, queryAssignmentHeadRoles } from "./queryNotifications";
import { buildQueryStatusPatch } from "./queryStatusPolicy";
import { resolveSalesPipelineStage } from "./salesPipelinePolicy";
import {
  formatTravelBatchCode,
  nextTravelBatchIdentity,
  parseTravelBatchSequence,
} from "./travelBatchPolicy";

const QUERY_PUBLIC_EXPORTS = [
  "listPage",
  "getListRow",
  "create",
  "update",
  "assignContracting",
  "assignQueryTicketing",
  "assignQueryTeams",
  "assignJobCardCreator",
  "submitToContracting",
  "moveSalesPipelineStage",
  "updateStatus",
  "remove",
] as const;

const JOB_CARD_PUBLIC_EXPORTS = [
  "listPage",
  "getListRow",
  "listTravelBatches",
  "getCommandCenter",
  "createFromQuery",
  "update",
  "createTravelBatch",
  "updateTravelBatch",
  "updateChecklist",
  "updateChecklistTask",
  "createChecklistTask",
  "removeChecklistTask",
  "updateStatus",
  "addCollaborator",
  "removeCollaborator",
  "assignOperationsOwner",
  "assignContractingOwner",
  "remove",
] as const;

const FOCUSED_MODULE_PATHS = [
  "./queryValidators.ts",
  "./queryStatusPolicy.ts",
  "./salesPipelinePolicy.ts",
  "./salesPipelineCommands.ts",
  "./queryNotifications.ts",
  "./queryCreation.ts",
  "./queryReads.ts",
  "./queryCommands.ts",
  "./queryDeletion.ts",
  "./queryTeamAssignment.ts",
  "./jobCardConstants.ts",
  "./jobCardChecklist.ts",
  "./jobCardChecklistCommands.ts",
  "./jobCardCommandCenter.ts",
  "./jobCardCommands.ts",
  "./jobCardCreation.ts",
  "./jobCardNotifications.ts",
  "./jobCardReads.ts",
  "./jobCardTravelBatchCommands.ts",
  "./travelBatchPolicy.ts",
  "./jobCardDeletion.ts",
] as const;

describe("query/job card entry API parity", () => {
  test("queries entry re-exports every stable public Convex function", () => {
    for (const exportName of QUERY_PUBLIC_EXPORTS) {
      expect(queries).toHaveProperty(exportName);
      expect((queries as Record<string, unknown>)[exportName]).toBeDefined();
    }
  });

  test("jobCards entry re-exports every stable public Convex function", () => {
    for (const exportName of JOB_CARD_PUBLIC_EXPORTS) {
      expect(jobCards).toHaveProperty(exportName);
      expect((jobCards as Record<string, unknown>)[exportName]).toBeDefined();
    }
  });

  test("entry modules stay within the documented line budget", async () => {
    for (const path of ["./queries.ts", "./jobCards.ts"] as const) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      expect(source.split("\n").length).toBeLessThanOrEqual(500);
    }
  });

  test("focused domain modules stay under 500 lines each", async () => {
    for (const path of FOCUSED_MODULE_PATHS) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      expect(source.split("\n").length).toBeLessThanOrEqual(500);
    }
  });
});

describe("query/job card policy parity", () => {
  test("facade re-exports status policy helpers from focused modules", () => {
    expect(facadeBuildQueryStatusPatch).toBe(buildQueryStatusPatch);
    expect(facadeIsJobCardCreatorNotificationTarget).toBe(isJobCardCreatorNotificationTarget);
    expect(facadeQueryAssignmentHeadRoles).toBe(queryAssignmentHeadRoles);
    expect(facadeResolveSalesPipelineStage).toBe(resolveSalesPipelineStage);
  });

  test("facade re-exports travel batch and notification helpers from focused modules", () => {
    expect(facadeFormatTravelBatchCode).toBe(formatTravelBatchCode);
    expect(facadeParseTravelBatchSequence).toBe(parseTravelBatchSequence);
    expect(facadeNextTravelBatchIdentity).toBe(nextTravelBatchIdentity);
    expect(isFinanceHeadStaff).toBe(focusedIsFinanceHeadStaff);
    expect(queryRequiresTicketingWork).toBe(focusedQueryRequiresTicketingWork);
  });

  test("travel batch identity sequencing stays deterministic", () => {
    expect(formatTravelBatchCode(3)).toBe("B03");
    expect(parseTravelBatchSequence("B03")).toBe(3);
    expect(nextTravelBatchIdentity("JC-0001-NS", [{ batchCode: "B02" }])).toEqual({
      batchCode: "B03",
      batchReference: "JC-0001-NS / B03",
    });
  });

  test("Sales Decision patch behavior is unchanged through the facade", () => {
    const patch = facadeBuildQueryStatusPatch({
      args: { queryId: "queries_1", salesStatus: "Order Confirmed" },
      now: 42,
    });
    expect(patch).toMatchObject({
      confirmedAt: 42,
      contractingStatus: "Order Confirmed",
      leadStage: "Confirmation",
      salesStatus: "Order Confirmed",
    });
  });
});
