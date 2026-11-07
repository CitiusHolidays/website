import { anyApi } from "convex/server";
import { fetchAuthAction, getToken } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { downloadPortalFile } from "@/lib/portal/file-download";
import { portalFileErrorResponse, portalFileResponse } from "@/lib/portal/file-response";

/** Feedback photo previews never change once saved, so a day in this browser is safe. */
const PHOTO_PREVIEW_CACHE_SECONDS = 86_400;

export async function GET(request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  return await withApiRequestLogging(request, "/api/portal/files/post-tour/[photoId]", async () => {
    const { photoId } = await params;
    const search = new URL(request.url).searchParams;
    if (search.get("inline") === "1") {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("UNAUTHORIZED");
        }
        const file = await fetchAuthAction(
          search.get("size") === "display"
            ? anyApi.crm.postTourFeedbackActions.getPhotoDisplay
            : anyApi.crm.postTourFeedbackActions.getPhotoThumbnail,
          { photoId },
          { token }
        );
        return portalFileResponse(file, {
          disposition: "inline",
          privateCacheSeconds: PHOTO_PREVIEW_CACHE_SECONDS,
        });
      } catch (error) {
        const response = portalFileErrorResponse(error);
        response.headers.set("Cache-Control", "private, no-store, max-age=0");
        return response;
      }
    }
    return await downloadPortalFile({
      action: anyApi.crm.postTourFeedbackActions.getPhotoFile,
      args: { photoId },
    });
  });
}
