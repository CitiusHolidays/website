import { revalidateTag } from "next/cache";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { timingSafeSecretEqual } from "@/lib/serverSecret";

const ALLOWED_TAGS = new Set(["blog", "gallery", "spiritual"]);

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

/**
 * Sanity webhook target: POST JSON `{ "tag": "gallery" | "blog" | "spiritual" }`
 * Header: `x-sanity-revalidate-secret: <SANITY_REVALIDATE_SECRET>`
 */
export async function handleSanityRevalidation(request, revalidate = revalidateTag) {
  const configuredSecret = process.env.SANITY_REVALIDATE_SECRET;
  if (!configuredSecret) {
    return jsonResponse({ message: "Revalidation unavailable" }, 503);
  }

  const secret = request.headers.get("x-sanity-revalidate-secret");
  if (!timingSafeSecretEqual(configuredSecret, secret)) {
    return jsonResponse({ message: "Unauthorized" }, 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }

  const tag = typeof body?.tag === "string" ? body.tag.trim() : "";
  if (!ALLOWED_TAGS.has(tag)) {
    return jsonResponse({ message: "Invalid tag" }, 400);
  }

  await revalidate(tag, "max");
  return jsonResponse({ revalidated: true, tag }, 200);
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/revalidate", () =>
    handleSanityRevalidation(request)
  );
}
