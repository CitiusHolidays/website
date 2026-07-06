import { describe, expect, test } from "bun:test";
import {
  ALL_ROLES,
  CONTRACTING_TEAM_ROLES,
  DIRECTOR_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS as SERVER_ROLE_PERMISSIONS,
  SALES_REP_ROLES,
  TEAM_PICKER_PERMISSIONS,
  TICKETING_TEAM_ROLES,
} from "../../../convex/crm/lib.ts";
import {
  CONTRACTING_TEAM_ROLES as CLIENT_CONTRACTING_TEAM_ROLES,
  DIRECTOR_PERMISSIONS as CLIENT_DIRECTOR_PERMISSIONS,
  PORTAL_PERMISSIONS,
  PORTAL_ROLES,
  ROLE_PERMISSIONS as CLIENT_ROLE_PERMISSIONS,
  SALES_REP_ROLES as CLIENT_SALES_REP_ROLES,
  TEAM_PICKER_PERMISSIONS as CLIENT_TEAM_PICKER_PERMISSIONS,
  TICKETING_TEAM_ROLES as CLIENT_TICKETING_TEAM_ROLES,
} from "./constants.js";

function sortedRecord(record) {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([role, permissions]) => [role, [...permissions].sort()]),
  );
}

describe("portal role permission parity", () => {
  test("client PORTAL_PERMISSIONS matches server PERMISSIONS", () => {
    expect(PORTAL_PERMISSIONS).toEqual(PERMISSIONS);
  });

  test("client PORTAL_ROLES matches server ALL_ROLES", () => {
    expect([...PORTAL_ROLES].sort()).toEqual([...ALL_ROLES].sort());
  });

  test("client ROLE_PERMISSIONS matches server ROLE_PERMISSIONS", () => {
    expect(sortedRecord(CLIENT_ROLE_PERMISSIONS)).toEqual(sortedRecord(SERVER_ROLE_PERMISSIONS));
  });

  test("director and team-picker constants match between client and server", () => {
    expect([...CLIENT_DIRECTOR_PERMISSIONS].sort()).toEqual([...DIRECTOR_PERMISSIONS].sort());
    expect([...CLIENT_TEAM_PICKER_PERMISSIONS].sort()).toEqual([...TEAM_PICKER_PERMISSIONS].sort());
    expect([...CLIENT_CONTRACTING_TEAM_ROLES]).toEqual([...CONTRACTING_TEAM_ROLES]);
    expect([...CLIENT_TICKETING_TEAM_ROLES]).toEqual([...TICKETING_TEAM_ROLES]);
    expect([...CLIENT_SALES_REP_ROLES]).toEqual([...SALES_REP_ROLES]);
  });
});
