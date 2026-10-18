import { anyApi } from "convex/server";
import { fetchAuthAction } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { downloadPortalFile } from "@/lib/portal/file-download";
import { portalFileErrorResponse, portalFileResponse } from "@/lib/portal/file-response";

export async function GET(request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  return await withApiRequestLogging(
    request,
    "/api/portal/files/traveler-feedback/[photoId]",
    async () => {
      const { photoId } = await params;
      if (new URL(request.url).searchParams.get("inline") === "1") {
        try {
          const file = await fetchAuthAction(anyApi.crm.travelerFeedbackActions.getPhotoThumbnail, {
            photoId,
          });
          return portalFileResponse(file, { disposition: "inline" });
        } catch (error) {
          const response = portalFileErrorResponse(error);
          response.headers.set("Cache-Control", "private, no-store, max-age=0");
          return response;
        }
      }
      return await downloadPortalFile({
        action: anyApi.crm.travelerFeedbackActions.getPhotoFile,
        args: { photoId },
      });
    }
  );
}
