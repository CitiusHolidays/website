import { isRuntimeObject, isRuntimeString } from "@/lib/runtimeValues";
import {
  OFFICE_CHECK_IN_ERROR_CODES,
  OFFICE_CHECK_IN_PATH,
  type OfficeCheckInRequest,
  type OfficeCheckInResponse,
} from "./contracts";

function unavailable(): OfficeCheckInResponse {
  return { code: "UNAVAILABLE", error: "Check-in is unavailable.", ok: false };
}

/** Reads the route's JSON body without trusting its shape. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- This is the parser at the fetch I/O boundary; it validates every field before use.
export function parseOfficeCheckInResponse(value: unknown): OfficeCheckInResponse {
  if (!isRuntimeObject(value)) {
    return unavailable();
  }
  if ("ok" in value && value.ok === true) {
    return { ok: true, replayed: "replayed" in value && value.replayed === true };
  }
  const code = "code" in value ? value.code : undefined;
  const errorCode = OFFICE_CHECK_IN_ERROR_CODES.find((candidate) => candidate === code);
  if (!errorCode) {
    return unavailable();
  }
  const error = "error" in value && isRuntimeString(value.error) ? value.error : "";
  return { code: errorCode, error, ok: false };
}

/**
 * Sends a clock-in or clock-out to the portal route. The body carries only
 * the action and the location reading: the route reads the client IP from
 * the edge, so the browser never sends one.
 */
export async function submitOfficeCheckIn(
  request: OfficeCheckInRequest,
  fetcher: typeof fetch = fetch
): Promise<OfficeCheckInResponse> {
  const body: OfficeCheckInRequest = { action: request.action, location: request.location };
  try {
    const response = await fetcher(OFFICE_CHECK_IN_PATH, {
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    return parseOfficeCheckInResponse(await response.json().catch(() => null));
  } catch {
    return unavailable();
  }
}
