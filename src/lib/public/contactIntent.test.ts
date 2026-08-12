import { describe, expect, test } from "bun:test";
import {
  getContactIntentPrefill,
  PILGRIMAGE_CONTACT_HREFS,
  resolveContactIntent,
} from "./contactIntent";

describe("public contact intent", () => {
  test("pilgrimage actions have distinct, durable contact destinations", () => {
    expect(PILGRIMAGE_CONTACT_HREFS).toEqual({
      callback: "/contact?intent=pilgrimage-callback",
      enquiry: "/contact?intent=pilgrimage-enquiry",
    });
    expect(PILGRIMAGE_CONTACT_HREFS.callback).not.toBe(PILGRIMAGE_CONTACT_HREFS.enquiry);
  });

  test("supported intents prefill an editable brief and unknown values safely fall back", () => {
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
