import { describe, expect, test } from "bun:test";
import {
  filterOperationalControls,
  isExactAdmin,
  OPERATIONAL_CONTROL_KEYS,
  type OperationalControlRow,
  persistedStateForConfiguredState,
  restorationDelayMsFor,
} from "./operationalControlViewModel";

const control = {
  availability: "available",
  blockedBy: [],
  category: "AI",
  configuredState: "normal",
  dependencies: [],
  description: "Allow server-side Concierge requests.",
  effectiveEnabled: true,
  enforcement: "server gateway",
  key: "ai.concierge",
  label: "Citius Concierge",
  revision: 2,
  source: "configured_default",
  standardEnabled: true,
  state: "default",
} satisfies OperationalControlRow;

describe("Live feature control view model", () => {
  test("mounts only for the exact Admin role", () => {
    expect(isExactAdmin({ roles: ["Admin"], staffId: "staff_admin" })).toBe(true);
    expect(isExactAdmin({ roles: ["Admin"] })).toBe(false);
    expect(isExactAdmin({ roles: ["Directors"], staffId: "staff_director" })).toBe(false);
  });

  test("exposes all independently recoverable control keys", () => {
    expect(OPERATIONAL_CONTROL_KEYS).toHaveLength(26);
    expect(OPERATIONAL_CONTROL_KEYS).toContain("email.auth.staff_setup");
    expect(OPERATIONAL_CONTROL_KEYS).toContain("jobs.run_workflow_nudges");
  });

  test("turns a restoration choice into a server-safe delay", () => {
    expect(restorationDelayMsFor("none")).toBeNull();
    expect(restorationDelayMsFor("30m")).toBe(1_800_000);
    expect(restorationDelayMsFor("24h")).toBe(86_400_000);
  });

  test("keeps configured state separate from dependency blocking", () => {
    expect(persistedStateForConfiguredState("normal")).toBe("default");
    expect(persistedStateForConfiguredState("available")).toBe("enabled");
    expect(persistedStateForConfiguredState("paused")).toBe("disabled");
    const blocked = {
      ...control,
      blockedBy: ["email.crm_workflow"],
    } satisfies OperationalControlRow;
    expect(filterOperationalControls([blocked], new Map(), "", "blocked")).toEqual([blocked]);
    expect(filterOperationalControls([blocked], new Map(), "", "paused")).toEqual([]);
  });

  test("filters a scalable catalog by text and staged state", () => {
    const staged = new Map([["ai.concierge" as const, "disabled" as const]]);
    expect(filterOperationalControls([control], staged, "concierge", "changed")).toEqual([control]);
    expect(filterOperationalControls([control], staged, "razorpay", "all")).toEqual([]);
    const temporary = { ...control, expiresAt: 2000 } satisfies OperationalControlRow;
    expect(filterOperationalControls([temporary], new Map(), "", "temporary")).toEqual([temporary]);
  });
});
