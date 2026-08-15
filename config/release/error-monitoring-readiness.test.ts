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
      syntheticChecks: [
        "next-server",
        "react-boundary",
        "unhandled-rejection",
        "window-error",
        "provider-alert",
      ],
      target: {
        convexSiteOrigin: "https://elegant-bullfrog-454.convex.site",
        convexSourceHash: "a".repeat(64),
        frontendOrigin: "https://website-preview.example.com",
        id: "preview-elegant-bullfrog-454-monitoring",
        revision: "b".repeat(40),
        target: "preview",
      },
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
        previewEvidence: {
          ...previewEvidence,
          target: { ...previewEvidence.target, revision: "b".repeat(39) },
        },
        status: "preview_verified",
      })
    ).toThrow("exact 40-character Git revision");
    expect(() =>
      parseErrorMonitoringReadiness({
        ...completeDecision,
        previewEvidence: {
          ...previewEvidence,
          target: {
            ...previewEvidence.target,
            id: "preview-other-deployment-monitoring",
          },
        },
        status: "preview_verified",
      })
    ).toThrow("must bind the elegant-bullfrog-454 Convex deployment identity");
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
