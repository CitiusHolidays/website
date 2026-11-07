/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "./_generated/api";
import betterAuthSchema from "./betterAuth/schema";
import {
  SIGN_IN_LINKS_OVERALL_PER_HOUR,
  SIGN_IN_LINKS_PER_DEVICE_PER_HOUR,
  SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR,
  SIGN_IN_LINKS_PER_HOUR,
  SIGN_IN_RESPONSE_FLOOR_MS,
  sha256Hex,
  signInDomain,
  signInDomainDigest,
  signInInbox,
  signInRecipientDigest,
  waitUntilElapsed,
} from "./lib/customerAppSignIn";
import { magicLinkIdentifier } from "./lib/customerAppSignInVerification";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * The customer app's email sign-in limits (ADR 0020): what reaches one inbox and one domain is
 * bounded whatever the caller sends; the phone limit is best effort; the overall ceiling never
 * locks out a customer who already has a login; and a refused link leaves nothing behind.
 */

const betterAuthModules = import.meta.glob(["./betterAuth/**/*.ts", "!./betterAuth/**/*.test.ts"]);
const NOW = Date.parse("2026-11-10T06:00:00Z");

function harness() {
  const t = convexTest({ modules, schema });
  t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
  return t;
}

type Harness = ReturnType<typeof harness>;

let counter = 0;
function nextId(kind: string) {
  counter += 1;
  return `${kind}-${counter}`;
}

/** What `sendMagicLink` does: Better Auth has stored the link; then the request is recorded. */
async function request(
  t: Harness,
  email: string,
  options: { device?: string; inviteTokenHash?: string; knownAccount?: boolean } = {}
) {
  const tokenDigest = await sha256Hex(nextId("token"));
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60_000,
        identifier: magicLinkIdentifier(tokenDigest),
        updatedAt: Date.now(),
        value: JSON.stringify({ email, type: "magic-link" }),
      },
      model: "verification",
    },
  });
  return await t.mutation(internal.customerAppAuth.recordSignInLink, {
    // A fresh phone per request unless one is named, as an attacker would send.
    deviceDigest: options.device ?? nextId("device"),
    domainDigest: await signInDomainDigest(email),
    inviteTokenHash: options.inviteTokenHash,
    knownAccount: options.knownAccount ?? false,
    recipientDigest: await signInRecipientDigest(email),
    tokenDigest,
  });
}

/** A pending trip invite, as Operations create one; returns its token hash. */
async function pendingInvite(t: Harness, n: number) {
  const tokenHash = await sha256Hex(`invite-${n}`);
  await t.run(async (ctx) => {
    const staffId = await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: `ops-${n}`,
      createdAt: NOW,
      email: `ops-${n}@citius.test`,
      emailNormalized: `ops-${n}@citius.test`,
      name: "Synthetic Ops",
      roles: ["Operations"],
      updatedAt: NOW,
    });
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic Dealers Meet",
      confirmedPax: 40,
      createdAt: NOW,
      createdBy: "synthetic",
      jobCode: `JC-${n}`,
      queryType: "MICE",
      status: "Ready for Departure",
      updatedAt: NOW,
    });
    const travellerId = await ctx.db.insert("travellers", {
      callingStatus: "Pending",
      createdAt: NOW,
      createdBy: "synthetic",
      foodPreference: "Veg",
      fullName: `Employee ${n}`,
      guestType: "Employee",
      isMinor: false,
      jobCardId,
      paymentType: "Company Paid",
      roomType: "Twin",
      ticketStatus: "Pending Issue",
      updatedAt: NOW,
      visaRequired: false,
      visaStatus: "Not Required",
    });
    await ctx.db.insert("customerTripInvites", {
      channel: "link",
      createdAt: NOW,
      createdByName: "Synthetic Ops",
      createdByStaffId: staffId,
      expiresAt: NOW + 24 * 60 * 60_000,
      jobCardId,
      status: "pending",
      tokenHash,
      travellerId,
      updatedAt: NOW,
    });
  });
  return tokenHash;
}

async function storedLinksTo(t: Harness, email: string) {
  const page = await t.query(components.betterAuth.adapter.findMany, {
    model: "verification",
    paginationOpts: { cursor: null, numItems: 1000 },
  });
  return page.page.filter((row: { value?: unknown }) => String(row.value).includes(email)).length;
}

