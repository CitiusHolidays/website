import { PERMISSIONS } from "./lib/rolePolicy";

export const PASSENGER_KINDS = ["passenger", "traveller", "rooming", "passport", "visa"] as const;

export type PassengerKind = (typeof PASSENGER_KINDS)[number];
export type PassengerKindCapability = "manage" | "view";

interface PermissionAccess {
  permissions?: readonly string[];
}

type PassengerKindPermissionPolicy = Record<
  PassengerKind,
  Record<PassengerKindCapability, readonly (readonly string[])[]>
>;

const PASSENGER_KIND_PERMISSION_POLICY: PassengerKindPermissionPolicy = {
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
};

export function isPassengerKind(value: unknown): value is PassengerKind {
  return typeof value === "string" && (PASSENGER_KINDS as readonly string[]).includes(value);
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
  const permissions = new Set(access.permissions);
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
