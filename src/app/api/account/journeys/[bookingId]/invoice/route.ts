import type { BookingInvoiceSnapshot } from "@convex/lib/bookingInvoiceValidators";
import { anyApi } from "convex/server";
import { fetchAuthQuery, getToken } from "@/lib/auth-server";
import {
  bookingInvoiceFileName,
  renderBookingInvoicePdf,
} from "@/lib/bookingInvoice/bookingInvoicePdf";
import { withApiRequestLogging } from "@/lib/observability/api-log";

type InvoiceRead = { invoice: BookingInvoiceSnapshot; status: "issued" } | { status: "preparing" };

const PRIVATE = { "cache-control": "private, no-store" };

/**
 * Download the GST tax invoice for one of the signed-in customer's bookings.
 * Convex decides ownership; any booking the caller does not own is a 404.
 */
async function handleInvoiceDownload(
  _request: Request,
  context: RouteContext<"/api/account/journeys/[bookingId]/invoice">
) {
  const token = await getToken();
  if (!token) {
    return Response.json({ error: "Authentication required" }, { headers: PRIVATE, status: 401 });
  }
  const { bookingId } = await context.params;
  let result: InvoiceRead | null;
  try {
    result = await fetchAuthQuery(
      anyApi.bookingInvoices.getMyBookingInvoice,
      { bookingId },
      { token }
    );
  } catch {
    return Response.json(
      { error: "The invoice could not be loaded. Please try again." },
      { headers: PRIVATE, status: 503 }
    );
  }
  if (!result) {
    return Response.json({ error: "Invoice not found" }, { headers: PRIVATE, status: 404 });
  }
  if (result.status !== "issued") {
    return Response.json(
      { error: "Your tax invoice is still being prepared." },
      { headers: PRIVATE, status: 409 }
    );
  }
  const pdf = renderBookingInvoicePdf(result.invoice);
  return new Response(pdf, {
    headers: {
      ...PRIVATE,
      "content-disposition": `attachment; filename="${bookingInvoiceFileName(result.invoice.invoiceNumber)}"`,
      "content-type": "application/pdf",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/account/journeys/[bookingId]/invoice">
) {
  return await withApiRequestLogging(request, "/api/account/journeys/[bookingId]/invoice", () =>
    handleInvoiceDownload(request, context)
  );
}
