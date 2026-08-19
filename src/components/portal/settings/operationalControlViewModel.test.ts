import { describe, expect, test } from "bun:test";
import {
  defaultTestOverrides,
  isExactAdmin,
  operationalControlExpiry,
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
});
