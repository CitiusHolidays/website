import type { Key } from "react";
import { formatPassportExpiryLabel, getPassportExpiryInfo } from "@/lib/portal/passportExpiry";
import type { PortalGridAttention } from "@/lib/portal/portalDataGrid";
import type { PortalJobCardOption } from "./portalViewTypes";

export const HOTEL_ROOMING_TABS = [
  { id: "hotels", label: "Hotels" },
  { id: "rooming", label: "Rooming" },
  { id: "room-count", label: "Room Count" },
] as const;

export const ROOM_TYPE_CAPACITY: Record<string, number> = {
  "Child with Bed": 1,
  Double: 2,
  "Family Room": 4,
  Single: 1,
  Triple: 3,
  Twin: 2,
};

export interface TravelBatchLabelRow {
  travelBatchCode?: string;
  travelBatchReference?: string;
}

export interface PassportExpiryRow extends TravelBatchLabelRow {
  passportExpiryDate?: string;
  travelDate?: string;
  travelStartDate?: string;
}

const PASSPORT_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  webp: "image/webp",
};

export function travelBatchDisplayLabel(row: TravelBatchLabelRow | null | undefined) {
  return row?.travelBatchReference || row?.travelBatchCode || "-";
}

export function jobCardFilterOptions(jobCards: PortalJobCardOption[] | undefined) {
  return [
    { label: "All job cards", value: "" },
    ...(jobCards || []).map((job) => ({
      label: job.jobCode,
      value: String(job.id),
    })),
  ];
}

export function passportRowAttention(row: PassportExpiryRow): PortalGridAttention | undefined {
  const info = getPassportExpiryInfo({
    expiryDate: row.passportExpiryDate,
    travelDate: row.travelStartDate || row.travelDate,
  });
  const { level } = info;
  if (level === "expired" || level === "critical") {
    return { label: formatPassportExpiryLabel(info), tone: "danger" };
  }
  return level === "warning"
    ? { label: formatPassportExpiryLabel(info), tone: "warning" }
    : undefined;
}

export function inferPassportMimeType(file: File) {
  if (file.type?.trim()) {
    return file.type.trim().toLowerCase();
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return PASSPORT_MIME_TYPES_BY_EXTENSION[extension] ?? "";
}

export function estimateRoomCount(roomType: string, assignments: number) {
  const capacity = ROOM_TYPE_CAPACITY[roomType] ?? 1;
  return Math.ceil(assignments / capacity);
}

export function normalizeTravelBatchId(travelBatchId: string | undefined | null) {
  return travelBatchId || "";
}

export function tourManagerAssignmentKey(jobCardId: Key, travelBatchId: string | undefined | null) {
  return `${String(jobCardId)}:${normalizeTravelBatchId(travelBatchId)}`;
}

export function buildTourManagersByJobAndBatch(
  assignments: Array<{ jobCardId?: Key; name: string; travelBatchId?: string }> | undefined
) {
  const byKey = new Map<string, string[]>();
  for (const manager of assignments || []) {
    if (!manager.jobCardId) {
      continue;
    }
    const key = tourManagerAssignmentKey(manager.jobCardId, manager.travelBatchId);
    const current = byKey.get(key) || [];
    current.push(manager.name);
    byKey.set(key, current);
  }
  return byKey;
}

export function getAssignedTourManagerNames(
  row: { jobCardId?: Key; travelBatchId?: string },
  byKey: Map<string, string[]>
) {
  if (!row.jobCardId) {
    return "Unassigned";
  }
  const batchNames = byKey.get(tourManagerAssignmentKey(row.jobCardId, row.travelBatchId));
  if (batchNames?.length) {
    return batchNames.join(", ");
  }
  const fallbackNames = byKey.get(tourManagerAssignmentKey(row.jobCardId, ""));
  if (fallbackNames?.length) {
    return fallbackNames.join(", ");
  }
  return "Unassigned";
}
