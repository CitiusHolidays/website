import { withApiRequestLogging } from "@/lib/observability/api-log";

const RETIRED_JOURNEY_PLANNER_MESSAGE =
  "The Sacred Bharat Journey Planner has been retired. Contact Citius Holidays for pilgrimage planning help.";

export function handleRetiredJourneyPlannerRequest() {
  return Response.json({ error: RETIRED_JOURNEY_PLANNER_MESSAGE }, { status: 410 });
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/sacred-bharat/journey-planner", () =>
    Promise.resolve(handleRetiredJourneyPlannerRequest())
  );
}
