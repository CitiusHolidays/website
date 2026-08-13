import { describe, expect, test } from "bun:test";
import {
  formatConciergeResponseError,
  formatContactSubmissionError,
  formatJourneyPlannerResponseError,
  formatProfileUpdateError,
  readJsonError,
} from "./userFacingErrors";

describe("stable user-facing error mapping", () => {
  test("keeps approved validation and recovery guidance", () => {
    expect(
      formatContactSubmissionError({
        message: "Please provide a valid email address.",
        status: 400,
      })
    ).toBe("Please provide a valid email address.");
    expect(formatContactSubmissionError({ status: 429 })).toContain("wait a few minutes");
    expect(formatProfileUpdateError({ status: 401 })).toContain("Sign in again");
    expect(formatConciergeResponseError(413)).toContain("Shorten it");
    expect(formatJourneyPlannerResponseError(429)).toContain("try again shortly");
  });

  test("never exposes arbitrary server or exception messages", () => {
    const secret = "provider exploded with token secret-value";
    expect(formatContactSubmissionError({ message: secret, status: 503 })).not.toContain(secret);
    expect(formatProfileUpdateError({ message: secret, status: 500 })).not.toContain(secret);
    expect(formatConciergeResponseError(500)).not.toContain(secret);
    expect(formatJourneyPlannerResponseError(500)).not.toContain(secret);
  });

  test("reads only a JSON error string and fails closed for malformed bodies", async () => {
    await expect(readJsonError(Response.json({ error: "Known error" }))).resolves.toBe(
      "Known error"
    );
    await expect(
      readJsonError(new Response("<html>gateway failure</html>", { status: 502 }))
    ).resolves.toBe("");
  });
});
