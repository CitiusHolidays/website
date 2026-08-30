import { anyApi } from "convex/server";
import { createAccountJourneyUrlKey } from "@/lib/accountJourneyUrlKey.server";
import { ACCOUNT_JOURNEY_KEY_PATTERN } from "@/lib/accountUrlState";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import type { JsonValue } from "@/lib/jsonValue";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const ROUTE = "/api/account/journeys/[journeyKey]";
const PRIVATE_HEADERS = { "cache-control": "private, no-store" };

function privateJson(body: JsonValue, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...PRIVATE_HEADERS, ...init.headers },
  });
}

async function handleJourneyDetail(
  _request: Request,
  context: RouteContext<"/api/account/journeys/[journeyKey]">
) {
  const token = await getToken();
  if (!token) {
    return privateJson({ error: "Authentication required" }, { status: 401 });
  }
  const { journeyKey } = await context.params;
  if (!ACCOUNT_JOURNEY_KEY_PATTERN.test(journeyKey)) {
    return privateJson({ error: "Invalid journey link" }, { status: 400 });
  }

  const referenceNow = Date.now();
  const options = { token };
  const authorized = await fetchAuthQuery(
    anyApi.bookings.getMyJourneySummaries,
    { referenceNow },
    options
  );
  const summary = authorized.summaries.find(
    (candidate: { booking: { id: string } }) =>
      createAccountJourneyUrlKey(candidate.booking.id) === journeyKey
  );
  if (!summary) {
    return privateJson({ error: "Journey not found" }, { status: 404 });
  }

  // Resolve authorization again at the detail owner so revocation between the
  // summary and detail reads still wins over the URL selector.
  const detail = await fetchAuthQuery(
    anyApi.bookings.getMyJourneyDetail,
    { bookingId: summary.booking.id, referenceNow },
    options
  );
  if (!detail) {
    return privateJson({ error: "Journey not found" }, { status: 404 });
  }
  return privateJson(detail);
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/account/journeys/[journeyKey]">
) {
  return await withApiRequestLogging(request, ROUTE, () => handleJourneyDetail(request, context));
}
