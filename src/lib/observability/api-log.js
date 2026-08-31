import { randomUUID } from "node:crypto";
import { getApiRouteObservability } from "./api-route-registry.js";

export function requestIdFor(_request, createId = randomUUID) {
  return `req_${createId()}`;
}

export function buildApiCompletionLog(fields, now = () => new Date()) {
  return {
    completion: fields.completion,
    durationMs: fields.durationMs,
    errorCategory: fields.errorCategory,
    event: "api.request.completed",
    family: fields.family,
    method: fields.method,
    outcome: fields.outcome,
    requestId: fields.requestId,
    responseMode: fields.responseMode,
    route: fields.route,
    service: "citius-web",
    status: fields.status,
    timestamp: now().toISOString(),
  };
}

function logApiCompletion(fields, logger, now) {
  const payload = buildApiCompletionLog(fields, now);
  const level = fields.status >= 500 || fields.outcome === "error" ? "error" : "info";
  try {
    logger[level](JSON.stringify(payload));
  } catch {
    // Observability must not change the API response or error contract.
  }
  return payload;
}

function withRequestId(response, requestId) {
  try {
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set("x-request-id", requestId);
    const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
    if (getSetCookie) {
      const cookies = getSetCookie();
      if (cookies.length > 0) {
        headers.delete("set-cookie");
        for (const cookie of cookies) {
          headers.append("set-cookie", cookie);
        }
      }
    }
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
}

function observeStream(response, finish) {
  if (!response.body) {
    finish("closed", "stream_closed");
    return response;
  }

  const reader = response.body.getReader();
  const body = new ReadableStream({
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        finish("cancelled", "stream_cancelled");
      }
    },
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          finish("closed", "stream_closed");
          controller.close();
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        finish("error", "stream_failed");
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * Add one consistent request-id header and one redacted structured event to an
 * API handler. The callback receives the same id for application diagnostics.
 */
export async function withApiRequestLogging(request, route, handler, options = {}) {
  const requestId = requestIdFor(request, options.createId);
  const nowMs = options.nowMs ?? Date.now;
  const nowDate = options.nowDate ?? (() => new Date());
  const startedAt = nowMs();
  const logger = options.logger ?? console;
  const definition = getApiRouteObservability(route, request?.method);
  let finished = false;
  const finish = (outcome, completion, status = 500) => {
    if (finished) {
      return;
    }
    finished = true;
    logApiCompletion(
      {
        completion,
        durationMs: Math.max(0, nowMs() - startedAt),
        errorCategory: status >= 500 || outcome === "error" ? definition.errorCategory : null,
        family: definition.family,
        method: definition.method,
        outcome,
        requestId,
        responseMode: definition.responseMode,
        route: definition.route,
        status,
      },
      logger,
      nowDate
    );
  };
  try {
    const response = await handler({ request, requestId });
    const observedResponse = withRequestId(response, requestId);
    if (definition.responseMode === "stream") {
      return observeStream(observedResponse, (outcome, completion) =>
        finish(outcome, completion, response.status)
      );
    }
    finish("response", "handler_returned", response.status);
    return observedResponse;
  } catch (error) {
    finish("error", "handler_failed");
    throw error;
  }
}
