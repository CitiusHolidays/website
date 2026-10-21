import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { publishWorkNotification } from "./lib/notifications";
import { enqueueNotificationEmailOutbox, NOTIFICATION_LEASE_MS } from "./notificationEmailOutbox";
import { notifyQueryAssignmentHeads } from "./queryNotifications";
import { WORKFLOW_RULE_CATALOG } from "./workflowNudges";

const NOW = Date.parse("2026-10-20T10:00:00Z");
const issuer = "https://notification-policy.test";
const claim = makeFunctionReference<
  "mutation",
  { jobId: Id<"notificationEmailOutbox"> },
  Doc<"notificationEmailOutbox"> | null
>("crm/notificationEmailOutbox:claimNotificationEmail");
const freeze = makeFunctionReference<
  "mutation",
  {
    attempt: number;
    jobId: Id<"notificationEmailOutbox">;
    message: { from: string; subject: string; html: string; text: string };
  },
  unknown
>("crm/notificationEmailOutbox:freezeNotificationEmail");

function harness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  rateLimiterTest.register(t, "rateLimiter");
  return t;
}

const people = {
  accounts: ["Accounts"],
  accountsHead: ["Accounts Head"],
  admin: ["Admin"],
  cementDirector: ["Director Cement"],
  contracting: ["Contracting"],
  contractingHead: ["Contracting Head"],
  directors: ["Directors"],
  dualHead: ["Operations Head", "Head of Ticketing", "Admin"],
  financeHead: ["Finance"],
  inactive: ["Operations Head", "Directors"],
  operations: ["Operations"],
  ticketing: ["Ticketing"],
  ticketingHead: ["Head of Ticketing"],
  unrelatedOperations: ["Operations", "Sales Head"],
  unrelatedTicketing: ["Ticketing"],
} satisfies Record<string, Doc<"staffUsers">["roles"]>;
type Person = keyof typeof people;

