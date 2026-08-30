import { anyApi } from "convex/server";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import type { JsonValue } from "@/lib/jsonValue";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const CONFIRMED_TRIP_PAGE_SIZE = 20;
const MAX_CURSOR_LENGTH = 4096;
const PRIVATE_ACCOUNT_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  vary: "Cookie",
  "x-content-type-options": "nosniff",
} as const;

function privateJson(payload: JsonValue, status = 200) {
  return Response.json(payload, { headers: PRIVATE_ACCOUNT_HEADERS, status });
}

async function handleConfirmedTrips(request: Request, supportReference: string) {
  try {
    const token = await getToken({ correlationId: supportReference });
    if (!token) {
      return privateJson({ error: "Authentication required" }, 401);
    }
    const cursor = new URL(request.url).searchParams.get("cursor");
    if (cursor !== null && (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH)) {
      return privateJson({ error: "Invalid confirmed-trip cursor" }, 400);
    }
    const page = await fetchAuthQuery(
      anyApi.customerConfirmedTrips.getMyConfirmedTripPackets,
      { paginationOpts: { cursor, numItems: CONFIRMED_TRIP_PAGE_SIZE } },
      { token }
    );
    return privateJson(page);
  } catch {
    return privateJson({ error: "Confirmed trips could not be loaded. Please try again." }, 503);
  }
}

export async function GET(request: Request) {
  return await withApiRequestLogging(
    request,
    "/api/account/confirmed-trips",
    ({ requestId }: { requestId: string }) => handleConfirmedTrips(request, requestId)
  );
}
