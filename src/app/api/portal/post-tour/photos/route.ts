import { POST_TOUR_PHOTO_MAX_BYTES } from "@convex/lib/postTourFeedbackValidators";
import { anyApi } from "convex/server";
import { fetchAuthQuery, getToken, resolveTrustedAppOrigin } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

async function uploadPhoto(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  try {
    if (origin && origin !== resolveTrustedAppOrigin()) {
      return Response.json({ error: "FORBIDDEN" }, { headers: privateHeaders, status: 403 });
    }
    const token = await getToken();
    if (!token) {
      return Response.json(
        { error: "Sign in to upload photos." },
        { headers: privateHeaders, status: 401 }
      );
    }
    const access = await fetchAuthQuery(anyApi.crm.staff.getMyPortalAccess, {}, { token });
    if (!access?.allowed) {
      return Response.json({ error: "FORBIDDEN" }, { headers: privateHeaders, status: 403 });
    }
    const mimeType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!IMAGE_TYPES.has(mimeType)) {
      return Response.json(
        { error: "Choose a JPEG, PNG or WebP photo." },
        { headers: privateHeaders, status: 400 }
      );
    }
    if (Number(request.headers.get("content-length")) > POST_TOUR_PHOTO_MAX_BYTES) {
      return Response.json(
        { error: "Each photo must be 4 MB or smaller." },
        { headers: privateHeaders, status: 413 }
      );
    }
    const reader = request.body?.getReader();
    if (!reader) {
      return Response.json({ error: "Choose a photo." }, { headers: privateHeaders, status: 400 });
    }
    const chunks: ArrayBuffer[] = [];
    let size = 0;
    try {
      while (true) {
        // biome-ignore lint/performance/noAwaitInLoops: stream reads are sequential so the size limit is enforced before buffering more bytes.
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        size += chunk.value.byteLength;
        if (size > POST_TOUR_PHOTO_MAX_BYTES) {
          await reader.cancel();
          return Response.json(
            { error: "Each photo must be 4 MB or smaller." },
            { headers: privateHeaders, status: 413 }
          );
        }
        chunks.push(new Uint8Array(chunk.value).buffer);
      }
    } finally {
      reader.releaseLock();
    }
    if (size === 0) {
      return Response.json({ error: "Choose a photo." }, { headers: privateHeaders, status: 400 });
    }
    const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!site) {
      return Response.json(
        { error: "Photo uploads are not configured." },
        { headers: privateHeaders, status: 503 }
      );
    }
    const upstream = new URL("/post-tour-feedback/photo", site);
    upstream.searchParams.set("feedbackId", url.searchParams.get("feedbackId") ?? "");
    upstream.searchParams.set("fileName", url.searchParams.get("fileName") ?? "tour-photo");
    const response = await fetch(upstream, {
      body: new Blob(chunks, { type: mimeType }),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": mimeType },
      method: "POST",
      redirect: "error",
    });
    if (!response.ok) {
      return Response.json(
        { error: "Photo upload failed. Your comments are saved. Try again." },
        { headers: privateHeaders, status: response.status }
      );
    }
    return new Response(await response.text(), {
      headers: { ...privateHeaders, "Content-Type": "application/json" },
      status: response.status,
    });
  } catch {
    return Response.json(
      { error: "Photo upload failed. Sign in again or try again." },
      { headers: privateHeaders, status: 502 }
    );
  }
}

export async function POST(request: Request) {
  return await withApiRequestLogging(request, "/api/portal/post-tour/photos", () =>
    uploadPhoto(request)
  );
}
