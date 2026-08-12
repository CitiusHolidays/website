import { describe, expect, test } from "bun:test";
import { ALL_ROLES, getRolePermissions } from "./lib/rolePolicy";
import {
  canAccessPassengerKinds,
  PASSENGER_KINDS,
  type PassengerKind,
  type PassengerKindCapability,
} from "./passengerKindPolicy";

const FULL_MANAGE_ROLES = [
  "Admin",
  "Directors",
  "Operations",
  "Operations Head",
  "Operations Cement",
  "Director Cement",
] as const;
const PASSENGER_MANAGE_ROLES = [...FULL_MANAGE_ROLES, "Ticketing", "Head of Ticketing"] as const;
const FULL_VIEW_ROLES = [...FULL_MANAGE_ROLES, "Tour Manager"] as const;
const PASSENGER_VIEW_ROLES = [...PASSENGER_MANAGE_ROLES, "Tour Manager"] as const;

const allowedRoles: Record<PassengerKindCapability, Record<PassengerKind, readonly string[]>> = {
  manage: {
    passenger: PASSENGER_MANAGE_ROLES,
    passport: FULL_MANAGE_ROLES,
    rooming: FULL_MANAGE_ROLES,
    traveller: FULL_MANAGE_ROLES,
    visa: FULL_MANAGE_ROLES,
  },
  view: {
    passenger: PASSENGER_VIEW_ROLES,
    passport: FULL_VIEW_ROLES,
    rooming: FULL_MANAGE_ROLES,
    traveller: FULL_VIEW_ROLES,
    visa: FULL_VIEW_ROLES,
  },
};

const surfaces = [
  { capability: "manage", name: "preview" },
  { capability: "manage", name: "commit" },
  { capability: "manage", name: "import-list" },
  { capability: "view", name: "export-start" },
  { capability: "view", name: "export-download" },
  { capability: "view", name: "export-list" },
] as const;

describe("passenger-family kind permissions", () => {
  test("preserves the role and kind matrix at every import/export boundary", () => {
    for (const surface of surfaces) {
      for (const role of ALL_ROLES) {
        const access = { permissions: getRolePermissions([role]) };
        for (const kind of PASSENGER_KINDS) {
          expect(
            canAccessPassengerKinds(access, [kind], surface.capability),
            `${surface.name}: ${role} -> ${kind}`
          ).toBe(allowedRoles[surface.capability][kind].includes(role));
        }
      }
    }
  });

  test("requires every selected kind and fails closed for unknown or empty sets", () => {
    const ticketing = { permissions: getRolePermissions(["Ticketing"]) };
    const operations = { permissions: getRolePermissions(["Operations"]) };

    expect(canAccessPassengerKinds(ticketing, ["passenger"], "manage")).toBe(true);
    expect(canAccessPassengerKinds(ticketing, ["passenger", "rooming"], "manage")).toBe(false);
    expect(canAccessPassengerKinds(operations, PASSENGER_KINDS, "manage")).toBe(true);
    expect(canAccessPassengerKinds(operations, ["passenger", "unknown"], "manage")).toBe(false);
    expect(canAccessPassengerKinds(operations, [], "view")).toBe(false);
  });
});
