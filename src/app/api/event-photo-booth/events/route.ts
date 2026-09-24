import { handleBoothMetrics } from "@/lib/eventPhotoBooth/metricsGateway";
import { withApiRequestLogging } from "@/lib/observability/api-log";

export async function POST(request: Request) {
  return await withApiRequestLogging(request, "/api/event-photo-booth/events", () =>
    handleBoothMetrics(request)
  );
}
