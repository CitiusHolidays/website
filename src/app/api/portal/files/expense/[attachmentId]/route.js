import { anyApi } from "convex/server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { downloadPortalFile } from "@/lib/portal/file-download";
import {
  isPortalFilePreviewRequest,
  isPortalFileRetryRequest,
  previewPortalFile,
} from "@/lib/portal/file-preview";

export async function GET(request, { params }) {
  return await withApiRequestLogging(
    request,
    "/api/portal/files/expense/[attachmentId]",
    async () => {
      const { attachmentId } = await params;
      if (isPortalFilePreviewRequest(request)) {
        return await previewPortalFile({
          retry: isPortalFileRetryRequest(request),
          sourceId: attachmentId,
          sourceType: "expenseAttachment",
        });
      }
      return await downloadPortalFile({
        action: anyApi.crm.expenseAttachmentActions.getDownloadFile,
        args: { attachmentId },
      });
    }
  );
}
