import { NextResponse } from "next/server";

const TARGET_ID_PATTERNS = {
  development: /^development-[A-Za-z0-9._:+-]+$/,
  preview: /^preview-[A-Za-z0-9._:+-]+$/,
} as const;

export function GET() {
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
