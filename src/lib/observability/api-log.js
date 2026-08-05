import { randomUUID } from "node:crypto";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const REDACTED = "[redacted]";
const SENSITIVE_KEY =
  /(?:authorization|cookie|set-cookie|password|secret|token|api[-_]?key|signature|webhook|private|credential|email|phone)/i;

export function requestIdFor(request, createId = randomUUID) {
  const supplied = request?.headers?.get?.("x-request-id")?.trim();
  return supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : `req_${createId()}`;
}

function redact(value, key = "") {
  if (SENSITIVE_KEY.test(key)) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey),
      ])
    );
  }
  if (typeof value === "string" && value.length > 2048) {
    return `${value.slice(0, 2048)}…`;
  }
  return value;
}

export function buildApiLog(fields) {
  return redact({
    service: "citius-web",
    timestamp: new Date().toISOString(),
    ...fields,
  });
}

export function logApiEvent(fields, logger = console) {
  const payload = buildApiLog(fields);
  let level = "info";
  if (fields.level === "error") {
    level = "error";
  } else if (fields.level === "warn") {
    level = "warn";
  }
  logger[level](JSON.stringify(payload));
  return payload;
}

/**
 * Add one consistent request-id header and one redacted structured event to an
 * API handler. The callback receives the same id for application diagnostics.
 */
export async function withApiRequestLogging(request, route, handler, options = {}) {
  const requestId = requestIdFor(request, options.createId);
  const startedAt = Date.now();
  const logger = options.logger ?? console;
  try {
    const response = await handler({ request, requestId });
    const headers = new Headers(response.headers);
    headers.set("x-request-id", requestId);
    logApiEvent(
      {
        durationMs: Date.now() - startedAt,
        method: request?.method,
        requestId,
        route,
        status: response.status,
      },
      logger
    );
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    logApiEvent(
      {
        durationMs: Date.now() - startedAt,
        errorCode: error instanceof Error ? error.name : "unknown",
        level: "error",
        method: request?.method,
        requestId,
        route,
        status: 500,
      },
      logger
    );
    throw error;
  }
}
