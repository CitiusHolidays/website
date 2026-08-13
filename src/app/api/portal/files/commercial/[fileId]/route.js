import { anyApi } from "convex/server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { downloadPortalFile } from "@/lib/portal/file-download";

export async function GET(request, { params }) {
  return await withApiRequestLogging(request, "/api/portal/files/commercial/[fileId]", async () => {
    const { fileId } = await params;
    return await downloadPortalFile({
      action: anyApi.crm.commercialFileActions.getDownloadFile,
      args: { fileId },
    });
  });
}
