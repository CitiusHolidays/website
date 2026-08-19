import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";

const NOW = new Date("2026-08-19T16:00:00.000Z");
const GATEWAY_SECRET = "sacred-bharat-event-gateway-secret";

type EventName =
  | "edition_started"
  | "question_answered"
  | "edition_completed"
  | "share_clicked"
  | "share_link_copied"
  | "result_downloaded"
  | "journey_cta_clicked"
  | "edition_restarted";

// biome-ignore lint/style/useConsistentTypeDefinitions: Convex FunctionReference args require a type-literal index shape.
type EventArgs = {
  correct?: boolean;
  edition: "001";
  event: EventName;
  eventId: string;
  gatewaySecret: string;
  playerToken: string;
  questionId?: "varanasi" | "amritsar" | "madurai" | "kedarnath" | "konark";
  referrerToken?: string;
  score?: number;
  shareToken?: string;
  style?: "archive" | "temple-red" | "monsoon";
};

const recordEvent = makeFunctionReference<
  "mutation",
  EventArgs,
  { attributed: boolean; eventRecordId: string; replayed: boolean }
>("sacredBharatEditionEvents:recordEdition001EventGateway");

const getMetrics = makeFunctionReference<
  "query",
  { edition: "001"; from: number; to: number },
  {
    anonymousPlayers: number;
    attributedCompletions: number;
    attributedStarts: number;
    eventCounts: Record<EventName, number>;
    scannedEvents: number;
    truncated: boolean;
  }
>("sacredBharatEditionEvents:getEdition001AttributionMetrics");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function identity(subject: string, email: string) {
  return {
    email,
    issuer: "https://auth.citius.test",
    subject,
    tokenIdentifier: `https://auth.citius.test|${subject}`,
  };
}

async function seedStaff(t: ReturnType<typeof createHarness>) {
  await t.run(async (ctx) => {
    for (const fixture of [
      {
        authUserId: "https://auth.citius.test|auth_admin",
        email: "admin@citius.test",
        name: "Admin",
        roles: ["Admin"],
      },
      {
        authUserId: "https://auth.citius.test|auth_director",
        email: "director@citius.test",
        name: "Director",
        roles: ["Directors"],
      },
    ] as const) {
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: fixture.authUserId,
        createdAt: NOW.getTime(),
        email: fixture.email,
        emailNormalized: fixture.email,
        name: fixture.name,
        roles: [...fixture.roles],
        updatedAt: NOW.getTime(),
      });
    }
  });
}

function eventArgs(overrides: Partial<EventArgs> = {}): EventArgs {
  const event = overrides.event ?? "edition_started";
  const args: EventArgs = {
    edition: "001",
    event,
    eventId: "1".repeat(32),
    gatewaySecret: GATEWAY_SECRET,
    playerToken: "a".repeat(24),
  };
  if (event === "edition_started") {
    args.shareToken = "f".repeat(32);
  }
  return Object.assign(args, overrides);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.SACRED_BHARAT_EVENT_GATEWAY_SECRET = GATEWAY_SECRET;
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.SACRED_BHARAT_EVENT_GATEWAY_SECRET;
});

