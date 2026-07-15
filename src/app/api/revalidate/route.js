import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { timingSafeSecretEqual } from "@/lib/serverSecret";

const ALLOWED_TAGS = new Set(["blog", "gallery", "spiritual"]);

/**
 * Sanity webhook target: POST JSON `{ "tag": "gallery" | "blog" | "spiritual" }`
 * Header: `x-sanity-revalidate-secret: <SANITY_REVALIDATE_SECRET>`
 */
export async function handleSanityRevalidation(request, revalidate = revalidateTag) {
  const configuredSecret = process.env.SANITY_REVALIDATE_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ message: "Revalidation unavailable" }, { status: 503 });
  }

  const secret = request.headers.get("x-sanity-revalidate-secret");
  if (!timingSafeSecretEqual(configuredSecret, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }

  const tag = typeof body?.tag === "string" ? body.tag.trim() : "";
  if (!ALLOWED_TAGS.has(tag)) {
    return NextResponse.json({ message: "Invalid tag" }, { status: 400 });
  }

  await revalidate(tag, "max");
  return NextResponse.json({ revalidated: true, tag });
}

export async function POST(request) {
  return await handleSanityRevalidation(request);
}
