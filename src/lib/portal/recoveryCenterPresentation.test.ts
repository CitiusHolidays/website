import { describe, expect, test } from "bun:test";
import { PORTAL_PERMISSIONS as P } from "./constants";
import { formatRecoveryAge, recoverySourcesForAccess } from "./recoveryCenterPresentation";

describe("Recovery Center presentation", () => {
  test("formats deterministic server ages without consulting the wall clock", () => {
    expect(formatRecoveryAge(-1)).toBe("less than a minute");
    expect(formatRecoveryAge(60_000)).toBe("1 minute");
    expect(formatRecoveryAge(59 * 60_000)).toBe("59 minutes");
    expect(formatRecoveryAge(60 * 60_000)).toBe("1 hour");
    expect(formatRecoveryAge(25 * 60 * 60_000)).toBe("1 day");
  });

  test("shows privileged sources only when current access carries their owner permission", () => {
    expect(recoverySourcesForAccess({ permissions: [P.VIEW_DASHBOARD], roles: ["Sales"] })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "passenger_import" }),
        expect.objectContaining({ id: "passenger_export" }),
      ])
    );
    expect(
      recoverySourcesForAccess({ permissions: [P.VIEW_DASHBOARD], roles: ["Sales"] }).map(
        (source) => source.id
      )
    ).not.toEqual(
      expect.arrayContaining([
        "job_card_deletion",
        "notification_email",
        "workflow_nudge",
        "passport_upload_cleanup",
        "passport_encrypted_cleanup",
      ])
    );

    expect(
      recoverySourcesForAccess({
        permissions: [P.MANAGE_JOB_CARDS, P.VIEW_EMAIL_DELIVERY_STATUS],
        roles: ["Operations Head"],
      }).map((source) => source.id)
    ).toEqual(expect.arrayContaining(["job_card_deletion", "notification_email"]));

    expect(
      recoverySourcesForAccess({
        permissions: [P.MANAGE_VISA, P.VIEW_DASHBOARD],
        roles: ["Operations"],
      }).map((source) => source.id)
    ).not.toEqual(
      expect.arrayContaining(["passport_upload_cleanup", "passport_encrypted_cleanup"])
    );

    expect(
      recoverySourcesForAccess({
        permissions: [P.MANAGE_VISA, P.VIEW_DASHBOARD],
        roles: ["Operations Head"],
      }).map((source) => source.id)
    ).toEqual(expect.arrayContaining(["passport_upload_cleanup", "passport_encrypted_cleanup"]));

    expect(
      recoverySourcesForAccess({
        permissions: [P.MANAGE_VISA, P.VIEW_DASHBOARD],
        roles: ["Director Cement"],
      }).map((source) => source.id)
    ).toEqual(expect.arrayContaining(["passport_upload_cleanup", "passport_encrypted_cleanup"]));
  });
});
