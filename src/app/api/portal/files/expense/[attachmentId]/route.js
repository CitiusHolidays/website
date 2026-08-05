import { anyApi } from "convex/server";
import { downloadPortalFile } from "@/lib/portal/file-download";

export async function GET(_request, { params }) {
  const { attachmentId } = await params;
  return await downloadPortalFile({
    action: anyApi.crm.expenseAttachmentActions.getDownloadFile,
    args: {
      attachmentId,
    },
  });
}
