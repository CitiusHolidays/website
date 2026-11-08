import {
  appleAppSiteAssociation,
  associationResponse,
} from "@/components/customerApp/appLinkAssociation";

export function GET() {
  return associationResponse(appleAppSiteAssociation(process.env));
}
