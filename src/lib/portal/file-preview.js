import { assertSafeImagePreview } from "@convex/crm/lib/documentPreviewImageSafety";
import { anyApi } from "convex/server";
import { fetchAuthAction, fetchAuthMutation, getToken } from "@/lib/auth-server";
import { portalFileErrorResponse, portalFileResponse } from "@/lib/portal/file-response";

const SAFE_WARNING_CODE = /^[a-z0-9_-]+$/i;
const TRAILING_SLASH_PATTERN = /\/$/;

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Content-Type", "application/json");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(payload), { ...init, headers });
}

export function isPortalFilePreviewRequest(request) {
  return new URL(request.url).searchParams.get("mode") === "preview";
}

export function isPortalFileRetryRequest(request) {
  return new URL(request.url).searchParams.get("retry") === "1";
}

export function portalPreviewResultResponse(result) {
  if (result?.status === "preparing") {
    return jsonResponse(
      { status: "preparing" },
      {
        headers: { "Retry-After": "2" },
        status: 202,
      }
    );
  }
  if (result?.status === "unavailable") {
    return jsonResponse(
      {
        canRetry: Boolean(result.canRetry),
        errorCode: result.errorCode || "unsupported",
        status: "unavailable",
      },
      { status: 422 }
    );
  }
  if (result?.status !== "ready") {
    return jsonResponse(
      { error: "Preview is unavailable", status: "unavailable" },
      { status: 404 }
    );
  }
  if (result.previewKind === "image") {
    assertSafeImagePreview(result.bytes, result.mimeType);
  }
  const response = portalFileResponse(
    {
      bytes: result.bytes,
      fileName: result.fileName,
      mimeType: result.mimeType,
    },
    { disposition: "inline" }
  );
  if (response.ok) {
    response.headers.set("X-Document-Preview-Kind", String(result.previewKind || "unsupported"));
    response.headers.set("X-Document-Preview-Generation", String(result.generation || 1));
    const warningCodes = Array.isArray(result.warningCodes)
      ? result.warningCodes.filter((code) => SAFE_WARNING_CODE.test(code)).join(",")
      : "";
    if (warningCodes) {
      response.headers.set("X-Document-Preview-Warnings", warningCodes);
    }
  }
  return response;
}

export function portalPreviewErrorResponse(error) {
  const mapped = portalFileErrorResponse(error);
  if (mapped.status === 429) {
    return mapped;
  }
  let message = "Preview is unavailable. Download remains available.";
  if (mapped.status === 403) {
    message = "You do not have access to preview this file.";
  } else if (mapped.status === 404) {
    message = "This file is no longer available.";
  }
  return jsonResponse({ error: message, status: "unavailable" }, { status: mapped.status });
}

export async function portalPreviewUpstreamResponse(upstream) {
  if (!(upstream?.ok && upstream.body)) {
    let status = 404;
    if (upstream?.status === 403 || upstream?.status === 409) {
      ({ status } = upstream);
    }
    return jsonResponse(
      {
        error:
          status === 403
            ? "You do not have access to preview this file."
            : "This preview is no longer available. Try opening the file again.",
        status: "unavailable",
      },
      { status }
    );
  }
  const contentType = upstream.headers.get("Content-Type") || "application/octet-stream";
  let { body } = upstream;
  if (upstream.headers.get("X-Document-Preview-Kind") === "image") {
    const bytes = await upstream.arrayBuffer();
    assertSafeImagePreview(bytes, contentType);
    body = new Blob([bytes], { type: contentType }).stream();
  }
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of [
    "Content-Disposition",
    "Content-Length",
    "X-Document-Preview-Generation",
    "X-Document-Preview-Kind",
    "X-Document-Preview-Warnings",
  ]) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return new Response(body, { headers, status: 200 });
}

export async function previewPortalFile(
  { retry = false, sourceId, sourceType },
  {
    fetchUpstream = fetch,
    getAuthToken = getToken,
    runAuthAction = fetchAuthAction,
    runAuthMutation = fetchAuthMutation,
    siteUrl: configuredSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  } = {}
) {
  try {
    const token = await getAuthToken();
    if (retry) {
      await runAuthMutation(anyApi.crm.documentPreview.retry, { sourceId, sourceType }, { token });
    }
    const result = await runAuthAction(
      anyApi.crm.documentPreviewActions.getPreviewFile,
      { sourceId, sourceType },
      { token }
    );
    if (result?.status !== "ready") {
      return portalPreviewResultResponse(result);
    }
    const siteUrl = String(configuredSiteUrl || "").replace(TRAILING_SLASH_PATTERN, "");
    if (!(siteUrl && token && result.deliveryToken)) {
      throw new Error("Preview delivery is not configured");
    }
    const upstream = await fetchUpstream(
      `${siteUrl}/portal/document-previews/${encodeURIComponent(result.deliveryToken)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
      }
    );
    return await portalPreviewUpstreamResponse(upstream);
  } catch (error) {
    return portalPreviewErrorResponse(error);
  }
}
