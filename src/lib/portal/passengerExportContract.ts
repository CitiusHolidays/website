export const PASSENGER_EXPORT_KINDS = [
  "passport",
  "passenger",
  "rooming",
  "traveller",
  "visa",
] as const;

export type PassengerExportKind = (typeof PASSENGER_EXPORT_KINDS)[number];

export interface PassengerExportPassport {
  dateOfBirth?: string;
  expiryDate?: string;
  issueDate?: string;
  number?: string;
}

export interface PassengerExportTicketing {
  domesticPnr?: string;
  domesticTicket?: string;
  domesticVendor?: string;
  internationalFare?: string | number;
  internationalPnr?: string;
  internationalVendor?: string;
}

export interface PassengerExportVisa {
  appointmentDate?: string;
  notes?: string;
  status?: string;
}

export interface PassengerExportRow {
  contactNo?: string;
  createdAt?: number;
  foodPreference?: string;
  fullName?: string;
  gender?: string;
  givenName?: string;
  hotelAllocation?: string;
  passport?: PassengerExportPassport;
  paymentType?: string;
  roomType?: string;
  sourceDealerCode?: string;
  sourceDealerName?: string;
  sourceDescription?: string;
  sourceGroup?: string;
  sourceRowNumber?: number | null;
  sourceRsoName?: string;
  sourceSheet?: string;
  sourceSoName?: string;
  specialRequests?: string;
  surname?: string;
  ticketing?: PassengerExportTicketing;
  travelBatchCode?: string;
  travelBatchId?: string;
  travelBatchReference?: string;
  travelHub?: string;
  visa?: PassengerExportVisa;
  visaRequired?: boolean;
  visaStatus?: string;
  willingToGo?: string;
}

export type PassengerExportCell = string | number;
export type PassengerExportRowValues = PassengerExportCell[];
