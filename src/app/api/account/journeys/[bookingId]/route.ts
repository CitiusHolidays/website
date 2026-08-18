import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

async function handleJourneyDetail(
  _request: Request,
  context: RouteContext<"/api/account/journeys/[bookingId]">
) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { bookingId } = await context.params;
  const referenceNow = Date.now();
  const detail = await fetchAuthQuery(
    anyApi.bookings.getMyJourneyDetail,
    { bookingId, referenceNow },
    { token }
  );
  if (!detail) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }
  return NextResponse.json(detail, {
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/account/journeys/[bookingId]">
) {
  return await withApiRequestLogging(request, "/api/account/journeys/[bookingId]", () =>
    handleJourneyDetail(request, context)
  );
}
