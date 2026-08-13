import { anyApi } from "convex/server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { downloadPortalFile } from "@/lib/portal/file-download";

export async function GET(request, { params }) {
  return await withApiRequestLogging(
    request,
    "/api/portal/files/proposal-finalized/[proposalId]",
    async () => {
      const { proposalId } = await params;
      return await downloadPortalFile({
        action: anyApi.crm.proposalAttachmentActions.getFinalizedPdfFile,
        args: { proposalId },
      });
    }
  );
}
