import { describe, expect, test } from "bun:test";
import { getPortalDataDependencies } from "./portalDataDependencies";

describe("Portal data dependency declarations", () => {
  test("A dashboard route does not subscribe to operational domain lists", () => {
    expect([...getPortalDataDependencies({ view: "dashboard" })]).toEqual(["dashboard"]);
  });

  test("Activity view declares the activity dependency for extended notification history", () => {
    expect([...getPortalDataDependencies({ view: "activity" })]).toEqual(["activity"]);
  });

  test("Loads only the active view primary and support data", () => {
    expect([...getPortalDataDependencies({ view: "contracting" })].sort()).toEqual([
      "queries",
      "team",
    ]);
    expect([...getPortalDataDependencies({ view: "passport" })].sort()).toEqual([
      "jobCards",
      "travellers",
    ]);
  });

  test("Adds modal and deep-link support without restoring all-domain fan-out", () => {
    expect(
      [
        ...getPortalDataDependencies({
          deepLinkOpen: "approval",
          modal: "ticket",
          view: "dashboard",
        }),
      ].sort()
    ).toEqual(["approvals", "dashboard", "expenses", "jobCards", "pnrs", "tickets", "travellers"]);

    expect([...getPortalDataDependencies({ modal: "query", view: "queries" })].sort()).toEqual([
      "queries",
      "team",
    ]);

    expect(
      [...getPortalDataDependencies({ modal: "salesDecision", view: "queries" })].sort()
    ).toEqual(["proposals", "queries"]);

    expect(
      [...getPortalDataDependencies({ modal: "jobCard", view: "accounts-job-cards" })].sort()
    ).toEqual(["accountsJobCardCreators", "jobCards", "proposals", "queries"]);
  });
});
