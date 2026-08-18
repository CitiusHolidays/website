import type { RuntimeValue } from "./runtimeValues";
import { hasOwnKey, isRuntimeString } from "./runtimeValues";

const ROOM_TYPE_LABELS = [
  "Single",
  "Twin",
  "Double",
  "Triple",
  "Child with Bed",
  "Family Room",
] as const;

export type RoomTypeLabel = (typeof ROOM_TYPE_LABELS)[number];

export interface TravellerRoomFields {
  hotelAllocation: string | undefined;
  roomType: RoomTypeLabel | undefined;
}

const LEGACY_ROOM_TYPE_MAP = {
  DBL: "Double",
  DOUBLE: "Double",
  SGL: "Single",
  SINGLE: "Single",
  TPL: "Triple",
  TRIPLE: "Triple",
} satisfies Record<string, RoomTypeLabel>;

const LEGACY_ROOM_CODES = ["SGL", "TPL", "DBL"] as const;

export function isLegacyRoomCode(value: RuntimeValue): boolean {
  return isRuntimeString(value) && LEGACY_ROOM_CODES.some((code) => code === value);
}

function isRoomTypeLabel(value: RuntimeValue): value is RoomTypeLabel {
  return isRuntimeString(value) && ROOM_TYPE_LABELS.some((label) => label === value);
}

/** Map legacy codes / room labels to a schema-safe room type, or undefined. */
export function resolveRoomCategory(value: RuntimeValue): RoomTypeLabel | undefined {
  if (!(isRuntimeString(value) && value.trim())) {
    return;
  }
  const trimmed = value.trim();
  const uppercase = trimmed.toUpperCase();
  const legacy = hasOwnKey(LEGACY_ROOM_TYPE_MAP, trimmed)
    ? LEGACY_ROOM_TYPE_MAP[trimmed]
    : hasOwnKey(LEGACY_ROOM_TYPE_MAP, uppercase)
      ? LEGACY_ROOM_TYPE_MAP[uppercase]
      : undefined;
  if (legacy) {
    return legacy;
  }
  if (isRoomTypeLabel(trimmed)) {
    return trimmed;
  }
}

/** @deprecated Use resolveRoomCategory for roomType fields. */
export function normalizeLegacyRoomType(value: RuntimeValue): RoomTypeLabel | string | undefined {
  const category = resolveRoomCategory(value);
  if (category) {
    return category;
  }
  if (isRuntimeString(value)) {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
}

function normalizeHotelAllocationValue(value: RuntimeValue): string | undefined {
  if (value === undefined || value === null) {
    return;
  }
  if (!isRuntimeString(value)) {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const asCategory = resolveRoomCategory(trimmed);
  return asCategory ?? trimmed;
}

export function resolveTravellerRoomFields(
  roomType: RuntimeValue,
  hotelAllocation: RuntimeValue
): TravellerRoomFields {
  const allocationCategory = resolveRoomCategory(hotelAllocation);
  const roomTypeCategory = resolveRoomCategory(roomType);
  const normalizedAllocation = normalizeHotelAllocationValue(hotelAllocation);

  let nextRoomType = roomTypeCategory;
  if (allocationCategory && nextRoomType !== allocationCategory) {
    nextRoomType = allocationCategory;
  }

  return {
    hotelAllocation: normalizedAllocation,
    roomType: nextRoomType,
  };
}

export function resolveRoomingEntryRoomType(roomType: RuntimeValue): RoomTypeLabel | undefined {
  return resolveRoomCategory(roomType);
}