describe("Sacred Bharat / 001 anonymous attribution", () => {
  test("guards the registered mutation and replays only an identical event command", async () => {
    const t = createHarness();
    await expect(
      t.mutation(recordEvent, eventArgs({ gatewaySecret: "wrong-secret" }))
    ).rejects.toThrow("FORBIDDEN");

    const first = await t.mutation(recordEvent, eventArgs());
    expect(first).toMatchObject({ attributed: false, replayed: false });
    await expect(t.mutation(recordEvent, eventArgs())).resolves.toEqual({
      ...first,
      replayed: true,
    });
    await expect(
      t.mutation(recordEvent, eventArgs({ event: "edition_restarted" }))
    ).rejects.toThrow("SACRED_BHARAT_EVENT_ID_CONFLICT");
  });

  test("rejects malformed tokens and event-specific payload fields", async () => {
    const t = createHarness();
    await expect(
      t.mutation(recordEvent, eventArgs({ playerToken: "a".repeat(25) }))
    ).rejects.toThrow("INVALID_SACRED_BHARAT_PLAYER_TOKEN");
    await expect(
      t.mutation(recordEvent, eventArgs({ event: "question_answered", eventId: "2".repeat(32) }))
    ).rejects.toThrow("INVALID_SACRED_BHARAT_EVENT_PAYLOAD");
    await expect(
      t.mutation(recordEvent, eventArgs({ eventId: "3".repeat(32), score: 4 }))
    ).rejects.toThrow("INVALID_SACRED_BHARAT_EVENT_PAYLOAD");
    await expect(
      t.mutation(recordEvent, eventArgs({ eventId: "4".repeat(32), referrerToken: "b".repeat(32) }))
    ).rejects.toThrow("INVALID_SACRED_BHARAT_REFERRER_TOKEN");

    await t.mutation(
      recordEvent,
      eventArgs({ eventId: "5".repeat(32), shareToken: "c".repeat(32) })
    );
    await expect(
      t.mutation(
        recordEvent,
        eventArgs({
          eventId: "6".repeat(32),
          playerToken: "b".repeat(24),
          shareToken: "c".repeat(32),
        })
      )
    ).rejects.toThrow("SACRED_BHARAT_SHARE_TOKEN_CONFLICT");
    await expect(
      t.mutation(
        recordEvent,
        eventArgs({
          eventId: "7".repeat(32),
          referrerToken: "c".repeat(32),
          shareToken: "d".repeat(32),
        })
      )
    ).rejects.toThrow("SACRED_BHARAT_SELF_REFERRAL");
  });

  test("accepts every reviewed event shape without creating a CRM handoff", async () => {
    const t = createHarness();
    const events: EventArgs[] = [
      eventArgs({ eventId: "a".repeat(32) }),
      eventArgs({
        correct: false,
        event: "question_answered",
        eventId: "b".repeat(32),
        questionId: "varanasi",
      }),
      eventArgs({ event: "edition_completed", eventId: "c".repeat(32), score: 4 }),
      eventArgs({
        event: "share_clicked",
        eventId: "d".repeat(32),
        score: 4,
        style: "archive",
      }),
      eventArgs({
        event: "share_link_copied",
        eventId: "e".repeat(32),
        score: 4,
        style: "temple-red",
      }),
      eventArgs({
        event: "result_downloaded",
        eventId: "f".repeat(32),
        score: 4,
        style: "monsoon",
      }),
      eventArgs({ event: "journey_cta_clicked", eventId: "0".repeat(32), score: 4 }),
      eventArgs({ event: "edition_restarted", eventId: "2".repeat(32) }),
    ];
    for (const event of events) {
      await expect(t.mutation(recordEvent, event)).resolves.toMatchObject({ replayed: false });
    }

    await t.run(async (ctx) => {
      expect(await ctx.db.query("sacredBharatEditionEvents").collect()).toHaveLength(8);
      expect(await ctx.db.query("inboundQueryIntents").collect()).toHaveLength(0);
      expect(await ctx.db.query("crmHandoffEvents").collect()).toHaveLength(0);
    });
  });

  test("hashes anonymous tokens and carries last non-direct attribution for thirty days", async () => {
    const t = createHarness();
    const playerToken = "b".repeat(24);
    const referrerPlayerToken = "a".repeat(24);
    const referrerToken = "c".repeat(32);
    await t.mutation(
      recordEvent,
      eventArgs({
        eventId: "4".repeat(32),
        playerToken: referrerPlayerToken,
        shareToken: referrerToken,
      })
    );
    const started = await t.mutation(
      recordEvent,
      eventArgs({
        eventId: "5".repeat(32),
        playerToken,
        referrerToken,
        shareToken: "d".repeat(32),
      })
    );
    expect(started.attributed).toBe(true);

    vi.setSystemTime(new Date(NOW.getTime() + 29 * 24 * 60 * 60 * 1000));
    await expect(
      t.mutation(
        recordEvent,
        eventArgs({
          event: "edition_completed",
          eventId: "6".repeat(32),
          playerToken,
          score: 4,
        })
      )
    ).resolves.toMatchObject({ attributed: true });

    vi.setSystemTime(new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000 + 1));
    await expect(
      t.mutation(
        recordEvent,
        eventArgs({
          event: "edition_restarted",
          eventId: "7".repeat(32),
          playerToken,
        })
      )
    ).resolves.toMatchObject({ attributed: false });

    const stored = await t.run(
      async (ctx) => await ctx.db.query("sacredBharatEditionEvents").collect()
    );
    expect(stored).toHaveLength(4);
    expect(JSON.stringify(stored)).not.toContain(playerToken);
    expect(JSON.stringify(stored)).not.toContain(referrerPlayerToken);
    expect(JSON.stringify(stored)).not.toContain(referrerToken);
    expect(stored[0]?.playerTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored[0]?.shareTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored[1]?.attributedReferrerPlayerTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("exposes only bounded aggregate attribution metrics to exact Admin", async () => {
    const t = createHarness();
    await seedStaff(t);
    await t.mutation(
      recordEvent,
      eventArgs({
        eventId: "7".repeat(32),
        playerToken: "c".repeat(24),
        shareToken: "d".repeat(32),
      })
    );
    await t.mutation(
      recordEvent,
      eventArgs({
        eventId: "8".repeat(32),
        referrerToken: "d".repeat(32),
        shareToken: "e".repeat(32),
      })
    );
    await t.mutation(
      recordEvent,
      eventArgs({
        event: "edition_completed",
        eventId: "9".repeat(32),
        score: 5,
      })
    );
    const asAdmin = t.withIdentity(identity("auth_admin", "admin@citius.test"));
    const asDirector = t.withIdentity(identity("auth_director", "director@citius.test"));
    const args = {
      edition: "001" as const,
      from: NOW.getTime() - 1,
      to: NOW.getTime() + 1,
    };

    await expect(asAdmin.query(getMetrics, args)).resolves.toMatchObject({
      anonymousPlayers: 2,
      attributedCompletions: 1,
      attributedStarts: 1,
      eventCounts: { edition_completed: 1, edition_started: 2 },
      scannedEvents: 3,
      truncated: false,
    });
    await expect(asDirector.query(getMetrics, args)).rejects.toThrow("FORBIDDEN");
    await expect(
      asAdmin.query(getMetrics, {
        edition: "001",
        from: NOW.getTime() - 31 * 24 * 60 * 60 * 1000,
        to: NOW.getTime(),
      })
    ).rejects.toThrow("INVALID_SACRED_BHARAT_METRICS_RANGE");
  });

  test("purges anonymous event rows after the thirty-day attribution window", async () => {
    const t = createHarness();
    await t.mutation(recordEvent, eventArgs());

    await t.run(async (ctx) => {
      expect(await ctx.db.query("sacredBharatEditionEvents").collect()).toHaveLength(1);
    });

    vi.setSystemTime(new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000));
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      expect(await ctx.db.query("sacredBharatEditionEvents").collect()).toHaveLength(0);
    });
  });
});
