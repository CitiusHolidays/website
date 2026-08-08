import { getToken } from "@/lib/auth-server";

function privateJson(error, status, headers = {}) {
  return Response.json(
    { error },
    {
      headers: { "Cache-Control": "private, no-store, max-age=0", ...headers },
      status,
    }
  );
}

export async function GET(_request, { params }) {
  const token = await getToken();
  if (!token) {
    return privateJson("Authentication required", 401);
  }
  const siteUrl = String(process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) {
    return privateJson("Export service is not configured", 503);
  }
  const { operationId } = await params;
  let upstream;
  try {
    upstream = await fetch(
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
      upstream.status === 429 ? 429 : upstream.status === 403 ? 403 : 404,
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
