import { anyApi } from "convex/server";
import { fetchAuthAction } from "@/lib/auth-server";
import { portalFileErrorResponse, portalFileResponse } from "@/lib/portal/file-response";

export async function GET(_request, { params }) {
  try {
    const { fileId } = await params;
    const file = await fetchAuthAction(anyApi.crm.commercialFileActions.getDownloadFile, {
      fileId,
    });
    return portalFileResponse(file);
  } catch (error) {
    return portalFileErrorResponse(error);
  }
}
