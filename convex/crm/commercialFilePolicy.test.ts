import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { RuntimeObject } from "../lib/runtimeValues";
import {
  COMMERCIAL_FILE_RETENTION_MS,
  canManageCommercialSource,
  defaultTeamAreaForSource,
  writableTeamAreasForSource,
} from "./commercialFilePolicy";

const permissions = {
  manageJobCards: "manage:jobCards",
  manageOperations: "manage:operations",
  manageProposals: "manage:proposals",
  manageQueries: "manage:queries",
  manageTicketing: "manage:ticketing",
};

function access(overrides: RuntimeObject = {}) {
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return fromAny<never, unknown>({
    allowed: true,
    email: "person@example.com",
    name: "Person",
    permissions: [],
    roles: [],
    ...overrides,
  });
}

describe("Commercial file policy", () => {
  test("Keeps Query files owned by Sales", () => {
    const source = {
      query: { createdBy: "auth-sales", salesOwnerId: "auth-sales" },
      sourceType: "query" as const,
    };
    expect(
      writableTeamAreasForSource(
        access({
          authUserId: "auth-sales",
          permissions: [permissions.manageQueries],
          roles: ["Sales"],
        }),
        source
      )
    ).toEqual(["sales"]);
    expect(
      canManageCommercialSource(
        access({ permissions: [permissions.manageProposals], roles: ["Contracting"] }),
        source,
        "sales"
      )
    ).toBe(false);
  });

  test("Lets assigned Ticketing users manage Proposal files without granting Sales write access", () => {
    const source = {
      linkedQueries: [{ ticketingOwnerId: "staff-ticketing" }],
      proposal: { preparedBy: "Contracting" },
      sourceType: "proposal" as const,
    };
    expect(
      writableTeamAreasForSource(
        access({
          permissions: [permissions.manageTicketing],
          roles: ["Ticketing"],
          staffId: "staff-ticketing",
        }),
        source
      )
    ).toEqual(["ticketing"]);
    expect(
      writableTeamAreasForSource(
        access({
          permissions: [permissions.manageTicketing],
          roles: ["Ticketing"],
          staffId: "staff-other",
        }),
        source
      )
    ).toEqual([]);
    expect(
      writableTeamAreasForSource(
        access({ permissions: ["send:proposals"], roles: ["Sales"] }),
        source
      )
    ).toEqual([]);
  });

  test("Exposes separate Job Card Team Areas by current team role", () => {
    const source = {
      jobCard: {
        operationsOwnerId: "staff-ops",
        ticketingOwnerId: "staff-ticketing",
        tourManagerName: "Tour Manager",
      },
      linkedQuery: null,
      sourceType: "jobCard" as const,
    };
    expect(
      writableTeamAreasForSource(
        access({ permissions: [permissions.manageJobCards], roles: ["Accounts"] }),
        source
      )
    ).toEqual(["accounts"]);
    expect(
      writableTeamAreasForSource(
        access({
          permissions: [permissions.manageOperations],
          roles: ["Operations"],
          staffId: "staff-ops",
        }),
        source
      )
    ).toEqual(["operations"]);
    expect(
      writableTeamAreasForSource(
        access({
          permissions: [permissions.manageTicketing],
          roles: ["Ticketing"],
          staffId: "staff-ticketing",
        }),
        source
      )
    ).toEqual(["ticketing"]);
    expect(
      writableTeamAreasForSource(access({ name: "Tour Manager", roles: ["Tour Manager"] }), source)
    ).toEqual(["tourManager"]);
    expect(
      writableTeamAreasForSource(
        access({
          permissions: [permissions.manageOperations],
          roles: ["Operations"],
          staffId: "staff-other",
        }),
        source
      )
    ).toEqual([]);
    expect(defaultTeamAreaForSource("jobCard")).toBe("operations");
  });

  test("Uses the approved fourteen-day recovery window", () => {
    expect(COMMERCIAL_FILE_RETENTION_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });

  test("Rejects matching file-area names when a different stable owner is present", () => {
    const source = {
      jobCard: {
        ticketingOwnerId: "staff-other-ticketing",
        ticketingOwnerName: "Shared Name",
        tourManagerName: "Shared Name",
        tourManagerStaffId: "staff-other-tour-manager",
      },
      linkedQuery: null,
      sourceType: "jobCard" as const,
    };

    expect(
      writableTeamAreasForSource(
        access({
          name: "Shared Name",
          permissions: [permissions.manageTicketing],
          roles: ["Ticketing"],
          staffId: "staff-viewer",
        }),
        source
      )
    ).toEqual([]);
    expect(
      writableTeamAreasForSource(
        access({ name: "Shared Name", roles: ["Tour Manager"], staffId: "staff-viewer" }),
        source
      )
    ).toEqual([]);
  });
});
