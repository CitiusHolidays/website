import { isRuntimeObject, isRuntimeString, type RuntimeValue } from "../../lib/runtimeValues";

export type AiCapability = "concierge" | "journeyPlanner";

const RAZORPAY_RECEIPT_PATTERN = /^rcpt_[a-zA-Z0-9]{8,64}$/;
const AI_CAPABILITIES = new Set<AiCapability>(["concierge", "journeyPlanner"]);
const AI_PROVIDER_MAX_MESSAGES = 20;
const AI_PROVIDER_MAX_MESSAGE_CHARS = 4000;
const AI_PROVIDER_MAX_MODELS = 10;
const AI_PROVIDER_MAX_MODEL_CHARS = 200;
const AI_PROVIDER_MAX_SYSTEM_CHARS = 16_000;

const AI_EGRESS_REDACTIONS = [
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    replacement: "[REDACTED_CONTACT]",
  },
  {
    pattern:
      /\b(?:passport(?:\s+(?:number|no\.?))?)\s*[:#-]?\s*(?=[A-Z0-9-]{6,20}\b)(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,20}\b/giu,
    replacement: "[REDACTED_PASSPORT]",
  },
  {
    pattern: /\b[A-Z][0-9]{7}\b/gu,
    replacement: "[REDACTED_PASSPORT]",
  },
  {
    pattern:
      /\b(?:api[ _-]?key|access[ _-]?token|auth(?:entication)?[ _-]?token|password|secret)\s*[:=]\s*[^\s,;]+/giu,
    replacement: "[REDACTED_SECRET]",
  },
  {
    pattern:
      /\b(?:card(?:\s+(?:number|no\.?))?|cvv|cvc|bank\s+account|account\s+(?:number|no\.?)|iban|upi(?:\s+id)?)\s*[:#=-]?\s*[A-Z0-9@][A-Z0-9@._ -]{2,31}\b/giu,
    replacement: "[REDACTED_PAYMENT]",
  },
  {
    pattern: /\b(?:\d[ -]*?){13,19}\b/gu,
    replacement: "[REDACTED_PAYMENT]",
  },
  {
    pattern: /\b(?:phone|mobile|telephone|tel|whatsapp)\s*[:#=-]?\s*(?:\+?\d[\d ().-]{7,}\d)\b/giu,
    replacement: "[REDACTED_CONTACT]",
  },
  {
    pattern: /\+\d[\d ().-]{7,}\d\b/gu,
    replacement: "[REDACTED_CONTACT]",
  },
  {
    pattern: /\b[6-9]\d{4}[ .-]\d{5}\b/gu,
    replacement: "[REDACTED_CONTACT]",
  },
  {
    pattern: /(?:\(\d{3}\)|\b\d{3})[ .-]*\d{3}[ .-]\d{4}\b/gu,
    replacement: "[REDACTED_CONTACT]",
  },
  {
    pattern: /\b[6-9]\d{9}\b/gu,
    replacement: "[REDACTED_CONTACT]",
  },
] as const;

export interface AiProviderTextPart {
  text: string;
  type: "text";
}

export interface AiProviderMessage {
  content: string | readonly AiProviderTextPart[];
  role: "assistant" | "user";
}

export interface AiProviderBoundaryInput {
  capability: AiCapability;
  maxOutputTokens: number;
  messages: readonly RuntimeValue[];
  models: readonly string[];
  system: string;
  totalTimeoutMs: number;
}

export interface PreparedAiProviderBoundary {
  capability: AiCapability;
  maxOutputTokens: number;
  messages: readonly AiProviderMessage[];
  models: readonly string[];
  system: string;
  totalTimeoutMs: number;
}

export function redactAiProviderText(value: string): string {
  return AI_EGRESS_REDACTIONS.reduce(
    (redacted, { pattern, replacement }) => redacted.replace(pattern, replacement),
    value
  );
}

function prepareAiProviderMessage(value: RuntimeValue): AiProviderMessage {
  if (!(isRuntimeObject(value) && !Array.isArray(value) && "role" in value && "content" in value)) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  const { content, role } = value;
  if (!(role === "assistant" || role === "user")) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  if (isRuntimeString(content)) {
    if (!(content.trim() && content.length <= AI_PROVIDER_MAX_MESSAGE_CHARS)) {
      throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
    }
    return { content: redactAiProviderText(content), role };
  }
  if (!(Array.isArray(content) && content.length > 0)) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  const parts = content.map((part): AiProviderTextPart => {
    if (
      !(
        isRuntimeObject(part) &&
        !Array.isArray(part) &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        isRuntimeString(part.text) &&
        part.text.trim() &&
        part.text.length <= AI_PROVIDER_MAX_MESSAGE_CHARS
      )
    ) {
      throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
    }
    return { text: redactAiProviderText(part.text), type: "text" };
  });
  if (parts.reduce((total, part) => total + part.text.length, 0) > AI_PROVIDER_MAX_MESSAGE_CHARS) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  return { content: parts, role };
}

export function prepareAiProviderBoundary(
  input: AiProviderBoundaryInput
): PreparedAiProviderBoundary {
  if (!AI_CAPABILITIES.has(input.capability)) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  if (!Array.isArray(input.messages)) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  if (!Array.isArray(input.models)) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  if (!isRuntimeString(input.system)) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  if (
    input.messages.length === 0 ||
    input.messages.length > AI_PROVIDER_MAX_MESSAGES ||
    input.models.length === 0 ||
    input.models.length > AI_PROVIDER_MAX_MODELS ||
    !input.models.every(
      (model) =>
        isRuntimeString(model) &&
        model.trim().length > 0 &&
        model.length <= AI_PROVIDER_MAX_MODEL_CHARS
    ) ||
    input.system.trim().length === 0 ||
    input.system.length > AI_PROVIDER_MAX_SYSTEM_CHARS ||
    !Number.isSafeInteger(input.maxOutputTokens) ||
    input.maxOutputTokens <= 0 ||
    !Number.isSafeInteger(input.totalTimeoutMs) ||
    input.totalTimeoutMs <= 0
  ) {
    throw new Error("AI_PROVIDER_BOUNDARY_INVALID");
  }
  return {
    capability: input.capability,
    maxOutputTokens: input.maxOutputTokens,
    messages: input.messages.map(prepareAiProviderMessage),
    models: [...input.models],
    system: redactAiProviderText(input.system),
    totalTimeoutMs: input.totalTimeoutMs,
  };
}

export async function executeAiProviderOrchestration<Result>(
  input: AiProviderBoundaryInput,
  dispatch: (prepared: PreparedAiProviderBoundary) => Promise<Result>
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
