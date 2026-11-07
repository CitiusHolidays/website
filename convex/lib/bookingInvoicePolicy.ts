/**
 * GST tax-invoice rules for public website bookings.
 *
 * Every legal fact on the invoice (supplier name, GSTIN, address, SAC, rate and
 * series prefix) comes from deployment configuration. Missing or malformed values
 * fail closed: the caller records a "not configured" invoice instead of inventing
 * a value.
 */

export const BOOKING_INVOICE_CONFIG_KEYS = [
  "CITIUS_INVOICE_LEGAL_NAME",
  "CITIUS_INVOICE_GSTIN",
  "CITIUS_INVOICE_ADDRESS",
  "CITIUS_INVOICE_SAC",
  "CITIUS_INVOICE_GST_RATE_PERCENT",
  "CITIUS_INVOICE_SERIES_PREFIX",
] as const;

export type BookingInvoiceConfigKey = (typeof BOOKING_INVOICE_CONFIG_KEYS)[number];

/** GST state codes (first two GSTIN digits) and the state or territory they name. */
const GST_STATES = new Map<string, string>([
  ["01", "Jammu and Kashmir"],
  ["02", "Himachal Pradesh"],
  ["03", "Punjab"],
  ["04", "Chandigarh"],
  ["05", "Uttarakhand"],
  ["06", "Haryana"],
  ["07", "Delhi"],
  ["08", "Rajasthan"],
  ["09", "Uttar Pradesh"],
  ["10", "Bihar"],
  ["11", "Sikkim"],
  ["12", "Arunachal Pradesh"],
  ["13", "Nagaland"],
  ["14", "Manipur"],
  ["15", "Mizoram"],
  ["16", "Tripura"],
  ["17", "Meghalaya"],
  ["18", "Assam"],
  ["19", "West Bengal"],
  ["20", "Jharkhand"],
  ["21", "Odisha"],
  ["22", "Chhattisgarh"],
  ["23", "Madhya Pradesh"],
  ["24", "Gujarat"],
  ["26", "Dadra and Nagar Haveli and Daman and Diu"],
  ["27", "Maharashtra"],
  ["29", "Karnataka"],
  ["30", "Goa"],
  ["31", "Lakshadweep"],
  ["32", "Kerala"],
  ["33", "Tamil Nadu"],
  ["34", "Puducherry"],
  ["35", "Andaman and Nicobar Islands"],
  ["36", "Telangana"],
  ["37", "Andhra Pradesh"],
  ["38", "Ladakh"],
]);

const GSTIN_PATTERN = /^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const SAC_PATTERN = /^99\d{4}$/;
const RATE_PATTERN = /^(\d{1,2})(?:\.(\d{1,2}))?$/;
const PREFIX_PATTERN = /^[A-Z0-9]{1,4}$/;
const ADDRESS_SEPARATOR = /\s*(?:\||\\n|\n)\s*/;
const MAX_GST_RATE_BASIS_POINTS = 4000;
const MAX_INVOICE_NUMBER_LENGTH = 16;
const IST_OFFSET_MS = 330 * 60 * 1000;

export interface BookingInvoiceIssuer {
  addressLines: string[];
  gstin: string;
  gstRateBasisPoints: number;
  legalName: string;
  sac: string;
  seriesPrefix: string;
  stateCode: string;
  stateName: string;
}

export type BookingInvoiceIssuerResult =
  | { issuer: BookingInvoiceIssuer; ok: true }
  | { invalid: BookingInvoiceConfigKey[]; missing: BookingInvoiceConfigKey[]; ok: false };

