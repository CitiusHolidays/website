import { describe, expect, test } from "bun:test";
import type { JsonObject } from "@/lib/jsonValue";
import { handleCspReport } from "./route";

const PERSONAL_DATA_PATTERN = /asha|secret|invite|visitor|alert/;

function report(body: string, contentType: string) {
  return new Request("http://localhost/api/csp-report", {
    body,
    headers: { "Content-Type": contentType },
    method: "POST",
  });
}

function captureLogger() {
  const lines: JsonObject[] = [];
  return {
    lines,
    logger: {
      warn: (line: string) => {
        lines.push(JSON.parse(line));
      },
    },
  };
}

describe("CSP violation reports", () => {
  test("Logs a report-uri report without query strings, fragments, or script samples", async () => {
    const { lines, logger } = captureLogger();
    const response = await handleCspReport(
      report(
        JSON.stringify({
          "csp-report": {
            "blocked-uri": "https://tracker.example/pixel.js?visitor=asha@example.invalid",
            disposition: "report",
            "document-uri": "https://www.citiusholidays.com/account?token=secret#invite",
            "effective-directive": "script-src-elem",
            "line-number": 12,
            "original-policy": "default-src 'self'",
            referrer: "https://www.citiusholidays.com/?email=asha@example.invalid",
            "script-sample": "alert('asha@example.invalid')",
            "source-file": "https://www.citiusholidays.com/_next/chunk.js?v=1",
            "violated-directive": "script-src-elem",
          },
        }),
        "application/csp-report"
      ),
      { logger }
    );

    expect(response.status).toBe(204);
    expect(lines).toEqual([
      {
        blocked: "https://tracker.example",
        directive: "script-src-elem",
        disposition: "report",
        event: "csp.violation",
        line: 12,
        path: "/account",
        service: "citius-web",
        source: "https://www.citiusholidays.com/_next/chunk.js",
      },
    ]);
    expect(JSON.stringify(lines)).not.toMatch(PERSONAL_DATA_PATTERN);
  });

  test("Logs Reporting API batches, skips other report types, and caps the count", async () => {
    const { lines, logger } = captureLogger();
    const violation = {
      body: {
        blockedURL: "inline",
        disposition: "report",
        documentURL: "https://www.citiusholidays.com/contact?name=Asha",
        effectiveDirective: "style-src-attr",
        sample: "color: red",
      },
      type: "csp-violation",
      url: "https://www.citiusholidays.com/contact?name=Asha",
    };
    const batch = [
      { body: { message: "deprecated" }, type: "deprecation" },
      ...Array.from({ length: 30 }, () => violation),
    ];

    const response = await handleCspReport(
      report(JSON.stringify(batch), "application/reports+json"),
      { logger }
    );

    expect(response.status).toBe(204);
    expect(lines).toHaveLength(10);
    expect(lines[0]).toEqual({
      blocked: "inline",
      directive: "style-src-attr",
      disposition: "report",
      event: "csp.violation",
      path: "/contact",
      service: "citius-web",
    });
  });

  test("Rejects oversized, malformed, and non-report bodies without logging", async () => {
    const { lines, logger } = captureLogger();
    const oversized = JSON.stringify({ "csp-report": { padding: "x".repeat(20_000) } });

    expect(
      (await handleCspReport(report(oversized, "application/csp-report"), { logger })).status
    ).toBe(413);
    expect((await handleCspReport(report("{", "application/csp-report"), { logger })).status).toBe(
      400
    );
    expect((await handleCspReport(report("{}", "application/json"), { logger })).status).toBe(415);
    expect(
      (
        await handleCspReport(report(JSON.stringify({ other: true }), "application/csp-report"), {
          logger,
        })
      ).status
    ).toBe(204);
    expect(lines).toEqual([]);
  });
});
