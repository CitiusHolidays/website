import { describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { Id } from "../_generated/dataModel";
import {
  canEditContractingRecord,
  canEditOperationsRecord,
  canEditProposalRecord,
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  type PortalAccess,
} from "./lib";

function access(overrides: Partial<PortalAccess>): PortalAccess {
  return {
    allowed: true,
    email: "staff@citiusholidays.com",
    name: "Staff User",
    permissions: [],
    roles: ["Ticketing"],
    ...overrides,
  };
}

describe("Sales flow record visibility", () => {
  test("Ticketing SPOC sees assigned query", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const staffId = fromPartial<Id<"staffUsers">>("staff_ticketing");
    const viewer = access({
      permissions: ["view:queries", "view:proposals"],
      roles: ["Ticketing"],
      staffId,
    });
    const query = {
      queryCode: "Q-0001",
      queryType: "FIT",
      ticketingOwnerId: staffId,
      ticketingOwnerName: "Staff User",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(true);
  });

  test("Ticketing user does not see unassigned queries", () => {
    const viewer = access({
      permissions: ["view:queries", "view:proposals"],
      roles: ["Ticketing"],
      // SAFETY: This test controls the asserted value at the framework boundary below.
      staffId: fromPartial<Id<"staffUsers">>("staff_ticketing"),
    });
    const query = {
      queryCode: "Q-0002",
      queryType: "FIT",
      salesOwnerName: "Other Sales",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(false);
  });

  test("Head of ticketing sees department queries", () => {
    const viewer = access({
      permissions: ["view:queries", "view:proposals"],
      roles: ["Head of Ticketing"],
    });
    const query = {
      queryCode: "Q-0003",
      queryType: "FIT",
      salesOwnerName: "Other Sales",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(true);
  });

  test("Proposal visibility follows linked query assignment", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const staffId = fromPartial<Id<"staffUsers">>("staff_ticketing");
    const viewer = access({
      permissions: ["view:queries", "view:proposals"],
      roles: ["Ticketing"],
      staffId,
    });
    const linkedQuery = {
      queryCode: "Q-0004",
      queryType: "FIT",
      ticketingOwnerId: staffId,
      ticketingOwnerName: "Staff User",
    };
    const proposal = {
      preparedBy: "Contracting User",
      proposalCode: "P-0001",
    };

    expect(canSeeProposalRecord(viewer, proposal, linkedQuery)).toBe(true);
  });

  test("Ticketing SPOC can edit assigned proposal costing", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const staffId = fromPartial<Id<"staffUsers">>("staff_ticketing");
    const viewer = access({
      permissions: ["manage:proposals"],
      roles: ["Ticketing"],
      staffId,
    });
    const linkedQuery = {
      ticketingOwnerId: staffId,
      ticketingOwnerName: "Staff User",
    };
    const proposal = { preparedBy: "Contracting User" };

    expect(canEditProposalRecord(viewer, proposal, [linkedQuery])).toBe(true);
  });

  test("Accounts head sees department queries", () => {
    const viewer = access({
      permissions: ["view:queries"],
      roles: ["Accounts Head"],
    });
    const query = {
      queryCode: "Q-0005",
      queryType: "FIT",
      salesOwnerName: "Other Sales",
    };

    expect(canSeeQueryRecord(viewer, query)).toBe(true);
  });

  test("Stable assignment ids beat matching legacy names", () => {
    // SAFETY: This test controls the asserted values at the framework boundary below.
    const viewerStaffId = fromPartial<Id<"staffUsers">>("staff_alex_a");
    // SAFETY: This test controls the asserted values at the framework boundary below.
    const otherStaffId = fromPartial<Id<"staffUsers">>("staff_alex_b");
    const viewer = access({
      authUserId: "issuer-a|alex-a",
      name: "Alex Smith",
      permissions: ["view:queries", "view:proposals", "view:jobCards"],
      roles: ["Contracting"],
      staffId: viewerStaffId,
    });

    expect(
      canSeeQueryRecord(viewer, {
        contractingOwnerId: otherStaffId,
        contractingOwnerName: "Alex Smith",
      })
    ).toBe(false);
    expect(
      canSeeQueryRecord(viewer, {
        salesOwnerId: otherStaffId,
        salesOwnerName: "Alex Smith",
      })
    ).toBe(false);
    expect(
      canSeeQueryRecord(viewer, {
        salesOwnerId: "issuer-b|alex-a",
        salesOwnerName: "Alex Smith",
      })
    ).toBe(false);
    expect(
      canSeeProposalRecord(viewer, {
        preparedBy: "Alex Smith",
        preparedByStaffId: otherStaffId,
      })
    ).toBe(false);
    expect(
      canSeeJobCardRecord(viewer, {
        operationsOwnerId: otherStaffId,
        operationsOwnerName: "Alex Smith",
        tourManagerName: "Alex Smith",
        tourManagerStaffId: otherStaffId,
      })
    ).toBe(false);
    expect(
      canEditContractingRecord(viewer, {
        contractingOwnerId: otherStaffId,
        contractingOwnerName: "Alex Smith",
      })
    ).toBe(false);
    expect(
      canEditOperationsRecord(viewer, {
        operationsOwnerId: otherStaffId,
        operationsOwnerName: "Alex Smith",
      })
    ).toBe(false);
  });

  test("Retains name compatibility only for rows with no stable assignment", () => {
    const viewer = access({ name: "Legacy Owner", roles: ["Contracting"] });

    expect(canSeeQueryRecord(viewer, { contractingOwnerName: "Legacy Owner" })).toBe(true);
    expect(canSeeProposalRecord(viewer, { preparedBy: "Legacy Owner" })).toBe(true);
    expect(canSeeJobCardRecord(viewer, { tourManagerName: "Legacy Owner" })).toBe(true);
  });
});
