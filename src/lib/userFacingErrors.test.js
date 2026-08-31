import { describe, expect, test } from "bun:test";
import {
  formatConciergeResponseError,
  formatContactSubmissionError,
  formatJourneyPlannerResponseError,
  formatProfileUpdateError,
  readJsonError,
  readSupportReference,
  withSupportReference,
} from "./userFacingErrors";

describe("Stable user-facing error mapping", () => {
  test("Keeps approved validation and recovery guidance", () => {
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

  test("Never exposes arbitrary server or exception messages", () => {
    const secret = "provider exploded with token secret-value";
    expect(formatContactSubmissionError({ message: secret, status: 503 })).not.toContain(secret);
    expect(formatProfileUpdateError({ message: secret, status: 500 })).not.toContain(secret);
    expect(formatConciergeResponseError(500)).not.toContain(secret);
    expect(formatJourneyPlannerResponseError(500)).not.toContain(secret);
  });

  test("Reads only a JSON error string and fails closed for malformed bodies", async () => {
    await expect(readJsonError(Response.json({ error: "Known error" }))).resolves.toBe(
      "Known error"
    );
    await expect(
      readJsonError(new Response("<html>gateway failure</html>", { status: 502 }))
    ).resolves.toBe("");
  });

  test("Adds only bounded server-minted support references to 5xx recovery text", () => {
    const serverFailure = new Response(null, {
      headers: { "x-request-id": "req_6d40d97e-b674-4b7e-a581-81f52b1016a6" },
      status: 503,
    });
    expect(readSupportReference(serverFailure)).toBe("req_6d40d97e-b674-4b7e-a581-81f52b1016a6");
    expect(withSupportReference("Please try again.", serverFailure)).toBe(
      "Please try again. Reference: req_6d40d97e-b674-4b7e-a581-81f52b1016a6"
    );
    expect(
      withSupportReference(
        "Please try again.",
        new Response(null, {
          headers: { "x-request-id": "<script>private-sentinel</script>" },
          status: 503,
        })
      )
    ).toBe("Please try again.");
    expect(
      withSupportReference(
        "Please try again.",
        new Response(null, {
          headers: { "x-request-id": "req_private-sentinel" },
          status: 503,
        })
      )
    ).toBe("Please try again.");
    expect(
      withSupportReference(
        "Check the form.",
        new Response(null, { headers: { "x-request-id": "req_safe" }, status: 400 })
      )
    ).toBe("Check the form.");
  });
});
