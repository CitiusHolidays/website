import { fetchMutation } from "convex/nextjs";
import { anyApi } from "convex/server";
import { isJsonObject, type JsonValue } from "../jsonValue";
import { isRuntimeBoolean, isRuntimeString } from "../runtimeValues";

export type OperationalControlKey =
  | "ai.concierge"
  | "ai.journey_planner"
  | "payments.razorpay"
  | "public.sacred_bharat_001";

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

interface OperationalControlGatewayArgs {
  gatewaySecret: string;
  keys: OperationalControlKey[];
  synthetic: boolean;
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
    const gatewayArgs: OperationalControlGatewayArgs = {
      gatewaySecret: gateway.gatewaySecret,
      keys: [key],
      synthetic: options.synthetic ?? false,
    };
    if (options.testScope) {
      gatewayArgs.testScope = options.testScope;
    }
    if (options.testToken) {
      gatewayArgs.testToken = options.testToken;
    }
    const result: JsonValue = await (options.fetchMutationImpl ?? fetchMutation)(
      anyApi.crm.settings.resolveOperationalControlsForGateway,
      gatewayArgs,
      { url: gateway.convexUrl }
    );
    if (!(isJsonObject(result) && Array.isArray(result.controls))) {
      throw new OperationalControlUnavailableError("Operational control decision is invalid");
    }
    const decision: JsonValue = result.controls[0];
    if (
      !isJsonObject(decision) ||
      decision.key !== key ||
      !isRuntimeBoolean(decision.enabled) ||
      !Array.isArray(decision.blockedBy) ||
      !decision.blockedBy.every(isRuntimeString) ||
      !isRuntimeString(decision.reason)
    ) {
      throw new OperationalControlUnavailableError("Operational control decision is invalid");
    }
    const parsed: OperationalControlDecision = {
      blockedBy: decision.blockedBy,
      enabled: decision.enabled,
      key,
      reason: decision.reason,
    };
    if (decision.testSessionId !== undefined) {
      if (!isRuntimeString(decision.testSessionId)) {
        throw new OperationalControlUnavailableError("Operational control decision is invalid");
      }
      parsed.testSessionId = decision.testSessionId;
    }
    return parsed;
  } catch (error) {
    if (error instanceof OperationalControlUnavailableError) {
      throw error;
    }
    throw new OperationalControlUnavailableError(undefined, { cause: error });
  }
}
