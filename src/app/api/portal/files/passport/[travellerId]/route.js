import { anyApi } from "convex/server";
import { downloadPortalFile } from "@/lib/portal/file-download";

export async function GET(_request, { params }) {
  const { travellerId } = await params;
  return await downloadPortalFile({
    action: anyApi.crm.passportActions.getPassportFile,
    args: {
      travellerId,
    },
  });
}
