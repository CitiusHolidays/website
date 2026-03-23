import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Sanity webhook target: POST JSON `{ "tag": "gallery" | "blog" | "spiritual" }`
 * Header: `x-sanity-revalidate-secret: <SANITY_REVALIDATE_SECRET>`
 */
export async function POST(request) {
  const secret = request.headers.get("x-sanity-revalidate-secret");
  if (!secret || secret !== process.env.SANITY_REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }

  const tag = typeof body?.tag === "string" ? body.tag.trim() : "";
  if (!tag) {
    return NextResponse.json({ message: "Missing tag" }, { status: 400 });
  }

  await revalidateTag(tag, "max");
  return NextResponse.json({ revalidated: true, tag });
}