async function many(t: Harness, emails: string[]) {
  const results: string[] = [];
  for (const email of emails) {
    results.push(await request(t, email));
  }
  return results;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("customer app sign-in limits", () => {
  test("N1: aliases of one inbox share its links, Gmail and Yahoo included", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const first = await many(
      t,
      Array.from({ length: SIGN_IN_LINKS_PER_HOUR }, () => "victim@gmail.com")
    );
    expect(first.every((result) => result === "recorded")).toBe(true);
    expect(
      await many(t, ["VICTIM@gmail.com", "victim+1@gmail.com", "v.ictim@googlemail.com"])
    ).toEqual(["inbox_limited", "inbox_limited", "inbox_limited"]);

    const yahoo = await many(
      t,
      Array.from({ length: 6 }, (_, n) => `victim-${n}@yahoo.com`)
    );
    expect(yahoo.filter((result) => result === "recorded")).toHaveLength(SIGN_IN_LINKS_PER_HOUR);

    vi.setSystemTime(NOW + 61 * 60_000);
    expect(await request(t, "victim+later@gmail.com")).toBe("recorded");
  });

  test("N1: a catch-all or subdomain-addressed domain is bounded as a whole", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const results = await many(
      t,
      Array.from(
        { length: SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR + 5 },
        (_, n) => `x${n}@me.fastmail.example`
      )
    );
    expect(results.filter((result) => result === "recorded")).toHaveLength(
      SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR
    );
    expect(results[SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR + 4]).toBe("domain_limited");
    // A shared provider is told apart by inbox, never by domain.
    expect(await request(t, "someone@gmail.com")).toBe("recorded");
  });

  test("R6: invited travellers and customers at a flooded domain are always served", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const junk = await many(
      t,
      Array.from(
        { length: SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR + 1 },
        (_, n) => `junk${n}@client.example`
      )
    );
    expect(junk[SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR]).toBe("domain_limited");
    // A whole corporate group, invited by Operations, signs in within the same hour.
    for (let n = 0; n < SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR + 10; n += 1) {
      const inviteTokenHash = await pendingInvite(t, n);
      expect(await request(t, `employee${n}@client.example`, { inviteTokenHash })).toBe("recorded");
    }
    expect(await request(t, "returning@client.example", { knownAccount: true })).toBe("recorded");
    // Still bounded for addresses nobody invited and nobody signed up with.
    expect(await request(t, "unknown@client.example")).toBe("domain_limited");
    // A guessed or made-up invite hash is no invite.
    expect(await request(t, "guess@client.example", { inviteTokenHash: "f".repeat(64) })).toBe(
      "domain_limited"
    );
    vi.setSystemTime(NOW + 2 * 61 * 60_000);
    expect(await request(t, "returning@client.example", { knownAccount: true })).toBe("recorded");
  });

  test("N1: one phone that loops is slowed; its limit is best effort", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const results: string[] = [];
    for (let n = 0; n <= SIGN_IN_LINKS_PER_DEVICE_PER_HOUR; n += 1) {
      results.push(await request(t, `person${n}@example${n}.test`, { device: "one-phone" }));
    }
    expect(results[SIGN_IN_LINKS_PER_DEVICE_PER_HOUR]).toBe("device_limited");
  });

  test("N1: past the overall ceiling, customers with a login are still served", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    await t.run(async (ctx) => {
      for (let n = 0; n < SIGN_IN_LINKS_OVERALL_PER_HOUR; n += 1) {
        await ctx.db.insert("customerAppSignInLinks", {
          deviceDigest: `junk-device-${n}`,
          recipientDigest: `junk-${n}`,
          requestedAt: NOW,
          tokenDigest: `junk-token-${n}`,
        });
      }
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await request(t, "real.customer@example.test", { knownAccount: true })).toBe("recorded");
    expect(await request(t, "first.time@example.test")).toBe("busy");
    expect(
      await request(t, "invited.traveller@example.test", {
        inviteTokenHash: await pendingInvite(t, 900),
      })
    ).toBe("recorded");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("customer_app.sign_in_overall_ceiling")
    );
    warn.mockRestore();
  });

  test("N2/L4: a refused link's stored address is deleted with the refusal", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    await many(
      t,
      Array.from({ length: SIGN_IN_LINKS_PER_HOUR + 2 }, () => "busy@example.test")
    );
    expect(await storedLinksTo(t, "busy@example.test")).toBe(SIGN_IN_LINKS_PER_HOUR);

    const tokenDigest = await sha256Hex("staff-token");
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        data: {
          createdAt: NOW,
          expiresAt: NOW + 10 * 60_000,
          identifier: magicLinkIdentifier(tokenDigest),
          updatedAt: NOW,
          value: JSON.stringify({ email: "staff@example.test", type: "magic-link" }),
        },
        model: "verification",
      },
    });
    await t.mutation(internal.customerAppAuth.discardSignInLink, { tokenDigest });
    expect(await storedLinksTo(t, "staff@example.test")).toBe(0);
  });

  test("M8: a sign-in link signs in only the device that asked for it, once", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const secret = "S".repeat(43);
    const tokenDigest = await sha256Hex("the-link-token");
    await t.mutation(internal.customerAppAuth.recordSignInLink, {
      deviceDigest: await sha256Hex(secret),
      knownAccount: false,
      recipientDigest: await signInRecipientDigest("phone@example.test"),
      tokenDigest,
    });
    const consume = (deviceSecret: string) =>
      t.mutation(internal.customerAppAuth.consumeSignInDevice, { deviceSecret, tokenDigest });
    expect(await consume("X".repeat(43))).toBe(false);
    expect(await consume(secret)).toBe(true);
    expect(await consume(secret)).toBe(false);
  });

  test("every sign-in request answers no sooner than the floor", async () => {
    vi.useFakeTimers({ now: NOW });
    let done = false;
    const wait = waitUntilElapsed(NOW, SIGN_IN_RESPONSE_FLOOR_MS).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(SIGN_IN_RESPONSE_FLOOR_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(done).toBe(true);
  });

  test("N1: the inbox and the domain an address is counted under", () => {
    expect(signInInbox(" Vi.Ctim+Tag@GoogleMail.com ")).toBe("victim@gmail.com");
    expect(signInInbox("base-keyword@yahoo.com")).toBe("base@yahoo.com");
    expect(signInInbox("first.last+x@example.test")).toBe("first.last@example.test");
    expect(signInInbox("first-last@example.test")).toBe("first-last@example.test");
    expect(signInDomain("anyone@me.fastmail.com")).toBe("me.fastmail.com");
    expect(signInDomain("someone@Gmail.com")).toBeNull();
    expect(signInDomain("someone@hotmail.co.uk")).toBeNull();
    expect(signInDomain("someone@web.de")).toBeNull();
  });
});
