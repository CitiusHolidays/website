import { describe, expect, test } from "bun:test";
import { parseErrorMonitoringReadiness } from "./error-monitoring-readiness";
import readinessJson from "./error-monitoring-readiness.json";

const completeDecision = {
  ...readinessJson,
  ownership: {
    costOwner: "Operations",
    incidentOwner: "On-call",
    operationsOwner: "Operations",
    privacyOwner: "Privacy",
  },
  policy: {
    maxEventBytes: 8192,
    perSourceEventsPerMinute: 10,
    redactionPolicyVersion: "errors-v1",
    retentionDays: 14,
    sampleRate: 0.25,
    sourceMaps: "private-provider-only",
  },
  provider: "reviewed-provider-and-version",
};

describe("error-monitoring readiness", () => {
  test("keeps the checked-in state honest while provider decisions are outstanding", () => {
    expect(parseErrorMonitoringReadiness(readinessJson)).toMatchObject({
      previewEvidence: null,
      provider: null,
      status: "provider_selection_required",
    });
  });

  test("requires complete ownership and policy before configuration can be called ready", () => {
    expect(() =>
      parseErrorMonitoringReadiness({
        ...readinessJson,
        provider: "provider",
        status: "preview_configuration_ready",
      })
    ).toThrow("complete provider, ownership, and policy");
    expect(
      parseErrorMonitoringReadiness({
        ...completeDecision,
        status: "preview_configuration_ready",
      }).status
    ).toBe("preview_configuration_ready");
  });

  test("accepts Preview verification only with every synthetic source and no Production identity", () => {
    const previewEvidence = {
      revision: "abcdef1234567890",
      syntheticChecks: [
        "next-server",
        "react-boundary",
        "unhandled-rejection",
        "window-error",
        "provider-alert",
      ],
      targetId: "preview-fixture-preview-branch-123",
    };
    expect(
      parseErrorMonitoringReadiness({
        ...completeDecision,
        previewEvidence,
        status: "preview_verified",
      }).status
    ).toBe("preview_verified");
    expect(() =>
      parseErrorMonitoringReadiness({
        ...completeDecision,
        previewEvidence: { ...previewEvidence, targetId: "preview-production" },
        status: "preview_verified",
      })
    ).toThrow("explicit Preview");
    expect(() =>
      parseErrorMonitoringReadiness({
        ...completeDecision,
        previewEvidence: {
          ...previewEvidence,
          syntheticChecks: previewEvidence.syntheticChecks.slice(1),
        },
        status: "preview_verified",
      })
    ).toThrow("every synthetic check");
  });
});
