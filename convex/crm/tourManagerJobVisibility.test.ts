import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { Id } from "../_generated/dataModel";
import { writableTeamAreasForSource } from "./commercialFilePolicy";
import { assignedTourManagerStaffIdsFrom, sameTourManagerStaffIds } from "./jobCardVisibility";
import { canSeeJobCardRecord } from "./lib/recordScope";
import { getRolePermissions } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";

const staffId = (value: string) => fromAny<Id<"staffUsers">, string>(value);

function tourManagerAccess(id: string, name: string): PortalAccess {
  return {
    allowed: true,
    authUserId: `auth_${id}`,
    email: `${id}@example.test`,
    name,
    permissions: getRolePermissions(["Tour Manager"]),
    roles: ["Tour Manager"],
    staffId: staffId(id),
  };
}

const first = tourManagerAccess("staff_tm_first", "Asha Rao");
const second = tourManagerAccess("staff_tm_second", "Vikram Singh");

// A multi-batch Job Card: two staff Tour Managers are assigned, and the latest
// assignment overwrote the single denormalised tourManagerName.
const multiBatchJob = {
  assignedTourManagerStaffIds: [staffId("staff_tm_first"), staffId("staff_tm_second")],
  createdBy: "auth_accounts",
  queryType: "MICE",
  tourManagerName: "Vikram Singh",
};

describe("Tour Manager Job Card scope", () => {
  test("an earlier-assigned Tour Manager keeps scope after a later assignment overwrites the name", () => {
    expect(canSeeJobCardRecord(first, multiBatchJob)).toBe(true);
    expect(canSeeJobCardRecord(second, multiBatchJob)).toBe(true);
  });

  test("an assigned Tour Manager needs no display-name match", () => {
    expect(
      canSeeJobCardRecord(first, {
        ...multiBatchJob,
        tourManagerName: "Someone Else Entirely",
      })
    ).toBe(true);
  });

  test("a Tour Manager outside the assigned set and the name is denied", () => {
    const outsider = tourManagerAccess("staff_tm_outsider", "Meera Iyer");
    expect(canSeeJobCardRecord(outsider, multiBatchJob)).toBe(false);
  });

  test("unassigning removes the grant", () => {
    const afterUnassign = {
      ...multiBatchJob,
      assignedTourManagerStaffIds: [staffId("staff_tm_second")],
    };
    expect(canSeeJobCardRecord(first, afterUnassign)).toBe(false);
    expect(canSeeJobCardRecord(second, afterUnassign)).toBe(true);
  });

  test("an actor without a staff identity never matches the assigned set", () => {
    const bootstrapLike: PortalAccess = { ...first, staffId: undefined };
    expect(canSeeJobCardRecord(bootstrapLike, { ...multiBatchJob, tourManagerName: "" })).toBe(
      false
    );
  });

  test("a staff member without the Tour Manager role gets no grant through the assigned set", () => {
    const formerTourManager: PortalAccess = {
      ...first,
      permissions: getRolePermissions(["Operations"]),
      roles: ["Operations"],
    };
    expect(canSeeJobCardRecord(formerTourManager, multiBatchJob)).toBe(false);
  });

  test("the legacy name fallback still grants a Job Card that has not been backfilled", () => {
    const legacyJob = {
      createdBy: "auth_accounts",
      queryType: "MICE",
      tourManagerName: "asha rao",
    };
    expect(canSeeJobCardRecord(first, legacyJob)).toBe(true);
    expect(canSeeJobCardRecord(second, legacyJob)).toBe(false);
  });

  test("Cement scope still applies before the Tour Manager grant", () => {
    const cementTourManager: PortalAccess = {
      ...first,
      roles: ["Tour Manager", "Operations Cement"],
    };
    expect(canSeeJobCardRecord(cementTourManager, multiBatchJob)).toBe(false);
    expect(canSeeJobCardRecord(cementTourManager, { ...multiBatchJob, queryType: "Cement" })).toBe(
      true
    );
  });

  test("the Tour Manager file area follows the same assignment rule", () => {
    const source = (jobCard: Partial<typeof multiBatchJob>) =>
      fromAny<Parameters<typeof writableTeamAreasForSource>[1], unknown>({
        jobCard,
        linkedQuery: null,
        sourceType: "jobCard",
      });
    expect(writableTeamAreasForSource(first, source(multiBatchJob))).toContain("tourManager");
    expect(
      writableTeamAreasForSource(
        first,
        source({ ...multiBatchJob, assignedTourManagerStaffIds: [staffId("staff_tm_second")] })
      )
    ).not.toContain("tourManager");
  });
});

describe("Assigned Tour Manager staff set derivation", () => {
  test("keeps only active staff assignments, deduplicated and sorted", () => {
    expect(
      assignedTourManagerStaffIdsFrom([
        { staffId: staffId("staff_b"), status: "Assigned" },
        { staffId: staffId("staff_a"), status: "Assigned" },
        { staffId: staffId("staff_b"), status: "Assigned" },
        { staffId: staffId("staff_inactive"), status: "Inactive" },
        { staffId: staffId("staff_available"), status: "Available" },
        { staffId: undefined, status: "Assigned" },
      ])
    ).toEqual([staffId("staff_a"), staffId("staff_b")]);
  });

  test("compares stored and derived sets regardless of order, treating missing as empty", () => {
    expect(sameTourManagerStaffIds(undefined, [])).toBe(true);
    expect(
      sameTourManagerStaffIds(
        [staffId("staff_b"), staffId("staff_a")],
        [staffId("staff_a"), staffId("staff_b")]
      )
    ).toBe(true);
    expect(sameTourManagerStaffIds(undefined, [staffId("staff_a")])).toBe(false);
    expect(sameTourManagerStaffIds([staffId("staff_a")], [])).toBe(false);
  });
});
