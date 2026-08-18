import { handler } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const { GET: handleAuthGet, POST: handleAuthPost } = handler;

export async function GET(request, context) {
  return await withApiRequestLogging(request, "/api/auth/[...all]", () =>
    handleAuthGet(request, context)
  );
}

export async function POST(request, context) {
  return await withApiRequestLogging(request, "/api/auth/[...all]", () =>
    handleAuthPost(request, context)
  );
}
