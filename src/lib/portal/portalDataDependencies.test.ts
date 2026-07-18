import { describe, expect, test } from "bun:test";
import { getPortalDataDependencies } from "./portalDataDependencies";

describe("portal data dependency declarations", () => {
  test("a dashboard route does not subscribe to operational domain lists", () => {
    expect([...getPortalDataDependencies({ view: "dashboard" })]).toEqual([]);
  });

  test("loads only the active view primary and support data", () => {
    expect([...getPortalDataDependencies({ view: "contracting" })].sort()).toEqual([
      "proposals",
      "queries",
      "team",
    ]);
    expect([...getPortalDataDependencies({ view: "passport" })].sort()).toEqual([
      "jobCards",
      "travellers",
    ]);
  });

  test("adds modal and deep-link support without restoring all-domain fan-out", () => {
    expect(
      [
        ...getPortalDataDependencies({
          deepLinkOpen: "approval",
          modal: "ticket",
          view: "dashboard",
        }),
      ].sort()
    ).toEqual(["approvals", "expenses", "jobCards", "pnrs", "tickets", "travellers"]);

    expect([...getPortalDataDependencies({ modal: "query", view: "queries" })].sort()).toEqual([
      "queries",
      "team",
    ]);

    expect(
      [...getPortalDataDependencies({ modal: "jobCard", view: "accounts-job-cards" })].sort()
    ).toEqual(["jobCards", "proposals", "queries"]);
  });
});