function parseRateBasisPoints(value: string) {
  const match = value.match(RATE_PATTERN);
  if (!match) {
    return null;
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const basisPoints = whole * 100 + fraction;
  return basisPoints > 0 && basisPoints <= MAX_GST_RATE_BASIS_POINTS ? basisPoints : null;
}

function gstinStateCode(gstin: string) {
  const code = gstin.match(GSTIN_PATTERN)?.[1];
  return code && GST_STATES.has(code) ? code : null;
}

/**
 * Read the supplier's invoice identity from the deployment environment.
 * Pass `process.env`; tests pass a plain object.
 */
export function readBookingInvoiceIssuer(
  env: Partial<Record<string, string | undefined>>
): BookingInvoiceIssuerResult {
  const values = {
    CITIUS_INVOICE_ADDRESS: env.CITIUS_INVOICE_ADDRESS?.trim() ?? "",
    CITIUS_INVOICE_GST_RATE_PERCENT: env.CITIUS_INVOICE_GST_RATE_PERCENT?.trim() ?? "",
    CITIUS_INVOICE_GSTIN: env.CITIUS_INVOICE_GSTIN?.trim().toUpperCase() ?? "",
    CITIUS_INVOICE_LEGAL_NAME: env.CITIUS_INVOICE_LEGAL_NAME?.trim() ?? "",
    CITIUS_INVOICE_SAC: env.CITIUS_INVOICE_SAC?.trim() ?? "",
    CITIUS_INVOICE_SERIES_PREFIX: env.CITIUS_INVOICE_SERIES_PREFIX?.trim() ?? "",
  } satisfies Record<BookingInvoiceConfigKey, string>;
  const missing = BOOKING_INVOICE_CONFIG_KEYS.filter((key) => !values[key]);
  const addressLines = values.CITIUS_INVOICE_ADDRESS.split(ADDRESS_SEPARATOR).filter(Boolean);
  const stateCode = gstinStateCode(values.CITIUS_INVOICE_GSTIN);
  const basisPoints = parseRateBasisPoints(values.CITIUS_INVOICE_GST_RATE_PERCENT);
  const checks = {
    CITIUS_INVOICE_ADDRESS: addressLines.length > 0,
    CITIUS_INVOICE_GST_RATE_PERCENT: basisPoints !== null,
    CITIUS_INVOICE_GSTIN: stateCode !== null,
    CITIUS_INVOICE_LEGAL_NAME: true,
    CITIUS_INVOICE_SAC: SAC_PATTERN.test(values.CITIUS_INVOICE_SAC),
    CITIUS_INVOICE_SERIES_PREFIX: PREFIX_PATTERN.test(values.CITIUS_INVOICE_SERIES_PREFIX),
  } satisfies Record<BookingInvoiceConfigKey, boolean>;
  const invalid = BOOKING_INVOICE_CONFIG_KEYS.filter((key) => values[key] && !checks[key]);
  if (missing.length > 0 || invalid.length > 0 || !stateCode || basisPoints === null) {
    return { invalid, missing, ok: false };
  }
  return {
    issuer: {
      addressLines,
      gstin: values.CITIUS_INVOICE_GSTIN,
      gstRateBasisPoints: basisPoints,
      legalName: values.CITIUS_INVOICE_LEGAL_NAME,
      sac: values.CITIUS_INVOICE_SAC,
      seriesPrefix: values.CITIUS_INVOICE_SERIES_PREFIX,
      stateCode,
      stateName: GST_STATES.get(stateCode) ?? stateCode,
    },
    ok: true,
  };
}

/** The Indian financial year (1 April – 31 March, IST) containing a timestamp. */
export function indianFinancialYear(timestamp: number) {
  const india = new Date(timestamp + IST_OFFSET_MS);
  const year = india.getUTCFullYear();
  const startYear = india.getUTCMonth() >= 3 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return {
    label: `${startYear}-${endShort}`,
    short: `${String(startYear % 100).padStart(2, "0")}${endShort}`,
  };
}

/** The calendar date (YYYY-MM-DD) in India for a timestamp. */
export function invoiceDateInIndia(timestamp: number) {
  return new Date(timestamp + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * A consecutive serial unique within one financial year, at most 16 characters
 * (letters, digits, "/" and "-" only), as GST invoice rules require.
 */
export function bookingInvoiceNumber(prefix: string, financialYearShort: string, sequence: number) {
  if (!(Number.isSafeInteger(sequence) && sequence > 0)) {
    throw new Error("BOOKING_INVOICE_SEQUENCE_INVALID");
  }
  const invoiceNumber = `${prefix}/${financialYearShort}/${String(sequence).padStart(5, "0")}`;
  if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
    throw new Error("BOOKING_INVOICE_NUMBER_TOO_LONG");
  }
  return invoiceNumber;
}

export interface GstSplit {
  cgstPaise: number;
  igstPaise: number;
  sgstPaise: number;
  taxablePaise: number;
  totalPaise: number;
}

/**
 * Split an amount the customer already paid (GST inclusive) into its taxable value
 * and tax. Every part is a whole number of paise and the parts sum to the total.
 */
export function gstSplitFromInclusiveTotal(input: {
  intraState: boolean;
  rateBasisPoints: number;
  totalPaise: number;
}): GstSplit {
  const { intraState, rateBasisPoints, totalPaise } = input;
  if (!(Number.isSafeInteger(totalPaise) && totalPaise > 0)) {
    throw new Error("BOOKING_INVOICE_AMOUNT_INVALID");
  }
  if (!(Number.isSafeInteger(rateBasisPoints) && rateBasisPoints > 0)) {
    throw new Error("BOOKING_INVOICE_RATE_INVALID");
  }
  const inclusiveTaxable = Math.round((totalPaise * 10_000) / (10_000 + rateBasisPoints));
  if (!intraState) {
    return {
      cgstPaise: 0,
      igstPaise: totalPaise - inclusiveTaxable,
      sgstPaise: 0,
      taxablePaise: inclusiveTaxable,
      totalPaise,
    };
  }
  // CGST and SGST are each charged at half the rate on the same taxable value, so
  // they are always equal; any rounding paisa stays in the taxable value.
  const halfTaxPaise = Math.round((inclusiveTaxable * rateBasisPoints) / 20_000);
  return {
    cgstPaise: halfTaxPaise,
    igstPaise: 0,
    sgstPaise: halfTaxPaise,
    taxablePaise: totalPaise - 2 * halfTaxPaise,
    totalPaise,
  };
}

export type PlaceOfSupplyBasis = "recipient_address" | "supplier_location";

/**
 * Place of supply for a tour sold to an unregistered customer: the recipient's
 * recorded state when one exists, otherwise the supplier's location.
 */
export function placeOfSupply(input: { recipientStateCode?: string; supplierStateCode: string }) {
  const recipientState =
    input.recipientStateCode && GST_STATES.has(input.recipientStateCode)
      ? input.recipientStateCode
      : null;
  const stateCode = recipientState ?? input.supplierStateCode;
  const basis: PlaceOfSupplyBasis = recipientState ? "recipient_address" : "supplier_location";
  return {
    basis,
    intraState: stateCode === input.supplierStateCode,
    stateCode,
    stateName: GST_STATES.get(stateCode) ?? stateCode,
  };
}
