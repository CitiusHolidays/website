import { getToken } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const TRAILING_SLASH = /\/$/;

export type ExportProxyFetch = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

interface ExportProxyDependencies {
  fetchUpstream: ExportProxyFetch;
  getAuthToken: () => Promise<string | null>;
}

type ExportProxyOptions = Partial<ExportProxyDependencies>;

function privateJson(error: string, status: number, headers: HeadersInit = {}) {
  return Response.json(
    { error },
    {
      headers: { "Cache-Control": "private, no-store, max-age=0", ...headers },
      status,
    }
  );
}

function unavailableStatus(status: number) {
  if (status === 429) {
    return 429;
  }
  if (status === 403) {
    return 403;
  }
  return 404;
}

export async function handlePortalExportDownload(
  params: Promise<{ operationId: string }>,
  options: ExportProxyOptions = {}
) {
  const token = await (options.getAuthToken ?? getToken)();
  if (!token) {
    return privateJson("Authentication required", 401);
  }
  const siteUrl = String(process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "").replace(TRAILING_SLASH, "");
  if (!siteUrl) {
    return privateJson("Export service is not configured", 503);
  }
  const { operationId } = await params;
  let upstream: Response;
  try {
    upstream = await (options.fetchUpstream ?? fetch)(
      `${siteUrl}/portal/exports/${encodeURIComponent(String(operationId || ""))}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
      }
    );
  } catch {
    return privateJson("Export download is temporarily unavailable", 503);
  }
  if (!(upstream.ok && upstream.body)) {
    const retryAfter = upstream.headers.get("Retry-After");
    return privateJson(
      upstream.status === 403 ? "Export access denied" : "Export file is not available",
      unavailableStatus(upstream.status),
      retryAfter ? { "Retry-After": retryAfter } : {}
    );
  }
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type":
      upstream.headers.get("Content-Type") ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["Content-Disposition", "Content-Length"]) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return new Response(upstream.body, { headers, status: 200 });
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/portal/exports/[operationId]">
) {
  return await withApiRequestLogging(request, "/api/portal/exports/[operationId]", () =>
    handlePortalExportDownload(params)
  );
}
