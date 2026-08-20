import { afterEach, describe, expect, test } from "bun:test";
import { OperationalControlUnavailableError, resolveOperationalControl } from "./runtimeService";

// SAFETY: This test owns and restores the listed process environment keys after every case.
const mutableEnv = process.env as Record<string, string | undefined>;
type FetchMutationStub = NonNullable<
  NonNullable<Parameters<typeof resolveOperationalControl>[1]>["fetchMutationImpl"]
>;
const ENV_KEYS = [
  "NEXT_PUBLIC_CONVEX_URL",
  "NODE_ENV",
  "OPERATIONAL_CONTROL_GATEWAY_SECRET",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = value;
    }
  }
});

describe("Operational control runtime service", () => {
  test("Fails closed in Production when the protected gateway is not configured", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.NEXT_PUBLIC_CONVEX_URL = undefined;
    mutableEnv.OPERATIONAL_CONTROL_GATEWAY_SECRET = undefined;

    await expect(resolveOperationalControl("ai.concierge")).rejects.toBeInstanceOf(
      OperationalControlUnavailableError
    );
  });

  test("Uses standard behavior locally when the gateway is intentionally absent", async () => {
    mutableEnv.NODE_ENV = "test";
    mutableEnv.NEXT_PUBLIC_CONVEX_URL = undefined;
    mutableEnv.OPERATIONAL_CONTROL_GATEWAY_SECRET = undefined;

    expect(await resolveOperationalControl("ai.concierge")).toEqual({
      blockedBy: [],
      enabled: true,
      key: "ai.concierge",
      reason: "local_standard",
    });
  });

  test("Returns the authoritative Convex decision without leaking the gateway secret", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    mutableEnv.OPERATIONAL_CONTROL_GATEWAY_SECRET = "server-only-secret";
    let capturedArgs: unknown;

    const fetchMutationImpl = (...call: Parameters<FetchMutationStub>) => {
      const [, args] = call;
      capturedArgs = args;
      return Promise.resolve({
        controls: [
          {
            blockedBy: [],
            enabled: false,
            key: "payments.razorpay_new_order",
            reason: "operator_disabled",
          },
        ],
      });
    };
    const decision = await resolveOperationalControl("payments.razorpay_new_order", {
      // SAFETY: this test stub implements the exact three-argument call exercised by runtimeService.
      fetchMutationImpl: fetchMutationImpl as never,
    });

    expect(decision).toMatchObject({ enabled: false, key: "payments.razorpay_new_order" });
    expect(capturedArgs).toEqual({
      gatewaySecret: "server-only-secret",
      keys: ["payments.razorpay_new_order"],
    });
    expect(JSON.stringify(decision)).not.toContain("server-only-secret");
  });

  test("Fails closed when the gateway returns an incomplete decision", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    mutableEnv.OPERATIONAL_CONTROL_GATEWAY_SECRET = "server-only-secret";

    await expect(
      resolveOperationalControl("ai.journey_planner", {
        // SAFETY: this test intentionally returns an incomplete gateway payload.
        fetchMutationImpl: (() => Promise.resolve({ controls: [] })) as never,
      })
    ).rejects.toBeInstanceOf(OperationalControlUnavailableError);
  });
});
