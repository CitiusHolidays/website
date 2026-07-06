import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import {
  buildQueryStatusNotificationPlan,
  buildQueryStatusPatch,
  type QueryStatusArgs,
} from "./queries";

const baseCurrent = {
  queryCode: "Q-0001",
  salesStatus: "Proposal in discussion",
  leadStage: "Proposal",
  contractingStatus: "Proposal sent",
  contractingOwnerId: "staff_contracting",
  ticketingOwnerId: "staff_ticketing",
};

function patch(args: QueryStatusArgs) {
  return buildQueryStatusPatch({
    args: { queryId: "queries_1", ...args },
    now: 1000,
  });
}

describe("query status transitions", () => {
  test("maps Sales Decision outcomes to canonical status transitions", () => {
    expect(patch({ salesStatus: "Proposal in discussion" })).toMatchObject({
      salesStatus: "Proposal in discussion",
      leadStage: "Proposal",
      reassignToTeams: false,
    });
    expect(patch({ salesStatus: "Date/Destination Change Required" })).toMatchObject({
      salesStatus: "Date/Destination Change Required",
      contractingStatus: "Proposal in progress",
      leadStage: "Negotiation",
      reassignToTeams: true,
    });
    expect(patch({ salesStatus: "Order Confirmed" })).toMatchObject({
      salesStatus: "Order Confirmed",
      contractingStatus: "Order Confirmed",
      leadStage: "Confirmation",
      confirmedAt: 1000,
      reassignToTeams: false,
    });
  });

  test("keeps Order Lost sales-only and requires a lost reason", () => {
    expect(() => patch({ salesStatus: "Order Lost" })).toThrow(
      new ConvexError("Select a lost reason."),
    );
    expect(() => patch({ contractingStatus: "Order Lost" })).toThrow(
      new ConvexError("Only Sales can mark an order as lost"),
    );
    expect(patch({ salesStatus: "Order Lost", lostReason: "Competition" })).toMatchObject({
      salesStatus: "Order Lost",
      contractingStatus: "Order Lost",
      leadStage: "Lost",
      lostReason: "Competition",
      lostReasonOther: "",
      reassignToTeams: false,
    });
  });

  test("Date/Destination Change Required returns assigned Contracting and Ticketing queues", () => {
    const result = patch({ salesStatus: "Date/Destination Change Required" });

    expect(result.contractingStatus).toBe("Proposal in progress");
    expect(result.leadStage).toBe("Negotiation");
    expect(result.salesStatus).toBe("Date/Destination Change Required");
    expect(result.reassignToTeams).toBe(true);
  });

  test("plans revision notifications for assigned SPOCs only", () => {
    expect(
      buildQueryStatusNotificationPlan({
        current: baseCurrent,
        args: {
          queryId: "queries_1",
          salesStatus: "Date/Destination Change Required",
        },
        wasConfirmed: false,
        isNewlyConfirmed: false,
      }),
    ).toEqual({
      notifyJobCardCreators: false,
      notifyOrderConfirmedWorkflow: false,
      roleNotifications: [],
      ownerNotifications: [
        {
          ownerId: "staff_contracting",
          title: "Revise proposal",
          body: "Q-0001 was sent back by Sales for a date or destination change.",
        },
        {
          ownerId: "staff_ticketing",
          title: "Revise proposal costing",
          body: "Q-0001 needs updated ticketing inputs for the revised proposal.",
        },
      ],
    });
  });
});
