import { describe, expect, test } from "bun:test";
import {
  ACCOUNT_DELETION_HREF,
  getContactIntentPrefill,
  getPhotoBoothContactHref,
  isLegacyAccountDeletionIntent,
  MICE_PROPOSAL_CONTACT_HREF,
  PILGRIMAGE_CONTACT_HREFS,
  resolveContactDestination,
  resolveContactIntent,
} from "./contactIntent";

describe("Public contact intent", () => {
  test("Pilgrimage actions have distinct, durable contact destinations", () => {
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

  test("Account deletion is self-service and the retired contact intent forwards to it", () => {
    expect(ACCOUNT_DELETION_HREF).toBe("/account?tab=settings#delete-account");
    expect(isLegacyAccountDeletionIntent("account-deletion")).toBe(true);
    expect(isLegacyAccountDeletionIntent("mice-proposal")).toBe(false);
    expect(resolveContactIntent("account-deletion")).toBeNull();
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
});

test("Photo Booth enquiry carries only a bounded destination into editable consented contact", () => {
  const href = new URL(
    getPhotoBoothContactHref("  Kashi & Ayodhya  "),
    "https://citiusholidays.com"
  );
  expect(href.pathname).toBe("/contact");
  expect(href.searchParams.get("intent")).toBe("event-photo-booth");
  expect(href.searchParams.get("destination")).toBe("Kashi & Ayodhya");
  expect([...href.searchParams.keys()].sort()).toEqual(["destination", "intent"]);
  expect(resolveContactDestination(["Paris"])).toBe("");
  expect(resolveContactDestination("a".repeat(81))).toBe("");
  expect(resolveContactDestination("Paris\nBali")).toBe("");
  expect(resolveContactDestination("काशी")).toBe("काशी");
  expect(getContactIntentPrefill(resolveContactIntent("event-photo-booth"), "Paris")).toEqual({
    destination: "Paris",
    message: "I would like to plan a trip to Paris after trying the Citius Event Photo Booth.",
    subject: "Travel enquiry: Paris",
  });
  expect(getContactIntentPrefill("pilgrimage-enquiry", "Paris")).not.toHaveProperty("destination");
});
