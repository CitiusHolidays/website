import { afterEach, describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import { type FunctionReference, getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { JsonObject } from "../jsonValue";
import { OFFICE_CHECK_IN_BODY_LIMIT_BYTES, type OfficeCheckInResponse } from "./contracts";
import { handleOfficeCheckIn, trustedClientIp } from "./gateway";

type Options = NonNullable<Parameters<typeof handleOfficeCheckIn>[1]>;
type Send = NonNullable<Options["send"]>;
interface Call {
  args: { gatewaySecret: string; location: unknown; observedIp: string | null };
  name: string;
  token: unknown;
}

const keys = ["NEXT_PUBLIC_CONVEX_URL", "NODE_ENV", "BETTER_AUTH_URL", "SITE_URL"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
// SAFETY: Restore all process environment edits after each isolated test.
const processEnv = fromPartial<Record<string, string | undefined>>(process.env);
afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) {
      delete processEnv[key];
    } else {
      processEnv[key] = original[key];
    }
  }
});

const position = {
  accuracyMeters: 20,
  capturedAt: 1_700_000_000_000,
  kind: "position",
  latitude: 19.07,
  longitude: 72.87,
};
const good = { action: "clock_in", location: position };

function requestText(text: string, headers: Record<string, string> = {}) {
  return new Request("https://citius.test/api/portal/office-check-in", {
    body: text,
    headers: { "Content-Type": "application/json", origin: "https://citius.test", ...headers },
    method: "POST",
  });
}

function request(json: JsonObject, headers: Record<string, string> = {}) {
  return requestText(JSON.stringify(json), headers);
}

interface MutationResult {
  checkIn: JsonObject;
  replayed: boolean;
}

function recorder(
  result: () => Promise<MutationResult> = () => Promise.resolve({ checkIn: {}, replayed: false })
) {
  const calls: Call[] = [];
  // SAFETY: the gateway is the only caller and passes the DTO asserted by each test.
  const send = fromPartial<Send>(
    (ref: FunctionReference<"mutation">, args: Call["args"], transport: { token?: string }) => {
      calls.push({ args, name: getFunctionName(ref), token: transport.token });
      return result();
    }
  );
  return { calls, send };
}

function setup(
  send: Send,
  env: Record<string, string | undefined> = { OFFICE_CHECK_IN_GATEWAY_SECRET: "test-secret" }
): Options {
  processEnv.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  processEnv.NODE_ENV = "test";
  return { env, send, tokenFor: async () => "verified-jwt" };
}

async function payloadOf(response: Response) {
  // SAFETY: the gateway under test only emits the OfficeCheckInResponse contract.
  return fromPartial<OfficeCheckInResponse>(await response.json());
}

describe("trustedClientIp", () => {
  const edge = { OFFICE_CHECK_IN_CLIENT_IP_SOURCE: "vercel-edge" };
  const withXff = (value: string) => request(good, { "x-forwarded-for": value });

  test("returns null unless the deployment opts in to the Vercel edge header", () => {
    expect(trustedClientIp(withXff("203.0.113.7"), {})).toBeNull();
    expect(
      trustedClientIp(withXff("203.0.113.7"), { OFFICE_CHECK_IN_CLIENT_IP_SOURCE: "header" })
    ).toBeNull();
  });

  test("accepts a single IPv4 or IPv6 value from the edge", () => {
    expect(trustedClientIp(withXff("203.0.113.7"), edge)).toBe("203.0.113.7");
    expect(trustedClientIp(withXff(" 2001:db8::1 "), edge)).toBe("2001:db8::1");
  });

  test("rejects comma lists, empty and oversized values", () => {
    expect(trustedClientIp(withXff("203.0.113.7, 198.51.100.2"), edge)).toBeNull();
    expect(trustedClientIp(withXff(""), edge)).toBeNull();
    expect(trustedClientIp(withXff("a".repeat(65)), edge)).toBeNull();
    expect(trustedClientIp(request(good), edge)).toBeNull();
  });
});

