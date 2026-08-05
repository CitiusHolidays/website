import { anyApi } from "convex/server";
import { downloadPortalFile } from "@/lib/portal/file-download";

export async function GET(_request, { params }) {
  const { proposalId } = await params;
  return await downloadPortalFile({
    action: anyApi.crm.proposalAttachmentActions.getFinalizedPdfFile,
    args: {
      proposalId,
    },
  });
}
