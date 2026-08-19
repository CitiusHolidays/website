import type { JsonValue } from "@/lib/jsonValue";
import { isJsonObject } from "@/lib/jsonValue";
import { isRuntimeBoolean, isRuntimeString } from "@/lib/runtimeValues";

export type OperationalControlKey =
  | "ai.concierge"
  | "ai.journey_planner"
  | "email.auth"
  | "email.crm_workflow"
  | "files.document_preview_worker"
  | "inbound.crm_intake"
  | "inbound.info_mailbox_email"
  | "inbound.sales_bell"
  | "inbound.sales_email"
  | "jobs.scheduled"
  | "notifications.crm_bell"
  | "payments.razorpay"
  | "public.sacred_bharat_001";

export type OperationalTestScope = "inbound_contact";

export type OperationalControlDuration = "permanent" | "30m" | "2h" | "24h";

export interface InboundTestResult {
  accepted: boolean;
  duplicate: boolean;
  effects?: {
    crmIntake: string;
    infoMailboxEmail: string;
    salesBell: string;
    salesEmail: string;
  };
  intentId?: string | null;
}

export interface ParsedInboundTestResponse {
  error?: string;
  result?: InboundTestResult;
}

interface LocallyHeldTestSession {
  expiresAt: number;
  sessionId: string;
}

interface ObservedTestSession {
  _id: string;
  revokedAt?: number;
}

export const DEFAULT_OPERATIONAL_CONTROL_DURATION: OperationalControlDuration = "2h";

export const OPERATIONAL_CONTROL_DURATION_OPTIONS: ReadonlyArray<{
  label: string;
  value: OperationalControlDuration;
}> = [
  { label: "After 30 minutes", value: "30m" },
  { label: "After 2 hours", value: "2h" },
  { label: "After 24 hours", value: "24h" },
  { label: "No expiry", value: "permanent" },
];

export interface OperationalControlPlaneStatus {
  activatedAt?: number;
  activatedByName?: string;
  active: boolean;
  blockingKeys: string[];
  ready: boolean;
  revision: number;
  willInitializeKeys: string[];
}

export function operationalControlPlanePresentation(status: OperationalControlPlaneStatus) {
  if (status.active) {
    return {
      label: "Active",
      message: "Global controls are authoritative for live traffic.",
      tone: "active" as const,
    };
  }
  if (status.ready) {
    return {
      label: "Prepared",
      message: "Review the initialization set, add a reason, then activate once.",
      tone: "prepared" as const,
    };
  }
  return {
    label: "Blocked",
    message: "Resolve every blocking control state before activation.",
    tone: "blocked" as const,
  };
}

export interface OperationalControlRow {
  availability: "available" | "unavailable";
  category: "AI" | "Authentication" | "Contact" | "CRM" | "Infrastructure" | "Payments" | "Public";
  dependencies: OperationalControlKey[];
  description: string;
  effectiveEnabled: boolean | null;
  enforcement: string;
  expiresAt?: number;
  key: OperationalControlKey;
  label: string;
  revision: number;
  source: string;
  standardEnabled: boolean;
  state: string;
  unavailableReason?: string;
  updatedAt?: number;
  updatedByName?: string;
}

export const OPERATIONAL_TEST_SCOPE_KEYS = {
  inbound_contact: [
    "inbound.crm_intake",
    "notifications.crm_bell",
    "email.crm_workflow",
    "inbound.sales_bell",
    "inbound.sales_email",
    "inbound.info_mailbox_email",
  ],
} as const satisfies Record<OperationalTestScope, readonly OperationalControlKey[]>;

export const OPERATIONAL_TEST_SCOPE_LABELS = {
  inbound_contact: "Inbound contact form",
} as const satisfies Record<OperationalTestScope, string>;

export function parseOperationalControlDuration(value: string): OperationalControlDuration | null {
  switch (value) {
    case "permanent":
    case "30m":
    case "2h":
    case "24h":
      return value;
    default:
      return null;
  }
}

export function parseOperationalTestScope(value: string): OperationalTestScope | null {
  return value === "inbound_contact" ? value : null;
}

export function isOperationalTestSessionCurrent(
  session: LocallyHeldTestSession | null,
  observedSessions: readonly ObservedTestSession[] | undefined,
  at: number
) {
  if (!(session && session.expiresAt > at)) {
    return false;
  }
  const observed = observedSessions?.find((candidate) => candidate._id === session.sessionId);
  return observed?.revokedAt === undefined;
}

export function isOperationalControlKey(value: string): value is OperationalControlKey {
  switch (value) {
    case "ai.concierge":
    case "ai.journey_planner":
    case "email.auth":
    case "email.crm_workflow":
    case "files.document_preview_worker":
    case "inbound.crm_intake":
    case "inbound.info_mailbox_email":
    case "inbound.sales_bell":
    case "inbound.sales_email":
    case "jobs.scheduled":
    case "notifications.crm_bell":
    case "payments.razorpay":
    case "public.sacred_bharat_001":
      return true;
    default:
      return false;
  }
}

function parseInboundEffects(value: JsonValue): InboundTestResult["effects"] {
  if (value === undefined) {
    return;
  }
  if (
    !(
      isJsonObject(value) &&
      isRuntimeString(value.crmIntake) &&
      isRuntimeString(value.infoMailboxEmail) &&
      isRuntimeString(value.salesBell) &&
      isRuntimeString(value.salesEmail)
    )
  ) {
    throw new Error("Synthetic inbound test returned invalid effect evidence.");
  }
  return {
    crmIntake: value.crmIntake,
    infoMailboxEmail: value.infoMailboxEmail,
    salesBell: value.salesBell,
    salesEmail: value.salesEmail,
  };
}

export function parseInboundTestResponse(value: JsonValue): ParsedInboundTestResponse {
  if (!isJsonObject(value)) {
    throw new Error("Synthetic inbound test returned an invalid response.");
  }
  const error = isRuntimeString(value.error) ? value.error : undefined;
  if (!(isRuntimeBoolean(value.accepted) && isRuntimeBoolean(value.duplicate))) {
    if (error) {
      return { error };
    }
    throw new Error("Synthetic inbound test returned an invalid response.");
  }
  const intentId =
    value.intentId === null || isRuntimeString(value.intentId) ? value.intentId : undefined;
  return {
    error,
    result: {
      accepted: value.accepted,
      duplicate: value.duplicate,
      effects: parseInboundEffects(value.effects),
      intentId,
    },
  };
}

export function isExactAdmin(access?: { roles?: string[]; staffId?: string }) {
  return Boolean(access?.staffId && access.roles?.includes("Admin"));
}

export function operationalControlExpiry(duration: OperationalControlDuration, now = Date.now()) {
  const milliseconds = {
    "2h": 2 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    permanent: 0,
  }[duration];
  return milliseconds === 0 ? null : now + milliseconds;
}

export function defaultTestOverrides(
  scope: OperationalTestScope,
  controls: OperationalControlRow[]
) {
  const byKey = new Map(controls.map((control) => [control.key, control]));
  return OPERATIONAL_TEST_SCOPE_KEYS[scope].map((key) => {
    let state: "enabled" | "disabled";
    if (scope === "inbound_contact") {
      state = key === "inbound.crm_intake" ? "enabled" : "disabled";
    } else {
      state = byKey.get(key)?.effectiveEnabled ? "enabled" : "disabled";
    }
    return { key, state };
  });
}
