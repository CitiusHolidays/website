import { NextResponse } from "next/server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const TARGET_ID_PATTERNS = {
  development: /^development-[A-Za-z0-9._:+-]+$/,
  preview: /^preview-[A-Za-z0-9._:+-]+$/,
} as const;

function handleE2eIdentity() {
  const target = process.env.E2E_PROVISIONING_TARGET;
  const id = process.env.E2E_TARGET_ID;
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (
    process.env.VERCEL_ENV === "production" ||
    !(target === "development" || target === "preview") ||
    !id ||
    !TARGET_ID_PATTERNS[target].test(id) ||
    !siteUrl
  ) {
    return new NextResponse(null, { status: 404 });
  }
  let convexSiteOrigin: string;
  try {
    convexSiteOrigin = new URL(siteUrl).origin;
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json(
    { convexSiteOrigin, id, target },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

export async function GET(request: Request) {
  return await withApiRequestLogging(request, "/api/e2e/identity", () =>
    Promise.resolve(handleE2eIdentity())
  );
}
