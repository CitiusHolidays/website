const ROOM_TYPE_LABELS = [
  "Single",
  "Twin",
  "Double",
  "Triple",
  "Child with Bed",
  "Family Room",
] as const;

export type RoomTypeLabel = (typeof ROOM_TYPE_LABELS)[number];

const LEGACY_ROOM_TYPE_MAP: Record<string, RoomTypeLabel> = {
  SGL: "Single",
  TPL: "Triple",
  DBL: "Double",
  SINGLE: "Single",
  DOUBLE: "Double",
  TRIPLE: "Triple",
};

const LEGACY_ROOM_CODES = ["SGL", "TPL", "DBL"] as const;

export function isLegacyRoomCode(value: unknown): boolean {
  return typeof value === "string" && (LEGACY_ROOM_CODES as readonly string[]).includes(value);
}

function isRoomTypeLabel(value: unknown): value is RoomTypeLabel {
  return typeof value === "string" && (ROOM_TYPE_LABELS as readonly string[]).includes(value);
}

/** Map legacy codes / room labels to a schema-safe room type, or undefined. */
export function resolveRoomCategory(value: unknown): RoomTypeLabel | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();
  const legacy = LEGACY_ROOM_TYPE_MAP[trimmed] ?? LEGACY_ROOM_TYPE_MAP[trimmed.toUpperCase()];
  if (legacy) return legacy;
  if (isRoomTypeLabel(trimmed)) return trimmed;
  return undefined;
}

/** @deprecated Use resolveRoomCategory for roomType fields. */
export function normalizeLegacyRoomType(value: unknown): RoomTypeLabel | string | undefined {
  const category = resolveRoomCategory(value);
  if (category) return category;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
}

function normalizeHotelAllocationValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return "";
  const asCategory = resolveRoomCategory(trimmed);
  return asCategory ?? trimmed;
}

export function resolveTravellerRoomFields(
  roomType: unknown,
  hotelAllocation: unknown,
): {
  roomType: RoomTypeLabel | undefined;
  hotelAllocation: string | undefined;
} {
  const allocationCategory = resolveRoomCategory(hotelAllocation);
  const roomTypeCategory = resolveRoomCategory(roomType);
  const normalizedAllocation = normalizeHotelAllocationValue(hotelAllocation);

  let nextRoomType = roomTypeCategory;
  if (allocationCategory && nextRoomType !== allocationCategory) {
    nextRoomType = allocationCategory;
  }

  return {
    roomType: nextRoomType,
    hotelAllocation: normalizedAllocation,
  };
}

export function resolveRoomingEntryRoomType(roomType: unknown): RoomTypeLabel | undefined {
  return resolveRoomCategory(roomType);
}
