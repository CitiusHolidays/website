import { api } from "@convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { isJsonObject, type JsonValue } from "../jsonValue";
import { isRuntimeBoolean, isRuntimeString } from "../runtimeValues";

export type OperationalControlKey = FunctionReturnType<
  typeof api.crm.settings.listOperationalControls
>[number]["key"];

type BackendOperationalControlDecision = FunctionReturnType<
  typeof api.crm.settings.resolveOperationalControlsForGateway
>["controls"][number];

export type OperationalControlDecision = Omit<
  BackendOperationalControlDecision,
  "key" | "reason"
> & {
  key: OperationalControlKey;
  reason: BackendOperationalControlDecision["reason"] | "local_standard";
};

interface RuntimeServiceOptions {
  fetchMutationImpl?: typeof fetchMutation;
}

interface OperationalControlGatewayArgs {
  gatewaySecret: string;
  keys: OperationalControlKey[];
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
    };
    const result: JsonValue = await (options.fetchMutationImpl ?? fetchMutation)(
      api.crm.settings.resolveOperationalControlsForGateway,
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
      // SAFETY: the protected gateway is the key owner; the runtime check above rejects non-string entries.
      blockedBy: decision.blockedBy as OperationalControlDecision["blockedBy"],
      enabled: decision.enabled,
      key,
      // SAFETY: the protected gateway is the reason owner; the runtime check above rejects non-strings.
      reason: decision.reason as BackendOperationalControlDecision["reason"],
    };
    return parsed;
  } catch (error) {
    if (error instanceof OperationalControlUnavailableError) {
      throw error;
    }
    throw new OperationalControlUnavailableError(undefined, { cause: error });
  }
}
