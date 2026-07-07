import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import {
  buildQueryStatusNotificationPlan,
  buildQueryStatusPatch,
  type QueryStatusArgs,
} from "./queries";

const baseCurrent = {
  contractingOwnerId: "staff_contracting",
  contractingStatus: "Proposal sent",
  leadStage: "Proposal",
  queryCode: "Q-0001",
  salesStatus: "Proposal in discussion",
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
      leadStage: "Proposal",
      reassignToTeams: false,
      salesStatus: "Proposal in discussion",
    });
    expect(patch({ salesStatus: "Date/Destination Change Required" })).toMatchObject({
      contractingStatus: "Proposal in progress",
      leadStage: "Negotiation",
      reassignToTeams: true,
      salesStatus: "Date/Destination Change Required",
    });
    expect(patch({ salesStatus: "Order Confirmed" })).toMatchObject({
      confirmedAt: 1000,
      contractingStatus: "Order Confirmed",
      leadStage: "Confirmation",
      reassignToTeams: false,
      salesStatus: "Order Confirmed",
    });
  });

  test("keeps Order Lost sales-only and requires a lost reason", () => {
    expect(() => patch({ salesStatus: "Order Lost" })).toThrow(
      new ConvexError("Select a lost reason.")
    );
    expect(() => patch({ contractingStatus: "Order Lost" })).toThrow(
      new ConvexError("Only Sales can mark an order as lost")
    );
    expect(patch({ lostReason: "Competition", salesStatus: "Order Lost" })).toMatchObject({
      contractingStatus: "Order Lost",
      leadStage: "Lost",
      lostReason: "Competition",
      lostReasonOther: "",
      reassignToTeams: false,
      salesStatus: "Order Lost",
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
        args: {
          queryId: "queries_1",
          salesStatus: "Date/Destination Change Required",
        },
        current: baseCurrent,
        isNewlyConfirmed: false,
        wasConfirmed: false,
      })
    ).toEqual({
      notifyJobCardCreators: false,
      notifyOrderConfirmedWorkflow: false,
      ownerNotifications: [
        {
          body: "Q-0001 was sent back by Sales for a date or destination change.",
          ownerId: "staff_contracting",
          title: "Revise proposal",
        },
        {
          body: "Q-0001 needs updated ticketing inputs for the revised proposal.",
          ownerId: "staff_ticketing",
          title: "Revise proposal costing",
        },
      ],
      roleNotifications: [],
    });
  });
});
