import { isRuntimeString } from "../lib/runtimeValues";
import { getRolePermissions, PERMISSIONS } from "./lib/rolePolicy";

export const PASSENGER_KINDS = ["passenger", "traveller", "rooming", "passport", "visa"] as const;

export type PassengerKind = (typeof PASSENGER_KINDS)[number];
export type PassengerKindCapability = "manage" | "view";

interface PermissionAccess {
  permissions?: readonly string[];
  roles?: readonly string[];
}

/**
 * Spreadsheet imports and exports are office workflows: passenger, traveller, passport and visa
 * exports carry contact numbers and decrypted passport details. Permissions that come only from
 * the Tour Manager role never count here (owner decision, 6 Nov 2026). When roles are known, the
 * effective set is the caller's permissions held through some other role.
 */
function officePermissions(access: PermissionAccess) {
  const permissions = new Set(access.permissions);
  if (!access.roles) {
    return permissions;
  }
  const office = new Set(
    getRolePermissions(access.roles.filter((role) => role !== "Tour Manager"))
  );
  return new Set([...permissions].filter((permission) => office.has(permission)));
}

type PassengerKindPermissionPolicy = Record<
  PassengerKind,
  Record<PassengerKindCapability, readonly (readonly string[])[]>
>;

const PASSENGER_KIND_PERMISSION_POLICY = {
  passenger: {
    manage: [
      [PERMISSIONS.MANAGE_TICKETING],
      [PERMISSIONS.MANAGE_TRAVELLERS, PERMISSIONS.MANAGE_VISA],
    ],
    view: [[PERMISSIONS.VIEW_TICKETING], [PERMISSIONS.VIEW_TRAVELLERS, PERMISSIONS.VIEW_VISA]],
  },
  passport: {
    manage: [[PERMISSIONS.MANAGE_VISA]],
    view: [[PERMISSIONS.VIEW_VISA]],
  },
  rooming: {
    manage: [[PERMISSIONS.MANAGE_OPERATIONS]],
    view: [[PERMISSIONS.VIEW_OPERATIONS]],
  },
  traveller: {
    manage: [[PERMISSIONS.MANAGE_TRAVELLERS, PERMISSIONS.MANAGE_VISA]],
    view: [[PERMISSIONS.VIEW_TRAVELLERS, PERMISSIONS.VIEW_VISA]],
  },
  visa: {
    manage: [[PERMISSIONS.MANAGE_VISA]],
    view: [[PERMISSIONS.VIEW_VISA]],
  },
} satisfies PassengerKindPermissionPolicy;

export function isPassengerKind<Value>(value: Value): value is Value & PassengerKind {
  return isRuntimeString(value) && PASSENGER_KINDS.some((kind) => kind === value);
}

/**
 * Requires every requested kind to satisfy at least one complete permission alternative.
 * Empty and unknown kind sets fail closed at this server-only authorization boundary.
 */
export function canAccessPassengerKinds(
  access: PermissionAccess | null | undefined,
  kinds: readonly unknown[],
  capability: PassengerKindCapability
): boolean {
  if (!access?.permissions || kinds.length === 0) {
    return false;
  }
  const permissions = officePermissions(access);
  return kinds.every((kind) => {
    if (!isPassengerKind(kind)) {
      return false;
    }
    return PASSENGER_KIND_PERMISSION_POLICY[kind][capability].some((alternative) =>
      alternative.every((permission) => permissions.has(permission))
    );
  });
}

export function canManagePassengerKinds(
  access: PermissionAccess | null | undefined,
  kinds: readonly unknown[]
): boolean {
  return canAccessPassengerKinds(access, kinds, "manage");
}

export function canViewPassengerKinds(
  access: PermissionAccess | null | undefined,
  kinds: readonly unknown[]
): boolean {
  return canAccessPassengerKinds(access, kinds, "view");
}
