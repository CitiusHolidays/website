import { anyApi } from "convex/server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { downloadPortalFile } from "@/lib/portal/file-download";
import {
  isPortalFilePreviewRequest,
  isPortalFileRetryRequest,
  previewPortalFile,
} from "@/lib/portal/file-preview";

export async function GET(request, { params }) {
  return await withApiRequestLogging(request, "/api/portal/files/commercial/[fileId]", async () => {
    const { fileId } = await params;
    if (isPortalFilePreviewRequest(request)) {
      return await previewPortalFile({
        retry: isPortalFileRetryRequest(request),
        sourceId: fileId,
        sourceType: "commercialFile",
      });
    }
    return await downloadPortalFile({
      action: anyApi.crm.commercialFileActions.getDownloadFile,
      args: { fileId },
    });
  });
}
