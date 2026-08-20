import { describe, expect, test } from "bun:test";
import { handleLegacyContactRequest } from "./route";

describe("Legacy email-only contact route", () => {
  test("is retired so a successful email can never bypass CRM intake", async () => {
    const response = handleLegacyContactRequest();

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error:
        "This contact endpoint has moved. Submit through the current Website enquiry form so the request is recorded in Citius Connect.",
    });
  });
});
