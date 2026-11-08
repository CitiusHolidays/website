import {
  androidAssetLinks,
  associationResponse,
} from "@/components/customerApp/appLinkAssociation";

export function GET() {
  return associationResponse(androidAssetLinks(process.env));
}
