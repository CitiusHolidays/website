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
  | "payments.razorpay";

export type OperationalTestScope = "inbound_contact";

export type OperationalControlDuration = "permanent" | "30m" | "2h" | "24h";

export interface OperationalControlRow {
  availability: "available" | "unavailable";
  category: "AI" | "Authentication" | "Contact" | "CRM" | "Infrastructure" | "Payments";
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

export const OPERATIONAL_TEST_SCOPE_KEYS: Record<OperationalTestScope, OperationalControlKey[]> = {
  inbound_contact: [
    "inbound.crm_intake",
    "notifications.crm_bell",
    "email.crm_workflow",
    "inbound.sales_bell",
    "inbound.sales_email",
    "inbound.info_mailbox_email",
  ],
};

export const OPERATIONAL_TEST_SCOPE_LABELS: Record<OperationalTestScope, string> = {
  inbound_contact: "Inbound contact form",
};

export function isExactAdmin(access?: { roles?: string[] }) {
  return access?.roles?.includes("Admin") === true;
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
