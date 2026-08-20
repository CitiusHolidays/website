export type AiCapability = "concierge" | "journeyPlanner";

const RAZORPAY_RECEIPT_PATTERN = /^rcpt_[a-zA-Z0-9]{8,64}$/;

export interface AiProviderBoundaryInput<Message> {
  capability: AiCapability;
  maxOutputTokens: number;
  messages: readonly Message[];
  models: readonly string[];
  system: string;
  totalTimeoutMs: number;
}

export function prepareAiProviderBoundary<Message>(input: AiProviderBoundaryInput<Message>) {
  if (
    input.messages.length === 0 ||
    input.models.length === 0 ||
    !input.models.every((model) => model.trim().length > 0) ||
    input.system.trim().length === 0 ||
    !Number.isSafeInteger(input.maxOutputTokens) ||
    input.maxOutputTokens <= 0 ||
    !Number.isSafeInteger(input.totalTimeoutMs) ||
    input.totalTimeoutMs <= 0
  ) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  return input;
}

export async function executeAiProviderOrchestration<Message, Result>(
  input: AiProviderBoundaryInput<Message>,
  dispatch: (prepared: AiProviderBoundaryInput<Message>) => Promise<Result>
) {
  return await dispatch(prepareAiProviderBoundary(input));
}

export interface PreparedRazorpayCheckout {
  totalAmount: number;
  trip: { id: string; name: string };
  user: { email: string; id: string; name: string; phoneNumber?: string | null };
}

export function prepareRazorpayNewOrderBoundary(input: {
  checkout: PreparedRazorpayCheckout;
  currency: string;
  receipt: string;
  travelers: number;
}) {
  const amountIsValid =
    Number.isFinite(input.checkout.totalAmount) && input.checkout.totalAmount > 0;
  const travelerCountIsValid =
    Number.isInteger(input.travelers) && input.travelers >= 1 && input.travelers <= 10;
  if (!(amountIsValid && travelerCountIsValid)) {
    throw new Error("RAZORPAY_NEW_ORDER_BOUNDARY_INVALID");
  }
  const providerInputIsValid =
    ["INR", "USD"].includes(input.currency) && RAZORPAY_RECEIPT_PATTERN.test(input.receipt);
  const checkoutIdentityIsValid =
    input.checkout.trip.id &&
    input.checkout.trip.name &&
    input.checkout.user.id &&
    input.checkout.user.email &&
    input.checkout.user.name;
  if (!(providerInputIsValid && checkoutIdentityIsValid)) {
    throw new Error("RAZORPAY_NEW_ORDER_BOUNDARY_INVALID");
  }
  return {
    amount: input.checkout.totalAmount,
    currency: input.currency,
    notes: {
      travelers: input.travelers.toString(),
      tripId: input.checkout.trip.id,
      tripName: input.checkout.trip.name,
      userEmail: input.checkout.user.email,
      userId: input.checkout.user.id,
    },
    receipt: input.receipt,
  };
}

export interface RazorpayNewOrderOrchestrationPorts<ProviderOrder, PendingBooking> {
  createPendingBooking: (providerOrder: ProviderOrder) => Promise<PendingBooking>;
  createProviderOrder: (
    input: ReturnType<typeof prepareRazorpayNewOrderBoundary>
  ) => Promise<ProviderOrder>;
}

export async function executeRazorpayNewOrderOrchestration<ProviderOrder, PendingBooking>(
  input: Parameters<typeof prepareRazorpayNewOrderBoundary>[0],
  ports: RazorpayNewOrderOrchestrationPorts<ProviderOrder, PendingBooking>
) {
  const providerOrder = await ports.createProviderOrder(prepareRazorpayNewOrderBoundary(input));
  const pendingBooking = await ports.createPendingBooking(providerOrder);
  return { pendingBooking, providerOrder };
}
