export type PaymentAuthorizationStatus = "authorized" | "failed" | "pending";
export type PaymentCaptureStatus = "captured" | "failed" | "pending";
export type PaymentReservationStatus = "cancelled" | "not_reserved" | "reserved" | "unavailable";
export type PaymentRefundStatus = "failed" | "none" | "partial" | "pending" | "refunded";

export interface BookingPaymentStateSource {
  authorizationStatus?: PaymentAuthorizationStatus;
  authorizedAmount?: number;
  capturedAmount?: number;
  captureStatus?: PaymentCaptureStatus;
  refundedAmount?: number;
  refundStatus?: PaymentRefundStatus;
  remainingAmount?: number;
  reservationStatus?: PaymentReservationStatus;
  status: "cancelled" | "confirmed" | "failed" | "pending" | "refunded";
  totalAmount: number;
}

export interface BookingPaymentState {
  authorizationStatus: PaymentAuthorizationStatus;
  authorizedAmount: number;
  capturedAmount: number;
  captureStatus: PaymentCaptureStatus;
  refundedAmount: number;
  refundStatus: PaymentRefundStatus;
  remainingAmount: number;
  reservationStatus: PaymentReservationStatus;
}

export interface RefundStateInput {
  amount: number;
  status: "failed" | "pending" | "processed";
}

function legacyAuthorizationStatus(
  status: BookingPaymentStateSource["status"]
): PaymentAuthorizationStatus {
  if (status === "confirmed" || status === "refunded") {
    return "authorized";
  }
  return status === "failed" ? "failed" : "pending";
}

function legacyCaptureStatus(status: BookingPaymentStateSource["status"]): PaymentCaptureStatus {
  if (status === "confirmed" || status === "refunded") {
    return "captured";
  }
  return status === "failed" ? "failed" : "pending";
}

function legacyReservationStatus(
  status: BookingPaymentStateSource["status"]
): PaymentReservationStatus {
  if (status === "confirmed" || status === "refunded") {
    return "reserved";
  }
  return status === "cancelled" ? "cancelled" : "not_reserved";
}

export function projectBookingPaymentState(
  booking: BookingPaymentStateSource
): BookingPaymentState {
  const legacyCaptured = booking.status === "confirmed" || booking.status === "refunded";
  const capturedAmount = booking.capturedAmount ?? (legacyCaptured ? booking.totalAmount : 0);
  const refundedAmount =
    booking.refundedAmount ?? (booking.status === "refunded" ? capturedAmount : 0);
  return {
    authorizationStatus: booking.authorizationStatus ?? legacyAuthorizationStatus(booking.status),
    authorizedAmount: booking.authorizedAmount ?? (legacyCaptured ? booking.totalAmount : 0),
    capturedAmount,
    captureStatus: booking.captureStatus ?? legacyCaptureStatus(booking.status),
    refundedAmount,
    refundStatus: booking.refundStatus ?? (booking.status === "refunded" ? "refunded" : "none"),
    remainingAmount: booking.remainingAmount ?? Math.max(0, capturedAmount - refundedAmount),
    reservationStatus: booking.reservationStatus ?? legacyReservationStatus(booking.status),
  };
}

export function deriveRefundState(capturedAmount: number, refunds: RefundStateInput[]) {
  const processedAmount = refunds
    .filter((refund) => refund.status === "processed")
    .reduce((sum, refund) => sum + refund.amount, 0);
  const hasPending = refunds.some((refund) => refund.status === "pending");
  const hasFailed = refunds.some((refund) => refund.status === "failed");
  const exceedsCapturedAmount = processedAmount > capturedAmount;
  const remainingAmount = Math.max(0, capturedAmount - processedAmount);

  let status: PaymentRefundStatus = "none";
  if (capturedAmount > 0 && processedAmount === capturedAmount) {
    status = "refunded";
  } else if (processedAmount > 0) {
    status = "partial";
  } else if (hasPending) {
    status = "pending";
  } else if (hasFailed) {
    status = "failed";
  }

  return {
    exceedsCapturedAmount,
    hasFailed,
    hasPending,
    processedAmount,
    remainingAmount,
    status,
  };
}
