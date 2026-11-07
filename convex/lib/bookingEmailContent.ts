import { renderTransactionalEmail, type TransactionalEmailContent } from "./transactionalEmail";

/**
 * Customer-facing booking email copy. Plain, factual and transactional: no
 * offers, promotions or newsletter content belong in these messages.
 */

export type BookingEmailKind = "booking_confirmation" | "booking_invoice_ready" | "booking_refund";

export const BOOKING_SUPPORT_EMAIL = "info@citiusholidays.com";
export const BOOKING_SUPPORT_PHONE = "+91 98304 28789";

export interface BookingEmailContent {
  booking: {
    amountMinor: number;
    currency: string;
    endDate: string;
    paymentReference: string;
    reference: string;
    startDate: string;
    travellers: number;
    tripName: string;
  };
  invoice: { invoiceNumber: string; status: "issued" } | { status: "preparing" } | null;
  kind: BookingEmailKind;
  recipientName: string;
  refund: { amountMinor?: number; reference?: string } | null;
}

export interface RenderedBookingEmail {
  html: string;
  subject: string;
  text: string;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}/;
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const INR_FORMAT = new Intl.NumberFormat("en-IN", { currency: "INR", style: "currency" });
const TWO_DECIMAL_FORMAT = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Format an amount held in the currency's minor unit (paise for INR). */
export function formatBookingAmount(amountMinor: number, currency: string) {
  const major = amountMinor / 100;
  if (currency === "INR") {
    return INR_FORMAT.format(major);
  }
  return `${currency} ${TWO_DECIMAL_FORMAT.format(major)}`;
}

function formatDate(value: string) {
  const match = value.match(DATE_ONLY);
  return match ? dateFormat.format(new Date(`${match[0]}T00:00:00Z`)) : "";
}

function travelDates(startDate: string, endDate: string) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (start && end && start !== end) {
    return `${start} – ${end}`;
  }
  return start || end;
}

const contactLine = `Questions about this booking? Email ${BOOKING_SUPPORT_EMAIL} or call ${BOOKING_SUPPORT_PHONE} and quote your booking ID.`;

function invoiceLine(invoice: BookingEmailContent["invoice"]) {
  if (invoice?.status === "issued") {
    return {
      paragraph: `Your GST tax invoice ${invoice.invoiceNumber} is ready. You can download it from your Citius account.`,
      value: invoice.invoiceNumber,
    };
  }
  if (invoice?.status === "preparing") {
    return {
      paragraph:
        "We will email you when your GST tax invoice is ready to download from your Citius account.",
      value: "Being prepared",
    };
  }
  return {
    paragraph: `For your tax invoice, contact our accounts team at ${BOOKING_SUPPORT_EMAIL}.`,
    value: "",
  };
}

function confirmationEmail(content: BookingEmailContent, accountUrl: string) {
  const { booking } = content;
  const invoice = invoiceLine(content.invoice);
  return {
    subject: `Booking confirmed: ${booking.tripName}`,
    template: {
      action: { href: accountUrl, label: "View your booking" },
      context: "Citius Holidays · Booking confirmation",
      details: {
        rows: [
          { label: "Booking ID", value: booking.reference },
          { label: "Trip", value: booking.tripName },
          { label: "Travel dates", value: travelDates(booking.startDate, booking.endDate) },
          { label: "Travellers", value: String(booking.travellers) },
          {
            label: "Amount paid",
            value: formatBookingAmount(booking.amountMinor, booking.currency),
          },
          { label: "Payment reference", value: booking.paymentReference },
          { label: "Tax invoice", value: invoice.value },
        ],
        title: "Booking details",
      },
      footer: contactLine,
      greeting: content.recipientName,
      paragraphs: [
        `We have received your payment. Your booking for ${booking.tripName} is confirmed.`,
        invoice.paragraph,
        "What happens next: our team will contact you before departure with your final itinerary and joining details. Your booking stays available in your Citius account.",
      ],
      title: "Your booking is confirmed",
    },
  };
}

function invoiceReadyEmail(content: BookingEmailContent, accountUrl: string) {
  const { booking, invoice } = content;
  if (invoice?.status !== "issued") {
    throw new Error("BOOKING_EMAIL_INVOICE_NOT_ISSUED");
  }
  return {
    subject: `Your tax invoice ${invoice.invoiceNumber}`,
    template: {
      action: { href: accountUrl, label: "Download from your account" },
      context: "Citius Holidays · Tax invoice",
      details: {
        rows: [
          { label: "Invoice number", value: invoice.invoiceNumber },
          { label: "Booking ID", value: booking.reference },
          { label: "Trip", value: booking.tripName },
          {
            label: "Amount paid",
            value: formatBookingAmount(booking.amountMinor, booking.currency),
          },
        ],
        title: "Invoice details",
      },
      footer: contactLine,
      greeting: content.recipientName,
      paragraphs: [
        `The GST tax invoice for your booking for ${booking.tripName} is ready. Sign in to your Citius account to download it.`,
      ],
      title: "Your tax invoice is ready",
    },
  };
}

function refundEmail(content: BookingEmailContent, accountUrl: string) {
  const { booking, refund } = content;
  const refundAmount =
    refund?.amountMinor === undefined
      ? ""
      : formatBookingAmount(refund.amountMinor, booking.currency);
  return {
    subject: `Refund started: ${booking.tripName}`,
    template: {
      action: { href: accountUrl, label: "View your booking" },
      context: "Citius Holidays · Refund",
      details: {
        rows: [
          { label: "Booking ID", value: booking.reference },
          { label: "Trip", value: booking.tripName },
          { label: "Refund amount", value: refundAmount },
          { label: "Refund reference", value: refund?.reference ?? "" },
          { label: "Payment reference", value: booking.paymentReference },
        ],
        title: "Refund details",
      },
      footer: contactLine,
      greeting: content.recipientName,
      paragraphs: [
        `We have started a refund for your booking for ${booking.tripName}.`,
        "The money goes back to your original payment method. Refunds usually reach your account within 7–14 working days, depending on your bank.",
      ],
      title: "Your refund has started",
    },
  };
}

const BUILDERS = {
  booking_confirmation: confirmationEmail,
  booking_invoice_ready: invoiceReadyEmail,
  booking_refund: refundEmail,
} satisfies Record<
  BookingEmailKind,
  (
    content: BookingEmailContent,
    accountUrl: string
  ) => { subject: string; template: TransactionalEmailContent }
>;

export async function renderBookingEmail(
  content: BookingEmailContent,
  options: { accountUrl: string }
): Promise<RenderedBookingEmail> {
  const { subject, template } = BUILDERS[content.kind](content, options.accountUrl);
  const rendered = await renderTransactionalEmail(template);
  return { html: rendered.html, subject, text: rendered.text };
}
