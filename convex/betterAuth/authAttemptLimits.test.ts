import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { FunctionReference } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import { authAttemptKeyDigest } from "../lib/authAttemptLimits";
import { createAuthOptions } from "./auth";

interface AuthRequestBody {
  email: string;
  name?: string;
  password?: string;
}

interface AttemptArgs {
  keyDigest: string;
  kind: string;
}

/**
 * Better Auth wired as the backend wires it, over an in-memory database. `refuse` decides what the
 * durable per-address limiter (convex/authAttemptLimits.ts) answers.
 */
function harness(refuse: (args: AttemptArgs) => boolean = () => false) {
  const attempts: AttemptArgs[] = [];
  const ctx = fromPartial<ActionCtx>({
    runAction: () => Promise.resolve(),
    runMutation: (_reference: FunctionReference<"mutation", "internal">, args: AttemptArgs) => {
      attempts.push(args);
      return Promise.resolve(refuse(args) ? { ok: false, retryAfterSeconds: 42 } : { ok: true });
    },
    runQuery: () => Promise.resolve(null),
    scheduler: { runAfter: () => Promise.resolve() },
  });
  const db = { account: [], session: [], user: [], verification: [] };
  const auth = betterAuth({
    ...createAuthOptions(ctx),
    database: memoryAdapter(db),
    logger: { disabled: true },
  });
  const post = (path: string, body: AuthRequestBody) =>
    auth.handler(
      new Request(`http://localhost:3000/api/auth${path}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        method: "POST",
      })
    );
  return { attempts, auth, post };
}

describe("Better Auth attempt limits", () => {
  // The email callbacks log their (expected) delivery failures: no provider in tests.
  const quiet = [spyOn(console, "error"), spyOn(console, "log"), spyOn(console, "warn")];
  beforeAll(() => {
    for (const spy of quiet) {
      spy.mockImplementation(() => undefined);
    }
  });
  afterAll(() => {
    for (const spy of quiet) {
      spy.mockRestore();
    }
  });

  test("no longer refuses different people from one shared bucket", async () => {
    const { attempts, post } = harness();
    // Better Auth's own limiter allowed 3 sign-ins per 10 s for everyone together.
    for (const n of [1, 2, 3, 4, 5, 6]) {
      // biome-ignore lint/performance/noAwaitInLoops: the attempts must arrive one after another.
      const response = await post("/sign-in/email", {
        email: `person-${n}@example.test`,
        password: "not-the-password",
      });
      expect(response.status).toBe(401);
    }
    expect(attempts).toHaveLength(6);
    expect(new Set(attempts.map((attempt) => attempt.keyDigest)).size).toBe(6);
  });

  test("counts each attempt against its folded address", async () => {
    const { attempts, post } = harness();
    await post("/sign-in/email", { email: "Person+trip@Example.test", password: "wrong-pass" });
    await post("/sign-up/email", {
      email: "person@example.test",
      name: "P",
      password: "pass-1234",
    });
    await post("/request-password-reset", { email: "PERSON@example.test" });
    await post("/send-verification-email", { email: "person+x@example.test" });
    expect(attempts).toEqual([
      {
        keyDigest: await authAttemptKeyDigest("password_sign_in", "person@example.test"),
        kind: "password_sign_in",
      },
      ...(await Promise.all(
        [1, 2, 3].map(async () => ({
          keyDigest: await authAttemptKeyDigest("auth_email", "person@example.test"),
          kind: "auth_email",
        }))
      )),
    ]);
    expect(JSON.stringify(attempts)).not.toContain("person");
  });

  test("refuses alike whether or not the account exists", async () => {
    const limited = await authAttemptKeyDigest("password_sign_in", "member@example.test");
    const unknown = await authAttemptKeyDigest("password_sign_in", "nobody@example.test");
    const { auth, post } = harness(
      (args) => args.keyDigest === limited || args.keyDigest === unknown
    );
    await auth.api.signUpEmail({
      body: { email: "member@example.test", name: "Member", password: "member-pass-1" },
    });
    const forMember = await post("/sign-in/email", {
      email: "member@example.test",
      password: "member-pass-1",
    });
    const forNobody = await post("/sign-in/email", {
      email: "nobody@example.test",
      password: "member-pass-1",
    });
    for (const response of [forMember, forNobody]) {
      expect(response.status).toBe(429);
      expect(response.headers.get("X-Retry-After")).toBe("42");
    }
    expect(await forMember.json()).toEqual(await forNobody.json());
  });

  test("leaves the backend's own calls uncounted", async () => {
    const { attempts, auth } = harness(() => true);
    await auth.api.requestPasswordReset({ body: { email: "staff@example.test" } });
    expect(attempts).toEqual([]);
  });

  test("keeps the IP-keyed limiter off every path limited durably", () => {
    // SAFETY: option construction reads environment only; no Convex context method is invoked.
    const options = createAuthOptions(fromPartial<ActionCtx>({}));
    expect(options.rateLimit.customRules).toEqual({
      "/magic-link/verify": false,
      "/request-password-reset": false,
      "/send-verification-email": false,
      "/sign-in/email": false,
      "/sign-in/magic-link": false,
      "/sign-up/email": false,
    });
  });
});
