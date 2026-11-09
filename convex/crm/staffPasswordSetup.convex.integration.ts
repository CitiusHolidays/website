/// <reference types="vite/client" />
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "../_generated/api";
import betterAuthSchema from "../betterAuth/schema";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * A stranger signs up on the public site with a future staff member's address and their own
 * password. Whether the real person verifies the address first or the office adds them first, the
 * stranger's password must never open a staff session: only the emailed setup link sets it.
 */

const betterAuthModules = import.meta.glob([
  "../betterAuth/**/*.ts",
  "!../betterAuth/**/*.test.ts",
]);
const ORIGIN = "http://localhost:3000";
const EMAIL = "new.hire@citius.test";
const STRANGER_PASSWORD = "stranger-chose-this";

function harness() {
  const t = convexTest({ modules, schema });
  t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
  rateLimiterTest.register(t, "rateLimiter");
  return t;
}

type Harness = ReturnType<typeof harness>;

function post(t: Harness, path: string, body: Record<string, string>) {
  return t.fetch(`/api/auth${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: ORIGIN },
    method: "POST",
  });
}

function signIn(t: Harness, password: string) {
  return post(t, "/sign-in/email", { email: EMAIL, password });
}

async function authUser(t: Harness) {
  return await t.query(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: EMAIL }],
  });
}

/** What clicking the verification link does to the account. */
async function verifyAddress(t: Harness) {
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "user",
      update: { emailVerified: true },
      where: [{ field: "email", value: EMAIL }],
    },
  });
}

async function sessionCount(t: Harness, userId: string) {
  const sessions = await t.query(components.betterAuth.adapter.findMany, {
    model: "session",
    paginationOpts: { cursor: null, numItems: 50 },
    where: [{ field: "userId", value: userId }],
  });
  return sessions.page.length;
}

/** The office adds the person, as `staff.upsertStaff` does, and provisioning runs. */
async function officeAddsStaff(t: Harness) {
  const staffId = await t.run((ctx) =>
    ctx.db.insert("staffUsers", {
      active: true,
      createdAt: Date.now(),
      email: EMAIL,
      emailNormalized: EMAIL,
      name: "New Hire",
      pendingPasswordSetup: true,
      roles: ["Sales"],
      updatedAt: Date.now(),
    })
  );
  await t.action(internal.crm.staffAction.provisionStaffUser, {
    email: EMAIL,
    name: "New Hire",
    staffId,
  });
  return staffId;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("BETTER_AUTH_SECRET", "staff-password-setup-test-secret-0123456789");
  vi.stubEnv("SITE_URL", ORIGIN);
  // Email delivery has no provider in tests; its failures are logged and expected.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Pre-registered staff address", () => {
  test("the office adds the person, then they verify: the stranger's password never works", async () => {
    const t = harness();
    expect((await post(t, "/sign-up/email", strangerSignUp())).status).toBe(200);
    const staffId = await officeAddsStaff(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await verifyAddress(t);
    await t.action(internal.crm.staffAction.sendPasswordSetupAfterVerification, { email: EMAIL });

    expect((await signIn(t, STRANGER_PASSWORD)).status).toBe(401);
    const staff = await t.run((ctx) => ctx.db.get("staffUsers", staffId));
    expect(staff?.authUserId).toBe(String((await authUser(t))?._id));
  });

  test("they verify first, then the office adds them: the stranger loses the password and sessions", async () => {
    const t = harness();
    expect((await post(t, "/sign-up/email", strangerSignUp())).status).toBe(200);
    await verifyAddress(t);
    // Before the fix this is where the stranger's password started to work.
    expect((await signIn(t, STRANGER_PASSWORD)).status).toBe(200);
    const userId = String((await authUser(t))?._id);
    expect(await sessionCount(t, userId)).toBe(1);

    await officeAddsStaff(t);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await signIn(t, STRANGER_PASSWORD)).status).toBe(401);
    expect(await sessionCount(t, userId)).toBe(0);
  });

  test("keeps a password the staff member set through an emailed link", async () => {
    const t = harness();
    expect((await post(t, "/sign-up/email", strangerSignUp())).status).toBe(200);
    const staffId = await t.run((ctx) =>
      ctx.db.insert("staffUsers", {
        active: true,
        authUserId: undefined,
        createdAt: Date.now(),
        email: EMAIL,
        emailNormalized: EMAIL,
        name: "New Hire",
        pendingPasswordSetup: true,
        roles: ["Sales"],
        updatedAt: Date.now(),
      })
    );
    // The person uses the reset link from their inbox.
    expect((await post(t, "/request-password-reset", { email: EMAIL })).status).toBe(200);
    const resetLinks = await t.query(components.betterAuth.adapter.findMany, {
      model: "verification",
      paginationOpts: { cursor: null, numItems: 10 },
      where: [{ field: "identifier", operator: "starts_with", value: "reset-password:" }],
    });
    const token = String(resetLinks.page[0]?.identifier).slice("reset-password:".length);
    expect(
      (await post(t, "/reset-password", { newPassword: "set-through-link", token })).status
    ).toBe(200);
    expect((await t.run((ctx) => ctx.db.get("staffUsers", staffId)))?.passwordSetByLinkAt).toBe(
      Date.now()
    );
    await verifyAddress(t);
    await t.action(internal.crm.staffAction.sendPasswordSetupAfterVerification, { email: EMAIL });

    expect((await signIn(t, "set-through-link")).status).toBe(200);
    expect((await t.run((ctx) => ctx.db.get("staffUsers", staffId)))?.authUserId).toBeDefined();
  });

  test("leaves staff who finished setup alone", async () => {
    const t = harness();
    expect((await post(t, "/sign-up/email", strangerSignUp("their-own-pass"))).status).toBe(200);
    await verifyAddress(t);
    const userId = String((await authUser(t))?._id);
    await t.run((ctx) =>
      ctx.db.insert("staffUsers", {
        active: true,
        authUserId: userId,
        createdAt: Date.now(),
        email: EMAIL,
        emailNormalized: EMAIL,
        name: "Settled Staff",
        pendingPasswordSetup: false,
        roles: ["Sales"],
        updatedAt: Date.now(),
      })
    );
    expect((await signIn(t, "their-own-pass")).status).toBe(200);

    await t.action(internal.crm.staffAction.sendPasswordSetupAfterVerification, { email: EMAIL });

    expect((await signIn(t, "their-own-pass")).status).toBe(200);
    expect(await sessionCount(t, userId)).toBe(2);
  });
});

function strangerSignUp(password = STRANGER_PASSWORD) {
  return { email: EMAIL, name: "Not The Hire", password };
}
