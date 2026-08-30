import { PORTAL_PERMISSIONS as P } from "./constants";

export type RecoverySource =
  | "passenger_import"
  | "passenger_export"
  | "job_card_deletion"
  | "notification_email"
  | "workflow_nudge";

export interface RecoverySourceConfig {
  description: string;
  id: RecoverySource;
  label: string;
}

export const RECOVERY_SOURCE_CONFIGS = [
  {
    description: "Partial or stalled spreadsheet imports that need the original workbook.",
    id: "passenger_import",
    label: "My imports",
  },
  {
    description: "Failed or stalled exports that can replay the same persisted command.",
    id: "passenger_export",
    label: "My exports",
  },
  {
    description: "Failed or stalled Job Card cleanup owned by an authorized admin.",
    id: "job_card_deletion",
    label: "Job Card cleanup",
  },
  {
    description: "Privacy-safe notification events that are retrying or exhausted.",
    id: "notification_email",
    label: "Notification email",
  },
  {
    description: "Failed, stale, or exhausted workflow-reminder runs.",
    id: "workflow_nudge",
    label: "Workflow reminders",
  },
] as const satisfies readonly RecoverySourceConfig[];

export function recoverySourcesForAccess(access: {
  permissions?: readonly string[];
  roles?: readonly string[];
}): RecoverySourceConfig[] {
  const permissions = new Set(access.permissions ?? []);
  const roles = new Set(access.roles ?? []);
  return RECOVERY_SOURCE_CONFIGS.filter((source) => {
    if (source.id === "job_card_deletion") {
      return permissions.has(P.MANAGE_JOB_CARDS);
    }
    if (source.id === "notification_email") {
      return permissions.has(P.VIEW_EMAIL_DELIVERY_STATUS);
    }
    if (source.id === "workflow_nudge") {
      return (
        permissions.has(P.MANAGE_STAFF) ||
        roles.has("Admin") ||
        roles.has("Directors") ||
        roles.has("Director Cement")
      );
    }
    return true;
  });
}

export function formatRecoveryAge(ageMs: number) {
  const safeAge = Math.max(0, ageMs);
  const minutes = Math.floor(safeAge / 60_000);
  if (minutes < 1) {
    return "less than a minute";
  }
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}
