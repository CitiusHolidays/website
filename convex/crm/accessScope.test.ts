import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import {
  canEditProposalRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  type PortalAccess,
} from "./lib";

function access(overrides: Partial<PortalAccess>): PortalAccess {
  return {
    allowed: true,
    email: "staff@citiusholidays.com",
    name: "Staff User",
    roles: ["Ticketing"],
    permissions: [],
    ...overrides,
  };
}

describe("sales flow record visibility", () => {
  test("ticketing SPOC sees assigned query", () => {
    const staffId = "staff_ticketing" as Id<"staffUsers">;
    const viewer = access({
      staffId,
      roles: ["Ticketing"],
      permissions: ["view:queries", "view:proposals"],
    });
    const query = {
      queryCode: "Q-0001",
      queryType: "FIT",
      ticketingOwnerId: staffId,
      ticketingOwnerName: "Staff User",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(true);
  });

  test("ticketing user does not see unassigned queries", () => {
    const viewer = access({
      staffId: "staff_ticketing" as Id<"staffUsers">,
      roles: ["Ticketing"],
      permissions: ["view:queries", "view:proposals"],
    });
    const query = {
      queryCode: "Q-0002",
      queryType: "FIT",
      salesOwnerName: "Other Sales",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(false);
  });

  test("head of ticketing sees department queries", () => {
    const viewer = access({
      roles: ["Head of Ticketing"],
      permissions: ["view:queries", "view:proposals"],
    });
    const query = {
      queryCode: "Q-0003",
      queryType: "FIT",
      salesOwnerName: "Other Sales",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(true);
  });

  test("proposal visibility follows linked query assignment", () => {
    const staffId = "staff_ticketing" as Id<"staffUsers">;
    const viewer = access({
      staffId,
      roles: ["Ticketing"],
      permissions: ["view:queries", "view:proposals"],
    });
    const linkedQuery = {
      queryCode: "Q-0004",
      queryType: "FIT",
      ticketingOwnerId: staffId,
      ticketingOwnerName: "Staff User",
    };
    const proposal = {
      proposalCode: "P-0001",
      preparedBy: "Contracting User",
    };

    expect(canSeeProposalRecord(viewer, proposal, linkedQuery)).toBe(true);
  });

  test("ticketing SPOC can edit assigned proposal costing", () => {
    const staffId = "staff_ticketing" as Id<"staffUsers">;
    const viewer = access({
      staffId,
      roles: ["Ticketing"],
      permissions: ["manage:proposals"],
    });
    const linkedQuery = {
      ticketingOwnerId: staffId,
      ticketingOwnerName: "Staff User",
    };
    const proposal = { preparedBy: "Contracting User" };

    expect(canEditProposalRecord(viewer, proposal, [linkedQuery])).toBe(true);
  });

  test("accounts head sees department queries", () => {
    const viewer = access({
      roles: ["Accounts Head"],
      permissions: ["view:queries"],
    });
    const query = {
      queryCode: "Q-0005",
      queryType: "FIT",
      salesOwnerName: "Other Sales",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(true);
  });
});
