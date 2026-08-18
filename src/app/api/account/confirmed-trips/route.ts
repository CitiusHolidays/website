import { anyApi } from "convex/server";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const CONFIRMED_TRIP_PAGE_SIZE = 20;
const MAX_CURSOR_LENGTH = 4096;

async function handleConfirmedTrips(request: Request) {
  const token = await getToken();
  if (!token) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor !== null && (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH)) {
    return Response.json({ error: "Invalid confirmed-trip cursor" }, { status: 400 });
  }
  try {
    const page = await fetchAuthQuery(
      anyApi.customerConfirmedTrips.getMyConfirmedTripPackets,
      { paginationOpts: { cursor, numItems: CONFIRMED_TRIP_PAGE_SIZE } },
      { token }
    );
    return Response.json(page, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "Confirmed trips could not be loaded. Please try again." },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  return await withApiRequestLogging(request, "/api/account/confirmed-trips", () =>
    handleConfirmedTrips(request)
  );
}
