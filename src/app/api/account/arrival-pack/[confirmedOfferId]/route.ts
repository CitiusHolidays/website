import { anyApi } from "convex/server";
import {
  type ArrivalPackPacket,
  renderArrivalPackDocument,
} from "@/lib/account/arrivalPackDocument";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";

const ARRIVAL_PACK_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
} as const;

function privateJson(payload: { error: string }, status: number) {
  return Response.json(payload, { headers: PRIVATE_HEADERS, status });
}

async function handleArrivalPack(
  _request: Request,
  { params }: { params: Promise<{ confirmedOfferId: string }> }
) {
  try {
    const token = await getToken();
    if (!token) {
      return privateJson({ error: "Authentication required" }, 401);
    }
    const { confirmedOfferId } = await params;
    if (!ARRIVAL_PACK_ID.test(confirmedOfferId)) {
      return privateJson({ error: "Arrival Pack not found" }, 404);
    }
    // SAFETY: The called Convex query has an exact return validator for this Account-owned packet;
    // the document renderer separately allowlists every emitted field.
    const packet = (await fetchAuthQuery(
      anyApi.customerConfirmedTrips.getMyConfirmedTripPacket,
      { confirmedOfferId },
      { token }
    )) as ArrivalPackPacket | null;
    if (!packet) {
      return privateJson({ error: "Arrival Pack not found" }, 404);
    }
    const document = renderArrivalPackDocument(packet, Date.now());
    return new Response(document, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Disposition":
          "attachment; filename=\"citius-arrival-pack.html\"; filename*=UTF-8''citius-arrival-pack.html",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "DENY",
      },
    });
  } catch {
    return privateJson({ error: "Arrival Pack could not be prepared. Please try again." }, 400);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ confirmedOfferId: string }> }
) {
  return await withApiRequestLogging(request, "/api/account/arrival-pack/[confirmedOfferId]", () =>
    handleArrivalPack(request, context)
  );
}
