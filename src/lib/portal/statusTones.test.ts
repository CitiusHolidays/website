import { describe, expect, test } from "bun:test";
import {
  CANONICAL_STATUSES_BY_DOMAIN,
  DASHBOARD_READINESS_STATUSES,
  getStatusPresentation,
  type StatusDomain,
} from "./statusTones";

describe("statusTones", () => {
  test("covers every canonical status in each named domain", () => {
    for (const [domain, statuses] of Object.entries(CANONICAL_STATUSES_BY_DOMAIN) as [
      StatusDomain,
      readonly string[],
    ][]) {
      for (const status of statuses) {
        const presentation = getStatusPresentation(domain, status);
        expect(presentation.meaning.length).toBeGreaterThan(0);
        expect(presentation.badgeTone).toBeTruthy();
        expect(presentation.semanticTone).toBeTruthy();
      }
    }
  });

  test("preserves special semantic meanings", () => {
    expect(getStatusPresentation("proposal", "Sent")).toEqual({
      badgeTone: "blue",
      meaning: "With Sales — awaiting Sales Decision",
      semanticTone: "info",
    });
    expect(getStatusPresentation("proposal", "With Sales")).toEqual(
      getStatusPresentation("proposal", "Sent")
    );
    expect(getStatusPresentation("queryContracting", "Proposal sent")).toEqual(
      getStatusPresentation("proposal", "Sent")
    );
    expect(getStatusPresentation("querySales", "Order Confirmed")).toMatchObject({
      badgeTone: "green",
      semanticTone: "positive",
    });
    expect(getStatusPresentation("querySales", "Order Lost")).toMatchObject({
      badgeTone: "red",
      semanticTone: "danger",
    });
    expect(getStatusPresentation("queryContracting", "Proposal in progress")).toMatchObject({
      badgeTone: "amber",
      semanticTone: "progress",
    });
    expect(getStatusPresentation("approval", "Pending")).toMatchObject({
      semanticTone: "warning",
    });
    expect(getStatusPresentation("invoice", "Overdue")).toMatchObject({
      semanticTone: "danger",
    });
    expect(getStatusPresentation("dashboardReadiness", "Docs pending")).toMatchObject({
      meaning: "Documents pending before departure",
      semanticTone: "warning",
    });
  });

  test("classifies blocked, waiting, overdue, and unassigned cross-cutting states", () => {
    expect(getStatusPresentation("jobCard", "Blocked")).toMatchObject({
      semanticTone: "danger",
    });
    expect(getStatusPresentation("approval", "Waiting for HR")).toMatchObject({
      semanticTone: "warning",
    });
    expect(getStatusPresentation("invoice", "Overdue")).toMatchObject({
      semanticTone: "danger",
    });
    expect(getStatusPresentation("queryLeadStage", "Sales owner unassigned")).toMatchObject({
      semanticTone: "warning",
    });
  });

  test("falls back to neutral semantics for unknown and legacy strings", () => {
    expect(getStatusPresentation("queryLeadStage", "Legacy CRM stage")).toEqual({
      badgeTone: "gray",
      meaning: "Status: Legacy CRM stage",
      semanticTone: "neutral",
    });
    expect(getStatusPresentation("ticketing", "Legacy ticket state")).toEqual({
      badgeTone: "gray",
      meaning: "Status: Legacy ticket state",
      semanticTone: "neutral",
    });
    expect(getStatusPresentation("proposal", "")).toEqual({
      badgeTone: "gray",
      meaning: "Status not set",
      semanticTone: "neutral",
    });
  });

  test("aligns dashboard readiness with list badge semantics", () => {
    for (const status of DASHBOARD_READINESS_STATUSES) {
      const presentation = getStatusPresentation("dashboardReadiness", status);
      const expectedMeaning = {
        "Docs pending": "Documents pending",
        Ready: "Ready for departure",
        Ticketing: "Ticketing",
      }[status];
      expect(presentation.badgeTone).toBe(
        getStatusPresentation("dashboardReadiness", status).badgeTone
      );
      expect(presentation.meaning).toContain(expectedMeaning);
    }
  });
});
