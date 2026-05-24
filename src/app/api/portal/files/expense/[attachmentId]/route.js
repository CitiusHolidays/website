import { anyApi } from "convex/server";
import { fetchAuthAction } from "@/lib/auth-server";
import { portalFileErrorResponse, portalFileResponse } from "@/lib/portal/file-response";

export async function GET(_request, { params }) {
  try {
    const { attachmentId } = await params;
    const file = await fetchAuthAction(anyApi.crm.expenseAttachmentActions.getDownloadFile, {
      attachmentId,
    });
    return portalFileResponse(file);
  } catch (error) {
    return portalFileErrorResponse(error);
  }
}
