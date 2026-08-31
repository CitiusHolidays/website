import { describe, expect, test } from "bun:test";
import { resolveWebsiteSourceContext } from "./websiteSourceContext";

describe("Website enquiry source context", () => {
  test("re-resolves canonical context from the reviewed route catalogue", () => {
    expect(
      resolveWebsiteSourceContext({
        intent: "pilgrimage-enquiry",
        trailSlug: "kailash-mansarovar-14day",
      })
    ).toEqual({
      ok: true,
      value: {
        intent: "pilgrimage-enquiry",
        label: "Kailash Mansarovar Yatra 2026 enquiry",
        trailSlug: "kailash-mansarovar-14day",
      },
    });
    expect(resolveWebsiteSourceContext({ intent: "mice-proposal" })).toEqual({
      ok: true,
      value: { intent: "mice-proposal", label: "MICE proposal request" },
    });
  });

  test("rejects browser labels, hostile trails, mismatched intents, and ambiguous values", () => {
    for (const value of [
      { intent: "mice-proposal", label: "Trusted browser label" },
      { intent: "mice-proposal", trailSlug: "kailash-mansarovar-14day" },
      { intent: "pilgrimage-enquiry", trailSlug: "../private" },
      { intent: "unknown" },
      ["pilgrimage-enquiry"],
    ]) {
      expect(resolveWebsiteSourceContext(value).ok).toBe(false);
    }
  });
});
