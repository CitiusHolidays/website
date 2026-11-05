import { withApiRequestLogging } from "@/lib/observability/api-log";
import { handleOfficeCheckIn } from "@/lib/officeCheckIn/gateway";

export async function POST(request: Request) {
  return await withApiRequestLogging(request, "/api/portal/office-check-in", () =>
    handleOfficeCheckIn(request)
  );
}
