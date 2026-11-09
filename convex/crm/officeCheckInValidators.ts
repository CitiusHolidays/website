import { v } from "convex/values";
import {
  AWAY_REASONS,
  CHECK_IN_REQUIREMENTS,
  DISTANCE_BANDS,
  ENFORCEMENT_MODES,
  GEOFENCE_REASONS,
  GEOLOCATION_ERROR_CODES,
  NETWORK_ENTRY_KINDS,
  NETWORK_REASONS,
  SIGNAL_OUTCOMES,
} from "./officeCheckInVerification";

function literals<const Value extends string>(values: readonly Value[]) {
  return v.union(...values.map((value) => v.literal(value)));
}

export const checkInRequirementValidator = literals(CHECK_IN_REQUIREMENTS);
export const enforcementModeValidator = literals(ENFORCEMENT_MODES);
export const signalOutcomeValidator = literals(SIGNAL_OUTCOMES);
export const networkEntryKindValidator = literals(NETWORK_ENTRY_KINDS);
export const awayReasonValidator = literals(AWAY_REASONS);

/** The exact point stored with an On tour or Sales call answer (see `awayLocationFrom`). */
export const awayLocationValidator = v.object({
  accuracyMeters: v.number(),
  capturedAt: v.number(),
  latitude: v.number(),
  longitude: v.number(),
});

export const networkEntryValidator = v.object({
  cidr: v.string(),
  kind: networkEntryKindValidator,
  label: v.string(),
});

export const geofenceRuleValidator = v.object({
  latitude: v.number(),
  longitude: v.number(),
  maxAccuracyMeters: v.number(),
  radiusMeters: v.number(),
});

export const locationReadingValidator = v.union(
  v.object({
    accuracyMeters: v.number(),
    capturedAt: v.number(),
    kind: v.literal("position"),
    latitude: v.number(),
    longitude: v.number(),
  }),
  v.object({ code: literals(GEOLOCATION_ERROR_CODES), kind: v.literal("error") }),
  v.object({ kind: v.literal("not_requested") })
);

/**
 * Stored evidence for one clock-in or clock-out. Raw coordinates and full IP
 * addresses are never stored: only outcomes, reasons, a coarse distance band,
 * rounded accuracy and a /24 or /48 network prefix.
 */
export const verificationRecordValidator = v.object({
  enforcementMode: enforcementModeValidator,
  evaluatedAt: v.number(),
  geofence: v.optional(
    v.object({
      accuracyMeters: v.optional(v.number()),
      distanceBand: v.optional(literals(DISTANCE_BANDS)),
      outcome: signalOutcomeValidator,
      reason: literals(GEOFENCE_REASONS),
    })
  ),
  network: v.optional(
    v.object({
      ipVersion: v.optional(v.union(v.literal(4), v.literal(6))),
      matchedLabel: v.optional(v.string()),
      observedPrefix: v.optional(v.string()),
      outcome: signalOutcomeValidator,
      reason: literals(NETWORK_REASONS),
    })
  ),
  outcome: signalOutcomeValidator,
  requirement: v.union(checkInRequirementValidator, v.literal("not_configured")),
  ruleVersion: v.optional(v.number()),
  wouldBlock: v.boolean(),
});

export const checkInAdmissionValidator = v.union(
  v.literal("admitted"),
  v.literal("pending_review"),
  v.literal("rejected")
);

export const checkInReviewValidator = v.object({
  decision: v.union(v.literal("accepted"), v.literal("rejected")),
  reason: v.string(),
  reviewedAt: v.number(),
  reviewerName: v.string(),
  reviewerStaffId: v.id("staffUsers"),
});

export const checkInAuditKindValidator = v.union(
  v.literal("clock_in"),
  v.literal("clock_in_retry"),
  v.literal("clock_out"),
  v.literal("away_reason_set"),
  v.literal("review_accepted"),
  v.literal("review_rejected"),
  v.literal("times_corrected"),
  v.literal("manual_entry"),
  v.literal("record_deleted"),
  v.literal("rule_saved"),
  v.literal("office_created"),
  v.literal("office_assigned")
);

export const officeCheckInTables = {
  officeCheckInAudit: {
    actorName: v.string(),
    actorStaffId: v.optional(v.id("staffUsers")),
    at: v.number(),
    checkInId: v.optional(v.id("officeCheckIns")),
    kind: checkInAuditKindValidator,
    officeId: v.optional(v.id("offices")),
    reason: v.optional(v.string()),
    subjectStaffId: v.optional(v.id("staffUsers")),
    summary: v.string(),
  },
  officeCheckInRules: {
    enforcementMode: enforcementModeValidator,
    geofence: v.optional(geofenceRuleValidator),
    networks: v.array(networkEntryValidator),
    officeId: v.id("offices"),
    requirement: checkInRequirementValidator,
    timeZone: v.string(),
    updatedAt: v.number(),
    updatedByStaffId: v.optional(v.id("staffUsers")),
    version: v.number(),
  },
  officeCheckIns: {
    admission: checkInAdmissionValidator,
    /**
     * Where the person was when they answered On tour or Sales call. Only the person and
     * those who oversee them read it; it is deleted with the check-in.
     */
    awayLocation: v.optional(awayLocationValidator),
    /** Where the person says they are when the clock-in check didn't pass. */
    awayReason: v.optional(awayReasonValidator),
    clockIn: verificationRecordValidator,
    clockInAt: v.number(),
    clockOut: v.optional(verificationRecordValidator),
    clockOutAt: v.optional(v.number()),
    correctedAt: v.optional(v.number()),
    createdAt: v.number(),
    officeId: v.id("offices"),
    review: v.optional(checkInReviewValidator),
    source: v.union(v.literal("self"), v.literal("manager_entry")),
    staffId: v.id("staffUsers"),
    status: v.union(v.literal("open"), v.literal("closed")),
    updatedAt: v.number(),
    workDate: v.string(),
  },
};
