import type { BookingInvoiceSnapshot } from "@convex/lib/bookingInvoiceValidators";

/**
 * Render an issued booking tax invoice as a one-page A4 PDF.
 *
 * The writer is deliberately small and dependency-free: the standard Helvetica
 * fonts, WinAnsi text, ruled lines and nothing else. Output is deterministic for
 * a given invoice, so the same issued invoice always downloads identically.
 * Characters outside WinAnsi (for example Devanagari names) print as "?".
 */

export type BookingInvoiceDocument = BookingInvoiceSnapshot;

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const RIGHT = PAGE_WIDTH - MARGIN;
const COLUMN = 320;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SPACES = /\s+/;

/** Helvetica advance widths (per 1000 em) for characters used in right-aligned figures. */
const FIGURE_WIDTHS = new Map<string, number>([
  [" ", 278],
  ["-", 333],
  [",", 278],
  [".", 278],
  ["(", 333],
  [")", 333],
  ["@", 1015],
  ["%", 889],
]);

type Font = "F1" | "F2";

/** WinAnsi code points for common characters outside Latin-1. */
const WIN_ANSI_EXTRAS = new Map([
  ["–", 0x96],
  ["—", 0x97],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["€", 0x80],
]);

function pdfString(value: string) {
  let output = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0x3f;
    const extra = WIN_ANSI_EXTRAS.get(character);
    if (character === "(" || character === ")" || character === "\\") {
      output += `\\${character}`;
    } else if (code >= 0x20 && code <= 0x7e) {
      output += character;
    } else if (extra !== undefined || (code >= 0xa0 && code <= 0xff)) {
      output += `\\${(extra ?? code).toString(8).padStart(3, "0")}`;
    } else {
      output += "?";
    }
  }
  return `(${output})`;
}

function textWidth(value: string, size: number) {
  let units = 0;
  for (const character of value) {
    units += FIGURE_WIDTHS.get(character) ?? 556;
  }
  return (units * size) / 1000;
}

const MONEY_FORMAT = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function money(paise: number) {
  return MONEY_FORMAT.format(paise / 100);
}

