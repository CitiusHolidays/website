import { NextResponse } from "next/server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

export function handleLegacyContactRequest() {
  return NextResponse.json(
    {
      error:
        "This contact endpoint has moved. Submit through the current Website enquiry form so the request is recorded in Citius Connect.",
    },
    { status: 410 }
  );
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/contact", () =>
    Promise.resolve(handleLegacyContactRequest())
  );
}
