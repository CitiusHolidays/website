import {
  TRAVELER_JSON_MAX_BYTES,
  TRAVELER_PHOTO_MAX_BYTES,
} from "@convex/lib/travelerFeedbackValidators";
import { z } from "zod";
import { resolveTrustedAppOrigin } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const OPERATIONS = new Set(["form", "submit", "photo"]);
const BEARER = /^Bearer [A-Za-z0-9_-]{43}$/;
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
function failure(error: string, status: number) {
  return Response.json({ error }, { headers: privateHeaders, status });
}
async function boundedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) {
    return new Blob();
  }
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    while (true) {
      // biome-ignore lint/performance/noAwaitInLoops: Read sequentially to enforce the byte limit before buffering the next chunk.
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(new Uint8Array(chunk.value).buffer);
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks);
}
async function forwardFeedback(request: Request, operation: string) {
  if (!OPERATIONS.has(operation)) {
    return failure("This form is unavailable.", 404);
  }
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== resolveTrustedAppOrigin()) {
      return failure("This form is unavailable.", 403);
    }
    const authorization = request.headers.get("authorization") ?? "";
    if (!BEARER.test(authorization)) {
      return failure("Open the full feedback link sent by your tour team.", 410);
    }
    const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!site) {
      return failure("Feedback is temporarily unavailable. Try again later.", 503);
    }
    const maxBytes = operation === "photo" ? TRAVELER_PHOTO_MAX_BYTES : TRAVELER_JSON_MAX_BYTES;
    if (Number(request.headers.get("content-length")) > maxBytes) {
      return failure("The upload is too large.", 413);
    }
    const body = await boundedBody(request, maxBytes);
    if (!body) {
      return failure("The upload is too large.", 413);
    }
    const headers = new Headers({
      Authorization: authorization,
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    });
    if (operation === "photo") {
      for (const name of ["X-Feedback-Response", "X-Feedback-Category", "X-File-Name"]) {
        const value = request.headers.get(name);
        if (value) {
          headers.set(name, value);
        }
      }
    }
    const upstream = await fetch(new URL(`/traveler-feedback/${operation}`, site), {
      body,
      headers,
      method: "POST",
      redirect: "error",
    });
    if (!upstream.headers.get("content-type")?.includes("application/json")) {
      return failure("Feedback is temporarily unavailable. Try again.", 502);
    }
    if (!upstream.ok) {
      const payload = z.object({ error: z.string().max(500) }).parse(await upstream.json());
      return failure(payload.error, upstream.status);
    }
    return new Response(await upstream.text(), {
      headers: { ...privateHeaders, "Content-Type": "application/json" },
      status: upstream.status,
    });
  } catch {
    return failure("Feedback is temporarily unavailable. Your text is still here. Try again.", 502);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string }> }
) {
  return await withApiRequestLogging(request, "/api/tour-feedback/[operation]", async () =>
    forwardFeedback(request, (await params).operation)
  );
}