async function fixture() {
  const t = harness();
  const data = await t.run(async (ctx) => {
    const ids = new Map<Person, Id<"staffUsers">>();
    for (const [name, roles] of Object.entries(people)) {
      const auth = `auth-${name}`;
      const id = await ctx.db.insert("staffUsers", {
        active: name !== "inactive",
        authUserId: name === "dualHead" ? undefined : auth,
        createdAt: NOW,
        email: `${name}@example.invalid`,
        emailAlertRoles: name.startsWith("unrelated")
          ? [
              "Admin",
              "Directors",
              "Contracting Head",
              "Operations Head",
              "Head of Ticketing",
              "Accounts Head",
            ]
          : [],
        emailNormalized: `${name.toLowerCase()}@example.invalid`,
        function: name === "financeHead" ? "Finance Head" : undefined,
        name,
        roles,
        updatedAt: NOW,
      });
      // SAFETY: The fixture's entries come from the closed people object above.
      ids.set(name as Person, id);
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${issuer}|${auth}`,
        createdAt: NOW,
        legacyAuthUserId: auth,
        status: "linked",
        updatedAt: NOW,
      });
    }
    const queryId = await ctx.db.insert("queries", {
      clientName: "Fictional policy review",
      contractingOwnerId: ids.get("contracting"),
      contractingStatus: "Query Received",
      createdAt: NOW - 25 * 3_600_000,
      createdBy: "auth-sales",
      jobCardCreatorStaffId: ids.get("accounts"),
      paxCount: 1,
      queryCode: "Q-POLICY",
      queryType: "FIT",
      salesStatus: "Order Confirmed",
      ticketingOwnerId: ids.get("ticketing"),
      ticketingScope: "Both",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    });
    const jobId = await ctx.db.insert("jobCards", {
      clientName: "Fictional policy review",
      confirmedPax: 1,
      contractingOwnerId: ids.get("contracting"),
      createdAt: NOW - 25 * 3_600_000,
      createdBy: "auth-sales",
      jobCode: "JC-POLICY",
      operationsOwnerId: ids.get("operations"),
      queryId,
      status: "Open",
      ticketingOwnerId: ids.get("ticketing"),
      travelStartDate: "2026-10-25",
      updatedAt: NOW,
    });
    const ticketId = await ctx.db.insert("tickets", {
      createdAt: NOW,
      createdBy: "auth-ticketing",
      jobCardId: jobId,
      paymentType: "Company Paid",
      ticketStatus: "Name Change Required",
      updatedAt: NOW,
    });
    const invoiceId = await ctx.db.insert("invoices", {
      balanceAmount: 100,
      createdAt: NOW,
      createdBy: "auth-accounts",
      dueDate: "2026-10-19",
      expectedAmount: 100,
      invoiceNumber: "INV-POLICY",
      jobCardId: jobId,
      receivedAmount: 0,
      status: "Overdue",
      updatedAt: NOW,
    });
    const travellerId = await ctx.db.insert("travellers", {
      callingStatus: "Pending",
      createdAt: NOW,
      createdBy: "fixture",
      foodPreference: "Veg",
      fullName: "Fictional traveller",
      guestType: "Employee",
      jobCardId: jobId,
      passportExpiryDate: "2026-10-24",
      paymentType: "Company Paid",
      roomType: "Single",
      ticketStatus: "Pending Issue",
      updatedAt: NOW,
      visaRequired: true,
      visaStatus: "Not Started",
    });
    return { entries: [...ids], invoiceId, jobId, queryId, ticketId, travellerId };
  });
  return { t, ...data, ids: new Map(data.entries) };
}

function personId(f: Awaited<ReturnType<typeof fixture>>, person: Person) {
  const id = f.ids.get(person);
  if (!id) {
    throw new Error(`Fixture is missing ${person}`);
  }
  return id;
}

function identity(t: ReturnType<typeof harness>, person: Person) {
  return t.withIdentity({
    email: `${person}@example.invalid`,
    issuer,
    subject: `auth-${person}`,
    tokenIdentifier: `${issuer}|auth-${person}`,
  });
}

async function expectAudience(f: Awaited<ReturnType<typeof fixture>>, expected: Person[]) {
  await f.t.run(async (ctx) => {
    const notifications = await ctx.db.query("notifications").collect();
    const jobs = await ctx.db.query("notificationEmailOutbox").collect();
    expect(
      notifications
        .map((row) => row.recipientStaffId)
        .sort((left, right) => String(left).localeCompare(String(right)))
    ).toEqual(
      expected
        .map((name) => personId(f, name))
        .sort((left, right) => String(left).localeCompare(String(right)))
    );
    expect(
      jobs
        .map((row) => row.recipient)
        .sort((left, right) => String(left).localeCompare(String(right)))
    ).toEqual(
      expected
        .map((name) => `${name.toLowerCase()}@example.invalid`)
        .sort((left, right) => String(left).localeCompare(String(right)))
    );
    expect(notifications.every((row) => row.recipientRole === undefined)).toBe(true);
    expect(jobs.every((row) => row.recipientPurposes?.[0]?.kind === "work")).toBe(true);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", () => {
    throw new Error("External requests forbidden");
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("ticket status mutation notifies only both assigned SPOCs and actual heads, once per staff member", async () => {
  const f = await fixture();
  await identity(f.t, "ticketingHead").mutation(api.crm.ticketing.updateTicketStatus, {
    ticketId: f.ticketId,
    ticketStatus: "Reissue Required",
  });
  await expectAudience(f, ["operations", "ticketing", "dualHead", "ticketingHead"]);
});

test("query intake copies active Admin and Directors without treating subscriptions or Director Cement as Management", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    notifyQueryAssignmentHeads(
      ctx,
      { ticketingScope: "Both" },
      {
        body: "Review this fictional query.",
        entityId: f.queryId,
        entityType: "query",
        title: "Query ready for assignment",
      }
    )
  );
  await expectAudience(f, ["contractingHead", "ticketingHead", "dualHead", "admin", "directors"]);
});

test("unassigned ticket work reaches its relevant heads without a team broadcast", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch("jobCards", f.jobId, {
      operationsOwnerId: undefined,
      ticketingOwnerId: undefined,
    });
    await publishWorkNotification(ctx, "ticket_attention", {
      body: "Review this ticket.",
      entityId: f.ticketId,
      entityType: "ticket",
      title: "Ticketing action needed",
    });
  });
  await expectAudience(f, ["dualHead", "ticketingHead"]);
});

const reminderCases = [
  {
    expected: ["accounts", "accountsHead", "financeHead"],
    key: "confirmed_query_without_job_card",
  },
  { expected: ["contractingHead", "dualHead"], key: "query_without_contracting_owner_after_24h" },
  { expected: ["dualHead"], key: "job_card_without_operations_owner_after_24h" },
  { expected: ["operations", "dualHead"], key: "departure_14d_visa_not_ready" },
  { expected: ["ticketing", "ticketingHead", "dualHead"], key: "departure_14d_ticket_not_ready" },
  { expected: ["operations", "dualHead"], key: "passport_expiry_blocks_departure" },
  {
    expected: ["operations", "ticketing", "ticketingHead", "dualHead"],
    key: "ticket_attention_status",
  },
  { expected: ["accountsHead", "financeHead"], key: "invoice_overdue_balance" },
] as const;

async function finishNudges(t: ReturnType<typeof harness>) {
  let result = await t.mutation(internal.crm.workflowNudges.runScheduledNudges, {});
  for (let page = 0; page < 8 && result.status === "running"; page += 1) {
    const state = await t.run((ctx) => ctx.db.query("portalWorkflowNudgeRuns").unique());
    result = await t.mutation(internal.crm.workflowNudges.runScheduledNudges, {
      continuationToken: state?.continuationToken,
    });
  }
  expect(result.status).toBe("completed");
}

test.each(reminderCases)(
  "registered $key reminder ignores legacy whole-team settings and extra alert roles",
  async ({ key, expected }) => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (const rule of WORKFLOW_RULE_CATALOG) {
        await ctx.db.insert("portalWorkflowRules", {
          createdAt: NOW,
          enabled: rule.key === key,
          key: rule.key,
          recipientRole: "Operations",
          thresholdHours: rule.thresholdHours,
          updatedAt: NOW,
        });
      }
      if (key === "confirmed_query_without_job_card") {
        await ctx.db.delete("jobCards", f.jobId);
      }
      if (key === "query_without_contracting_owner_after_24h") {
        await ctx.db.patch("queries", f.queryId, {
          contractingOwnerId: undefined,
          salesStatus: "Proposal in discussion",
        });
      }
      if (key === "job_card_without_operations_owner_after_24h") {
        await ctx.db.patch("jobCards", f.jobId, { operationsOwnerId: undefined });
      }
    });
    await finishNudges(f.t);
    await expectAudience(f, [...expected]);
  }
);

test.each([
  { key: "ticket_attention", person: "operations", stage: "initial" },
  { key: "ticket_attention", person: "operations", stage: "retry" },
  { key: "ticket_attention_status", person: "operations", stage: "initial" },
  { key: "ticket_attention_status", person: "operations", stage: "retry" },
  { key: "ticket_attention", person: "dualHead", stage: "initial" },
  { key: "ticket_attention", person: "dualHead", stage: "retry" },
] as const)(
  "$key stops $stage mail after $person loses responsibility despite broad access",
  async ({ key, person, stage }) => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      await ctx.db.patch("staffUsers", personId(f, "operations"), {
        roles: ["Operations", "Contracting Head"],
      });
      await publishWorkNotification(ctx, key, {
        body: "Review this ticket.",
        entityId: f.ticketId,
        entityType: "ticket",
        title: "Ticketing action needed",
      });
    });
    const job = await f.t.run(async (ctx) =>
      (await ctx.db.query("notificationEmailOutbox").collect()).find(
        (row) => row.recipientStaffId === personId(f, person)
      )
    );
    if (!job) {
      throw new Error("Missing assigned recipient job");
    }
    if (stage === "retry") {
      expect(await f.t.mutation(claim, { jobId: job._id })).not.toBeNull();
      await f.t.mutation(freeze, {
        attempt: 1,
        jobId: job._id,
        message: {
          from: "test@example.invalid",
          html: "Original",
          subject: "Original",
          text: "Original",
        },
      });
    }
    await f.t.run(async (ctx) => {
      if (person === "operations") {
        await ctx.db.patch("jobCards", f.jobId, {
          operationsOwnerId: personId(f, "unrelatedOperations"),
        });
      } else {
        await ctx.db.patch("staffUsers", personId(f, "dualHead"), { roles: ["Admin"] });
      }
    });
    vi.setSystemTime(NOW + NOTIFICATION_LEASE_MS);
    expect(await f.t.mutation(claim, { jobId: job._id })).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.get("notificationEmailOutbox", job._id))).toMatchObject({
      failureCode: "recipient_access_changed",
      status: "skipped",
    });
  }
);

test("a disabled reminder rule stops an already queued email", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    publishWorkNotification(ctx, "ticket_attention_status", {
      body: "Review this ticket.",
      entityId: f.ticketId,
      entityType: "ticket",
      title: "Ticket needs attention",
    })
  );
  const job = await f.t.run((ctx) => ctx.db.query("notificationEmailOutbox").first());
  if (!job) {
    throw new Error("Missing queued reminder");
  }
  await f.t.run((ctx) =>
    ctx.db.insert("portalWorkflowRules", {
      createdAt: NOW,
      enabled: false,
      key: "ticket_attention_status",
      updatedAt: NOW,
    })
  );
  expect(await f.t.mutation(claim, { jobId: job._id })).toBeNull();
});

test("heads can assign themselves and perform their own department work", async () => {
  const f = await fixture();
  const ticketHead = identity(f.t, "ticketingHead");
  const options = await ticketHead.query(api.crm.staff.listTeamOptions, {});
  expect(options.find((member) => member.id === personId(f, "ticketingHead"))?.roles).toContain(
    "Head of Ticketing"
  );
  expect(options.some((member) => member.id === personId(f, "inactive"))).toBe(false);
  await expect(
    ticketHead.mutation(api.crm.proposals.create, {
      clientName: "Fictional policy review",
      queryId: f.queryId,
    })
  ).rejects.toThrow("Only assigned");
  await ticketHead.mutation(api.crm.queries.assignQueryTeams, {
    queryId: f.queryId,
    ticketingStaffId: personId(f, "ticketingHead"),
  });
  const ticketProposal = await ticketHead.mutation(api.crm.proposals.create, {
    airfarePerPax: 10,
    clientName: "Fictional policy review",
    queryId: f.queryId,
  });
  expect(ticketProposal.id).toBeTruthy();
  const contractingHead = identity(f.t, "contractingHead");
  await contractingHead.mutation(api.crm.queries.assignQueryTeams, {
    contractingStaffId: personId(f, "contractingHead"),
    queryId: f.queryId,
  });
  expect(
    (
      await contractingHead.mutation(api.crm.proposals.create, {
        landCostPerPax: 20,
        queryId: f.queryId,
      })
    ).id
  ).toBeTruthy();
  const opsHead = identity(f.t, "admin");
  await f.t.run((ctx) =>
    ctx.db.patch("staffUsers", personId(f, "admin"), { roles: ["Operations Head"] })
  );
  await opsHead.mutation(api.crm.jobCards.assignOperationsOwner, {
    jobCardId: f.jobId,
    staffId: personId(f, "admin"),
  });
  expect(
    (
      await opsHead.mutation(api.crm.ops.createHotel, {
        jobCardId: f.jobId,
        name: "Fictional review hotel",
      })
    ).id
  ).toBeTruthy();
});

test.each([
  { bell: false, email: true },
  { bell: true, email: false },
  { bell: false, email: false },
])(
  "scoped work honors bell=$bell and email=$email controls independently",
  async ({ bell, email }) => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      await ctx.db.insert("operationalControlPlaneState", {
        activatedAt: NOW,
        activatedBy: "fixture",
        activatedByName: "Fixture",
        key: "global",
        reason: "Synthetic policy test",
        revision: 1,
      });
      for (const [key, enabled] of [
        ["notifications.crm_bell", bell],
        ["email.crm_workflow", email],
      ] as const) {
        await ctx.db.insert("operationalControlStates", {
          key,
          reason: "Synthetic policy test",
          revision: 1,
          state: enabled ? "enabled" : "disabled",
          updatedAt: NOW,
          updatedBy: "fixture",
          updatedByName: "Fixture",
        });
      }
      await publishWorkNotification(ctx, "ticket_attention", {
        body: "Review this ticket.",
        entityId: f.ticketId,
        entityType: "ticket",
        title: "Ticketing action needed",
      });
    });
    const [notifications, jobs] = await f.t.run(
      async (ctx) =>
        [
          await ctx.db.query("notifications").collect(),
          await ctx.db.query("notificationEmailOutbox").collect(),
        ] as const
    );
    expect(notifications).toHaveLength(bell ? 4 : 0);
    expect(jobs).toHaveLength(email ? 4 : 0);
  }
);

test("assigned but out-of-scope staff are excluded while relevant heads retain oversight", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch("staffUsers", personId(f, "operations"), { roles: ["Operations Cement"] });
    await publishWorkNotification(ctx, "ticket_attention", {
      body: "Review this ticket.",
      entityId: f.ticketId,
      entityType: "ticket",
      title: "Ticketing action needed",
    });
  });
  await expectAudience(f, ["ticketing", "ticketingHead", "dualHead"]);
});

test("intake with Ticketing not required copies Management and only the relevant assignment heads", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch("queries", f.queryId, {
      ticketingOwnerId: undefined,
      ticketingScope: "Not required",
    });
    await notifyQueryAssignmentHeads(
      ctx,
      { ticketingScope: "Not required" },
      {
        body: "Review this query.",
        entityId: f.queryId,
        entityType: "query",
        title: "Query ready for assignment",
      }
    );
  });
  await expectAudience(f, ["contractingHead", "dualHead", "admin", "directors"]);
});

test.each([undefined, { kind: "roles", roles: ["Operations", "Operations Head"] }] as const)(
  "legacy queued ticket audiences cannot bypass the confirmed policy with purpose %j",
  async (recipientPurpose) => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.patch("staffUsers", personId(f, "unrelatedOperations"), {
        roles: ["Operations", "Contracting Head"],
      })
    );
    const [jobId] = await f.t.run((ctx) =>
      enqueueNotificationEmailOutbox(ctx, {
        body: "Review this ticket.",
        entityId: f.ticketId,
        entityType: "ticket",
        eventId: "legacy-ticket",
        recipientPurpose: recipientPurpose
          ? { kind: recipientPurpose.kind, roles: [...recipientPurpose.roles] }
          : undefined,
        recipients: ["unrelatedoperations@example.invalid"],
        title: "Ticketing action needed",
      })
    );
    if (!jobId) {
      throw new Error("Missing legacy job");
    }
    expect(await f.t.mutation(claim, { jobId })).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
      failureCode: "recipient_access_changed",
      status: "skipped",
    });
  }
);

test.each([
  "departure_14d_visa_not_ready",
  "departure_14d_ticket_not_ready",
  "passport_expiry_blocks_departure",
] as const)("resolved %s work stops its queued reminder", async (key) => {
  const f = await fixture();
  await f.t.run((ctx) =>
    publishWorkNotification(ctx, key, {
      body: "Review departure readiness.",
      entityId: f.jobId,
      entityType: "jobCard",
      title: "Departure readiness",
    })
  );
  const job = await f.t.run((ctx) => ctx.db.query("notificationEmailOutbox").first());
  if (!job) {
    throw new Error("Missing pending work reminder");
  }
  await f.t.run((ctx) =>
    ctx.db.patch("travellers", f.travellerId, {
      passportExpiryDate: "2029-01-01",
      ticketStatus: "Issued",
      visaStatus: "Approved",
    })
  );
  expect(await f.t.mutation(claim, { jobId: job._id })).toBeNull();
});