describe("office check-in gateway", () => {
  test("clocks in with the edge IP, ignores a spoofed body ip and forwards verified auth", async () => {
    const { calls, send } = recorder(() => Promise.resolve({ checkIn: {}, replayed: true }));
    const options = setup(send, {
      OFFICE_CHECK_IN_CLIENT_IP_SOURCE: "vercel-edge",
      OFFICE_CHECK_IN_GATEWAY_SECRET: "test-secret",
    });
    const response = await handleOfficeCheckIn(
      request(
        { ...good, ip: "10.0.0.1", observedIp: "10.0.0.2" },
        { "x-forwarded-for": "203.0.113.7" }
      ),
      options
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await payloadOf(response)).toEqual({ ok: true, replayed: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("crm/officeCheckIns:clockInViaGateway");
    expect(calls[0].args).toEqual({
      gatewaySecret: "test-secret",
      location: position,
      observedIp: "203.0.113.7",
    });
    expect(calls[0].token).toBe("verified-jwt");
  });

  test("sends a null IP in untrusted mode even when x-forwarded-for is present", async () => {
    const { calls, send } = recorder();
    const response = await handleOfficeCheckIn(
      request({ ...good, ip: "10.0.0.1" }, { "x-forwarded-for": "203.0.113.7" }),
      setup(send)
    );
    expect(response.status).toBe(200);
    expect(calls[0].args.observedIp).toBeNull();
    expect(JSON.stringify(calls[0].args)).not.toContain("10.0.0.1");
  });

  test("clock_out calls the clock-out mutation and returns its replayed value", async () => {
    for (const replayed of [false, true]) {
      const { calls, send } = recorder(() => Promise.resolve({ checkIn: {}, replayed }));
      // biome-ignore lint/performance/noAwaitInLoops: each case asserts one forwarded replay flag.
      const response = await handleOfficeCheckIn(
        request({ action: "clock_out", location: { kind: "not_requested" } }),
        setup(send)
      );
      expect(response.status).toBe(200);
      expect(await payloadOf(response)).toEqual({ ok: true, replayed });
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("crm/officeCheckIns:clockOutViaGateway");
      expect(calls[0].args.location).toEqual({ kind: "not_requested" });
    }
  });

  test("rejects a foreign origin with 403 before any work", async () => {
    const { calls, send } = recorder();
    const options = setup(send);
    processEnv.NODE_ENV = "production";
    processEnv.SITE_URL = "https://other.test";
    processEnv.BETTER_AUTH_URL = "https://other.test";
    const response = await handleOfficeCheckIn(request(good), options);
    expect(response.status).toBe(403);
    expect(await payloadOf(response)).toMatchObject({ code: "FORBIDDEN", ok: false });
    expect(calls).toHaveLength(0);
  });

  test("returns 401 when there is no session token", async () => {
    const { calls, send } = recorder();
    const response = await handleOfficeCheckIn(request(good), {
      ...setup(send),
      tokenFor: async () => null,
    });
    expect(response.status).toBe(401);
    expect(await payloadOf(response)).toMatchObject({ code: "UNAUTHENTICATED", ok: false });
    expect(calls).toHaveLength(0);
  });

  test("rejects malformed and oversized bodies without calling Convex", async () => {
    const { calls, send } = recorder();
    const options = setup(send);
    for (const invalid of [
      "{",
      JSON.stringify({ action: "clock_sideways", location: position }),
      JSON.stringify({ action: "clock_in", location: { ...position, latitude: "19" } }),
      JSON.stringify({ action: "clock_in" }),
    ]) {
      // biome-ignore lint/performance/noAwaitInLoops: ordered rejected requests assert no mutation is invoked.
      const response = await handleOfficeCheckIn(requestText(invalid), options);
      expect(response.status).toBe(400);
      expect(await payloadOf(response)).toMatchObject({ code: "INVALID_REQUEST", ok: false });
    }
    const oversized = await handleOfficeCheckIn(
      request({ ...good, pad: "a".repeat(OFFICE_CHECK_IN_BODY_LIMIT_BYTES) }),
      options
    );
    expect(oversized.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  test("maps Convex error codes to short typed responses", async () => {
    const cases = [
      ["NO_OFFICE_ASSIGNED", 409],
      ["OFFICE_INACTIVE", 409],
      ["ALREADY_CLOCKED_OUT", 409],
      ["NOT_CLOCKED_IN", 409],
      ["NO_STAFF_PROFILE", 403],
      ["FORBIDDEN", 403],
    ] as const;
    for (const [code, status] of cases) {
      const { send } = recorder(() => Promise.reject(new ConvexError(code)));
      // biome-ignore lint/performance/noAwaitInLoops: each case asserts one mapped response.
      const response = await handleOfficeCheckIn(request(good), setup(send));
      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await payloadOf(response)).toMatchObject({
        code,
        error: expect.any(String),
        ok: false,
      });
    }
  });

  test("returns 503 for unknown failures without leaking details", async () => {
    for (const failure of [
      new Error("database exploded at 10.0.0.1"),
      new ConvexError("CHECK_IN_NOT_FOUND"),
      // A secret mismatch is a server misconfiguration, shown as unavailable.
      new ConvexError("GATEWAY_MISCONFIGURED"),
      new ConvexError({ kind: "Other" }),
    ]) {
      const { send } = recorder(() => Promise.reject(failure));
      // biome-ignore lint/performance/noAwaitInLoops: each case asserts one opaque failure.
      const response = await handleOfficeCheckIn(request(good), setup(send));
      expect(response.status).toBe(503);
      const payload = await payloadOf(response);
      expect(payload).toMatchObject({ code: "UNAVAILABLE", ok: false });
      expect(JSON.stringify(payload)).not.toContain("10.0.0.1");
    }
    const { calls, send } = recorder();
    const tokenFailure = await handleOfficeCheckIn(request(good), {
      ...setup(send),
      tokenFor: () => Promise.reject(new Error("auth down")),
    });
    expect(tokenFailure.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test("fails closed with 503 when the gateway secret or Convex URL is missing", async () => {
    const { calls, send } = recorder();
    const missingSecret = await handleOfficeCheckIn(request(good), setup(send, {}));
    expect(missingSecret.status).toBe(503);
    expect(await payloadOf(missingSecret)).toMatchObject({ code: "UNAVAILABLE", ok: false });
    const options = setup(send);
    Reflect.deleteProperty(processEnv, "NEXT_PUBLIC_CONVEX_URL");
    expect((await handleOfficeCheckIn(request(good), options)).status).toBe(503);
    expect(calls).toHaveLength(0);
  });
});
