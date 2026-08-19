import { fetchMutation } from "convex/nextjs";
import { anyApi } from "convex/server";

export type OperationalControlKey = "ai.concierge" | "ai.journey_planner" | "payments.razorpay";

export interface OperationalControlDecision {
  blockedBy: string[];
  enabled: boolean;
  key: OperationalControlKey;
  reason: string;
  testSessionId?: string;
}

interface RuntimeServiceOptions {
  fetchMutationImpl?: typeof fetchMutation;
  synthetic?: boolean;
  testScope?: string;
  testToken?: string;
}

export class OperationalControlUnavailableError extends Error {
  constructor(message = "Operational control service is unavailable", options?: ErrorOptions) {
    super(message, options);
    this.name = "OperationalControlUnavailableError";
  }
}

function configuredGateway() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  const gatewaySecret = process.env.OPERATIONAL_CONTROL_GATEWAY_SECRET?.trim();
  return convexUrl && gatewaySecret ? { convexUrl, gatewaySecret } : null;
}

export async function resolveOperationalControl(
  key: OperationalControlKey,
  options: RuntimeServiceOptions = {}
): Promise<OperationalControlDecision> {
  const gateway = configuredGateway();
  if (!gateway) {
    if (process.env.NODE_ENV === "production") {
      throw new OperationalControlUnavailableError();
    }
    return { blockedBy: [], enabled: true, key, reason: "local_standard" };
  }

  try {
    const result = await (options.fetchMutationImpl ?? fetchMutation)(
      anyApi.crm.settings.resolveOperationalControlsForGateway,
      {
        gatewaySecret: gateway.gatewaySecret,
        keys: [key],
        synthetic: options.synthetic ?? false,
        ...(options.testScope ? { testScope: options.testScope } : {}),
        ...(options.testToken ? { testToken: options.testToken } : {}),
      },
      { url: gateway.convexUrl }
    );
    const decision = result?.controls?.[0];
    if (
      !decision ||
      decision.key !== key ||
      typeof decision.enabled !== "boolean" ||
      !Array.isArray(decision.blockedBy) ||
      typeof decision.reason !== "string"
    ) {
      throw new OperationalControlUnavailableError("Operational control decision is invalid");
    }
    return decision as OperationalControlDecision;
  } catch (error) {
    if (error instanceof OperationalControlUnavailableError) {
      throw error;
    }
    throw new OperationalControlUnavailableError(undefined, { cause: error });
  }
}
