import { anyApi } from "convex/server";
import { downloadPortalFile } from "@/lib/portal/file-download";

export async function GET(_request, { params }) {
  const { fileId } = await params;
  return await downloadPortalFile({
    action: anyApi.crm.commercialFileActions.getDownloadFile,
    args: {
      fileId,
    },
  });
}
