import { describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { type BookingEmailContent, renderBookingEmail } from "./bookingEmailContent";

const ACCOUNT_URL = "https://citius.example/account";

const confirmation: BookingEmailContent = {
  booking: {
    amountMinor: 12_500_000,
    currency: "INR",
    endDate: "2027-01-18",
    paymentReference: "pay_Fixture123",
    reference: "k57booking0001",
    startDate: "2027-01-10",
    travellers: 2,
    tripName: "Kailash Mansarovar Yatra",
  },
  invoice: { invoiceNumber: "WEB/2627/00007", status: "issued" },
  kind: "booking_confirmation",
  recipientName: "Aria Sen",
  refund: null,
};

const WHITESPACE = /\s+/g;
const PROMOTIONAL_WORDS = /offer|discount|newsletter|subscribe|deal/;

/** Plain-text bodies wrap at 80 columns; compare the words, not the line breaks. */
function words(text: string) {
  return text.replace(WHITESPACE, " ");
}

function rowsOf(html: string) {
  const dom = new JSDOM(html);
  const rows = [
    ...dom.window.document.querySelectorAll('table[data-text-format="dataTable"] tr'),
  ].map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? ""));
  const links = [...dom.window.document.querySelectorAll("a")].map((link) => link.href);
  dom.window.close();
  return { links, rows };
}

describe("booking confirmation email", () => {
  test("states the booking, payment and invoice facts and links to the account", async () => {
    const message = await renderBookingEmail(confirmation, { accountUrl: ACCOUNT_URL });
    expect(message.subject).toBe("Booking confirmed: Kailash Mansarovar Yatra");
    const { links, rows } = rowsOf(message.html);
    expect(rows).toEqual([
      ["Booking ID", "k57booking0001"],
      ["Trip", "Kailash Mansarovar Yatra"],
      ["Travel dates", "10 Jan 2027 – 18 Jan 2027"],
      ["Travellers", "2"],
      ["Amount paid", "₹1,25,000.00"],
      ["Payment reference", "pay_Fixture123"],
      ["Tax invoice", "WEB/2627/00007"],
    ]);
    expect(links).toEqual([ACCOUNT_URL, ACCOUNT_URL]);
    expect(words(message.text)).toContain("Hi Aria Sen,");
    expect(words(message.text)).toContain("What happens next");
    expect(words(message.text)).toContain("info@citiusholidays.com");
    expect(words(message.text)).toContain("+91 98304 28789");
    expect(words(message.text)).toContain("download it from your Citius account");
  });

  test("says the invoice will follow when it is not issued yet", async () => {
    const message = await renderBookingEmail(
      { ...confirmation, invoice: { status: "preparing" } },
      { accountUrl: ACCOUNT_URL }
    );
    expect(rowsOf(message.html).rows).toContainEqual(["Tax invoice", "Being prepared"]);
    expect(words(message.text)).toContain("We will email you when your GST tax invoice is ready");
  });

  test("formats foreign-currency payments in their own currency", async () => {
    const message = await renderBookingEmail(
      {
        ...confirmation,
        booking: { ...confirmation.booking, amountMinor: 150_000, currency: "USD" },
      },
      { accountUrl: ACCOUNT_URL }
    );
    expect(rowsOf(message.html).rows).toContainEqual(["Amount paid", "USD 1,500.00"]);
  });

  test("contains no marketing or promotional content", async () => {
    const message = await renderBookingEmail(confirmation, { accountUrl: ACCOUNT_URL });
    expect(words(message.text).toLowerCase()).not.toMatch(PROMOTIONAL_WORDS);
  });
});

describe("refund and invoice-ready emails", () => {
  test("a refund email names the amount, references and the refund timeline", async () => {
    const message = await renderBookingEmail(
      {
        ...confirmation,
        kind: "booking_refund",
        refund: { amountMinor: 12_500_000, reference: "rfnd_Fixture456" },
      },
      { accountUrl: ACCOUNT_URL }
    );
    expect(message.subject).toBe("Refund started: Kailash Mansarovar Yatra");
    expect(rowsOf(message.html).rows).toEqual([
      ["Booking ID", "k57booking0001"],
      ["Trip", "Kailash Mansarovar Yatra"],
      ["Refund amount", "₹1,25,000.00"],
      ["Refund reference", "rfnd_Fixture456"],
      ["Payment reference", "pay_Fixture123"],
    ]);
    expect(words(message.text)).toContain("original payment method");
    expect(words(message.text)).toContain("7–14 working days");
  });

  test("an invoice-ready email names the invoice and where to download it", async () => {
    const message = await renderBookingEmail(
      { ...confirmation, kind: "booking_invoice_ready" },
      { accountUrl: ACCOUNT_URL }
    );
    expect(message.subject).toBe("Your tax invoice WEB/2627/00007");
    expect(rowsOf(message.html).rows).toEqual([
      ["Invoice number", "WEB/2627/00007"],
      ["Booking ID", "k57booking0001"],
      ["Trip", "Kailash Mansarovar Yatra"],
      ["Amount paid", "₹1,25,000.00"],
    ]);
  });

  test("an invoice-ready email cannot be rendered without an issued invoice", async () => {
    await expect(
      renderBookingEmail(
        { ...confirmation, invoice: { status: "preparing" }, kind: "booking_invoice_ready" },
        { accountUrl: ACCOUNT_URL }
      )
    ).rejects.toThrow("BOOKING_EMAIL_INVOICE_NOT_ISSUED");
  });
});
