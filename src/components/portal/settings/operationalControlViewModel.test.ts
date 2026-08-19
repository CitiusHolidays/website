import { describe, expect, test } from "bun:test";
import {
  DEFAULT_OPERATIONAL_CONTROL_DURATION,
  defaultTestOverrides,
  isExactAdmin,
  OPERATIONAL_CONTROL_DURATION_OPTIONS,
  operationalControlExpiry,
  operationalControlPlanePresentation,
} from "./operationalControlViewModel";

describe("Operational controls view model", () => {
  test("mounts the control plane only for the exact Admin role", () => {
    expect(isExactAdmin({ roles: ["Admin"] })).toBe(true);
    expect(isExactAdmin({ roles: ["Directors"] })).toBe(false);
    expect(isExactAdmin({ roles: ["Admin Assistant"] })).toBe(false);
    expect(isExactAdmin(undefined)).toBe(false);
  });

  test("starts an inbound synthetic test with CRM intake on and side effects off", () => {
    expect(defaultTestOverrides("inbound_contact", [])).toEqual([
      { key: "inbound.crm_intake", state: "enabled" },
      { key: "notifications.crm_bell", state: "disabled" },
      { key: "email.crm_workflow", state: "disabled" },
      { key: "inbound.sales_bell", state: "disabled" },
      { key: "inbound.sales_email", state: "disabled" },
      { key: "inbound.info_mailbox_email", state: "disabled" },
    ]);
  });

  test("turns a duration choice into an absolute expiry", () => {
    expect(operationalControlExpiry("permanent", 1000)).toBeNull();
    expect(operationalControlExpiry("30m", 1000)).toBe(1_801_000);
    expect(operationalControlExpiry("24h", 1000)).toBe(86_401_000);
  });

  test("defaults global overrides to two hours and places the permanent option last", () => {
    expect(DEFAULT_OPERATIONAL_CONTROL_DURATION).toBe("2h");
    expect(OPERATIONAL_CONTROL_DURATION_OPTIONS.map((option) => option.value)).toEqual([
      "30m",
      "2h",
      "24h",
      "permanent",
    ]);
    expect(OPERATIONAL_CONTROL_DURATION_OPTIONS.at(-1)?.label).toBe("No expiry");
  });

  test("presents the one-way control-plane lifecycle without implying activation is reversible", () => {
    expect(
      operationalControlPlanePresentation({
        active: false,
        blockingKeys: [],
        ready: true,
        revision: 0,
        willInitializeKeys: ["email.auth"],
      })
    ).toMatchObject({ label: "Prepared", tone: "prepared" });
    expect(
      operationalControlPlanePresentation({
        active: false,
        blockingKeys: ["email.auth"],
        ready: false,
        revision: 0,
        willInitializeKeys: [],
      })
    ).toMatchObject({ label: "Blocked", tone: "blocked" });
    expect(
      operationalControlPlanePresentation({
        active: true,
        blockingKeys: [],
        ready: true,
        revision: 1,
        willInitializeKeys: [],
      })
    ).toMatchObject({ label: "Active", tone: "active" });
  });
});
