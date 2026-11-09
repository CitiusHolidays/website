import { isJsonObject, readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { isRuntimeNumber, isRuntimeString } from "@/lib/runtimeValues";

// One report-uri report is under 2 KB; a Reporting API batch can hold several.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 10;
const MAX_FIELD_LENGTH = 200;
const KEYWORD_SOURCE_PATTERN = /^[a-z-]+$/;

function noContent(status = 204) {
  return new Response(null, { status });
}

function bounded(value) {
  return value.slice(0, MAX_FIELD_LENGTH);
}

/** Keeps only the origin of a blocked URL; keywords such as "inline" or "eval" pass through. */
function blockedSource(value) {
  if (!isRuntimeString(value) || value === "") {
    return "none";
  }
  if (KEYWORD_SOURCE_PATTERN.test(value)) {
    return bounded(value);
  }
  try {
    const url = new URL(value);
    return bounded(url.origin === "null" ? `${url.protocol}` : url.origin);
  } catch {
    return "unparseable";
  }
}

/** Keeps only the path: queries and fragments can carry tokens and personal data. */
function pathOnly(value) {
  if (!isRuntimeString(value)) {
    return "unknown";
  }
  try {
    return bounded(new URL(value).pathname);
  } catch {
    return "unknown";
  }
}

function originAndPath(value) {
  if (!isRuntimeString(value) || value === "") {
    return null;
  }
  try {
    const url = new URL(value);
    return bounded(`${url.origin}${url.pathname}`);
  } catch {
    return null;
  }
}

function directiveName(value) {
  return isRuntimeString(value) && value !== "" ? bounded(value.split(" ")[0]) : "unknown";
}

/**
 * Reduces a browser report to fields that say what broke and where, and nothing that can
 * identify a visitor: no query strings, fragments, script samples, referrers, or IP addresses.
 */
function summarizeViolation(report) {
  const legacy = isJsonObject(report["csp-report"]) ? report["csp-report"] : null;
  const body = legacy ?? (isJsonObject(report.body) ? report.body : null);
  if (!body) {
    return null;
  }
  const field = (legacyName, modernName) => (legacy ? body[legacyName] : body[modernName]);
  const line = field("line-number", "lineNumber");
  const summary = {
    blocked: blockedSource(field("blocked-uri", "blockedURL")),
    directive: directiveName(
      field("effective-directive", "effectiveDirective") ?? field("violated-directive", "")
    ),
    disposition: field("disposition", "disposition") === "enforce" ? "enforce" : "report",
    path: pathOnly(field("document-uri", "documentURL") ?? report.url),
  };
  const source = originAndPath(field("source-file", "sourceFile"));
  if (source) {
    summary.source = source;
    if (isRuntimeNumber(line) && Number.isInteger(line) && line > 0) {
      summary.line = line;
    }
  }
  return summary;
}

function reportsFrom(contentType, value) {
  if (contentType === "application/csp-report") {
    return isJsonObject(value) ? [value] : [];
  }
  return Array.isArray(value)
    ? value.filter((entry) => isJsonObject(entry) && entry.type === "csp-violation")
    : [];
}

/**
 * @param {Request} request
 * @param {{ logger?: Pick<Console, "warn"> }} [options]
 */
export async function handleCspReport(request, { logger = console } = {}) {
  const contentType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/csp-report" && contentType !== "application/reports+json") {
    return noContent(415);
  }
  const bodyResult = await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return noContent(bodyResult.reason === "too_large" ? 413 : 400);
  }
  for (const report of reportsFrom(contentType, bodyResult.value).slice(
    0,
    MAX_REPORTS_PER_REQUEST
  )) {
    const summary = summarizeViolation(report);
    if (summary) {
      try {
        logger.warn(JSON.stringify({ event: "csp.violation", service: "citius-web", ...summary }));
      } catch {
        // A logging failure must not turn a report into an error response.
      }
    }
  }
  return noContent();
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/csp-report", () => handleCspReport(request));
}