function displayDate(value: string) {
  const match = value.match(DATE_ONLY);
  if (!match) {
    return value;
  }
  const [, year, month, day] = match;
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function percent(basisPoints: number) {
  return `${(basisPoints / 100).toString()}%`;
}

function wrap(value: string, maxCharacters: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(SPACES).filter(Boolean)) {
    if (current && `${current} ${word}`.length > maxCharacters) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

class PageContent {
  readonly #operations: string[] = [];

  text(x: number, y: number, value: string, options: { font?: Font; size?: number } = {}) {
    const size = options.size ?? 10;
    this.#operations.push(
      `BT /${options.font ?? "F1"} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfString(value)} Tj ET`
    );
  }

  textRight(right: number, y: number, value: string, options: { font?: Font; size?: number } = {}) {
    this.text(right - textWidth(value, options.size ?? 10), y, value, options);
  }

  rule(y: number, weight = 0.6) {
    this.#operations.push(`${weight} w ${MARGIN} ${y.toFixed(2)} m ${RIGHT} ${y.toFixed(2)} l S`);
  }

  toString() {
    return this.#operations.join("\n");
  }
}

function labelledRows(
  page: PageContent,
  x: number,
  y: number,
  rows: [string, string][],
  labelWidth: number
) {
  let cursor = y;
  for (const [label, value] of rows) {
    page.text(x, cursor, label, { size: 9 });
    page.text(x + labelWidth, cursor, value, { font: "F2", size: 9 });
    cursor -= 14;
  }
  return cursor;
}

function drawHeader(page: PageContent, invoice: BookingInvoiceDocument) {
  page.text(MARGIN, 790, "Tax Invoice", { font: "F2", size: 18 });
  page.textRight(RIGHT, 794, "Original for recipient", { size: 9 });
  page.rule(778, 1);

  // The left column ends where the invoice facts begin; wrap rather than overlap.
  let supplierY = 758;
  for (const line of wrap(invoice.supplier.legalName, 40)) {
    page.text(MARGIN, supplierY, line, { font: "F2", size: 11 });
    supplierY -= 15;
  }
  for (const line of invoice.supplier.addressLines.flatMap((address) => wrap(address, 52))) {
    page.text(MARGIN, supplierY, line, { size: 9 });
    supplierY -= 13;
  }
  page.text(MARGIN, supplierY, `GSTIN: ${invoice.supplier.gstin}`, { size: 9 });
  supplierY -= 13;
  page.text(
    MARGIN,
    supplierY,
    `State: ${invoice.supplier.stateName} (${invoice.supplier.stateCode})`,
    { size: 9 }
  );

  const metaY = labelledRows(
    page,
    COLUMN,
    758,
    [
      ["Invoice number", invoice.invoiceNumber],
      ["Invoice date", displayDate(invoice.invoiceDate)],
      [
        "Place of supply",
        `${invoice.placeOfSupply.stateName} (${invoice.placeOfSupply.stateCode})`,
      ],
      ["Reverse charge", invoice.reverseCharge ? "Yes" : "No"],
    ],
    90
  );
  return Math.min(supplierY, metaY) - 22;
}

function drawRecipient(page: PageContent, invoice: BookingInvoiceDocument, top: number) {
  page.text(MARGIN, top, "Billed to", { font: "F2", size: 10 });
  page.text(MARGIN, top - 15, invoice.recipient.name, { size: 10 });
  if (invoice.recipient.email) {
    page.text(MARGIN, top - 28, invoice.recipient.email, { size: 9 });
  }
  // Booking and payment references can be long opaque IDs, so each value gets its
  // own line under its label instead of sharing a row.
  let cursor = top;
  for (const [label, value] of [
    ["Booking ID", invoice.booking.reference],
    ["Payment reference", invoice.booking.paymentReference],
  ] as const) {
    page.text(COLUMN, cursor, label, { size: 8.5 });
    page.text(COLUMN, cursor - 12, value, { font: "F2", size: 9 });
    cursor -= 28;
  }
  return Math.min(top - 54, cursor - 8);
}

const LINE_COLUMNS = { amount: RIGHT, qty: 400, sac: 330 };

function drawLineItem(page: PageContent, invoice: BookingInvoiceDocument, top: number) {
  page.rule(top + 12);
  page.text(MARGIN, top, "Description", { font: "F2", size: 9 });
  page.text(LINE_COLUMNS.sac, top, "SAC", { font: "F2", size: 9 });
  page.text(LINE_COLUMNS.qty, top, "Travellers", { font: "F2", size: 9 });
  page.textRight(LINE_COLUMNS.amount, top, "Taxable value (INR)", { font: "F2", size: 9 });
  page.rule(top - 6);

  let cursor = top - 22;
  const lines = wrap(invoice.line.description, 50);
  page.text(LINE_COLUMNS.sac, cursor, invoice.line.sac, { size: 10 });
  page.text(LINE_COLUMNS.qty, cursor, String(invoice.line.quantity), { size: 10 });
  page.textRight(LINE_COLUMNS.amount, cursor, money(invoice.amounts.taxablePaise), { size: 10 });
  for (const line of lines) {
    page.text(MARGIN, cursor, line, { size: 10 });
    cursor -= 13;
  }
  page.rule(cursor);
  return cursor - 20;
}

function drawTotals(page: PageContent, invoice: BookingInvoiceDocument, top: number) {
  const { amounts, gstRateBasisPoints } = invoice;
  const half = percent(gstRateBasisPoints / 2);
  const rows: [string, number][] = [["Taxable value", amounts.taxablePaise]];
  if (amounts.igstPaise > 0 || (amounts.cgstPaise === 0 && amounts.sgstPaise === 0)) {
    rows.push([`IGST @ ${percent(gstRateBasisPoints)}`, amounts.igstPaise]);
  } else {
    rows.push([`CGST @ ${half}`, amounts.cgstPaise], [`SGST @ ${half}`, amounts.sgstPaise]);
  }
  let cursor = top;
  for (const [label, paise] of rows) {
    page.text(COLUMN, cursor, label, { size: 10 });
    page.textRight(RIGHT, cursor, money(paise), { size: 10 });
    cursor -= 16;
  }
  page.rule(cursor + 8);
  cursor -= 6;
  page.text(COLUMN, cursor, "Invoice total (INR)", { font: "F2", size: 11 });
  page.textRight(RIGHT, cursor, money(amounts.totalPaise), { font: "F2", size: 11 });
  return cursor - 34;
}

function drawNotes(page: PageContent, invoice: BookingInvoiceDocument, top: number) {
  const notes = [
    `Amount received in full through the Citius Holidays website on ${displayDate(invoice.booking.paidDate)}. Tax is included in the amount paid.`,
    "All amounts are in Indian Rupees.",
    "This is a computer-generated invoice.",
  ];
  let cursor = top;
  for (const note of notes) {
    for (const line of wrap(note, 100)) {
      page.text(MARGIN, cursor, line, { size: 8.5 });
      cursor -= 12;
    }
  }
}

function assemble(content: string, title: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title ${pdfString(title)} /Producer (Citius Holidays) >>`,
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  // Every operator and escaped string is 7-bit ASCII, so string offsets are byte offsets.
  return new TextEncoder().encode(body);
}

export function renderBookingInvoicePdf(invoice: BookingInvoiceDocument): Uint8Array<ArrayBuffer> {
  const page = new PageContent();
  const afterHeader = drawHeader(page, invoice);
  const afterRecipient = drawRecipient(page, invoice, afterHeader);
  const afterLine = drawLineItem(page, invoice, afterRecipient);
  const afterTotals = drawTotals(page, invoice, afterLine);
  drawNotes(page, invoice, afterTotals);
  return assemble(page.toString(), `Tax invoice ${invoice.invoiceNumber}`);
}

/** A download filename without path separators. */
export function bookingInvoiceFileName(invoiceNumber: string) {
  return `Citius-Holidays-tax-invoice-${invoiceNumber.replaceAll("/", "-")}.pdf`;
}
