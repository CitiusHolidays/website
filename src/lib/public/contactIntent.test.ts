import { describe, expect, test } from "bun:test";
import {
  ACCOUNT_DELETION_CONTACT_HREF,
  getContactIntentPrefill,
  MICE_PROPOSAL_CONTACT_HREF,
  PILGRIMAGE_CONTACT_HREFS,
  resolveContactIntent,
} from "./contactIntent";

describe("Public contact intent", () => {
  test("Pilgrimage actions have distinct, durable contact destinations", () => {
    expect(ACCOUNT_DELETION_CONTACT_HREF).toBe("/contact?intent=account-deletion");
    expect(PILGRIMAGE_CONTACT_HREFS).toEqual({
      callback: "/contact?intent=pilgrimage-callback",
      enquiry: "/contact?intent=pilgrimage-enquiry",
    });
    expect(PILGRIMAGE_CONTACT_HREFS.callback).not.toBe(PILGRIMAGE_CONTACT_HREFS.enquiry);
  });

  test("MICE proposal requests keep one explicit editable Website enquiry intent", () => {
    expect(MICE_PROPOSAL_CONTACT_HREF).toBe("/contact?intent=mice-proposal");
    expect(resolveContactIntent("mice-proposal")).toBe("mice-proposal");
    expect(getContactIntentPrefill("mice-proposal")).toEqual({
      message:
        "Please contact me about a proposal for a meeting, incentive, conference, or exhibition programme.",
      subject: "MICE proposal request",
    });
  });

  test("Prefills an actionable account deletion request", () => {
    const intent = resolveContactIntent("account-deletion");
    expect(intent).toBe("account-deletion");
    expect(getContactIntentPrefill(intent)).toEqual({
      message:
        "Please contact me about deleting my Citius account. I understand the team will first confirm any active journeys.",
      subject: "Account deletion request",
    });
  });

  test("Supported intents prefill an editable brief and unknown values safely fall back", () => {
    expect(resolveContactIntent("pilgrimage-callback")).toBe("pilgrimage-callback");
    expect(resolveContactIntent("pilgrimage-enquiry")).toBe("pilgrimage-enquiry");
    expect(resolveContactIntent("unexpected")).toBeNull();
    expect(resolveContactIntent(["pilgrimage-callback"])).toBeNull();

    const callback = getContactIntentPrefill("pilgrimage-callback");
    const enquiry = getContactIntentPrefill("pilgrimage-enquiry");
    expect(callback.subject).toContain("callback");
    expect(enquiry.subject).toContain("enquiry");
    expect(callback).not.toEqual(enquiry);
    expect(getContactIntentPrefill(null)).toEqual({ message: "", subject: "" });
  });

  test("Builds route-specific editable copy only from resolved pilgrimage context", () => {
    expect(
      getContactIntentPrefill("pilgrimage-callback", {
        slug: "kailash-mansarovar-14day",
        status: "published",
        title: "Kailash Mansarovar Yatra 2026",
      })
    ).toEqual({
      message:
        "Please contact me about Kailash Mansarovar Yatra 2026. I would like to discuss the published programme details.",
      subject: "Kailash Mansarovar Yatra 2026 callback request",
    });

    const interest = getContactIntentPrefill("pilgrimage-enquiry", {
      slug: "kora-east-trail",
      status: "comingSoon",
      title: "East Trail",
    });
    expect(interest).toEqual({
      message:
        "I would like to register interest in East Trail. Please contact me about reviewed programme updates.",
      subject: "East Trail interest",
    });
    expect(`${interest.message} ${interest.subject}`.toLowerCase()).not.toContain("brochure");
  });
});
