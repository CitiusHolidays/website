import { afterEach, describe, expect, test } from "bun:test";
import { repairAuthLinks } from "./authSync";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import { assertAuthRepairEnvironment } from "./lib/staffAuthRepair";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

const mutableEnv = process.env;
const ENV_KEYS = [
  "MIGRATION_SECRET",
  "PORTAL_BOOTSTRAP_ADMINS",
  "PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      Reflect.deleteProperty(mutableEnv, key);
    } else {
      mutableEnv[key] = value;
    }
  }
});

function makeCtx(initial: { staffUsers: Row[]; userProfiles: Row[] }) {
  const tables = {
    staffUsers: initial.staffUsers.map((row) => ({ ...row })),
    userProfiles: initial.userProfiles.map((row) => ({ ...row })),
  };
  const ctx = {
    db: {
      patch: (_table: string, id: string, patch: RuntimeObject) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...patch };
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      query(table: keyof typeof tables) {
        let rows = [...tables[table]];
        const builder = {
          order(direction: "asc" | "desc") {
            rows.sort((left, right) =>
              String(left.name ?? "").localeCompare(String(right.name ?? ""))
            );
            if (direction === "desc") {
              rows.reverse();
            }
            return builder;
          },
          paginate({ cursor, numItems }: { cursor: string | null; numItems: number }) {
            const start = cursor ? Number(cursor) : 0;
            const end = Math.min(start + numItems, rows.length);
            return Promise.resolve({
              continueCursor: end < rows.length ? String(end) : "",
              isDone: end >= rows.length,
              page: rows.slice(start, end),
            });
          },
          take: (count: number) => Promise.resolve(rows.slice(0, count)),
          withIndex(
            _name: string,
            callback?: (q: {
              eq: (field: string, value: RuntimeValue) => RuntimeValue;
            }) => RuntimeValue
          ) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: RuntimeValue) {
                filters.push({ field, value });
                return q;
              },
            };
            callback?.(q);
            rows = rows.filter((row) => filters.every(({ field, value }) => row[field] === value));
            return builder;
          },
        };
        return builder;
      },
    },
  };
  return { ctx, tables };
}

function staff(id: string, email: string, name: string, overrides: RuntimeObject = {}) {
  return {
    _id: id,
    active: true,
    createdAt: 1,
    email,
    emailNormalized: email,
    name,
    roles: ["Sales"],
    updatedAt: 1,
    ...overrides,
  };
}

function profile(id: string, email: string, authUserId: string) {
  return {
    _id: id,
    authUserId,
    createdAt: 1,
    email,
    emailNormalized: email,
    image: "",
    name: id,
    passportDetailsEncrypted: "",
    phoneNumber: "",
    updatedAt: 1,
  };
}

function configureRepair() {
  mutableEnv.MIGRATION_SECRET = "repair-secret";
  Reflect.deleteProperty(mutableEnv, "PORTAL_BOOTSTRAP_ADMINS");
  Reflect.deleteProperty(mutableEnv, "PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT");
}

function runRepair<Context>(
  ctx: Context,
  args: {
    cursor?: string | null;
    mode: "inventory" | "repair";
    numItems?: number;
    secret?: string;
  }
) {
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return (repairAuthLinks as any)._handler(ctx, {
    mode: args.mode,
    paginationOpts: {
      cursor: args.cursor ?? null,
      numItems: args.numItems ?? 50,
    },
    secret: args.secret ?? "repair-secret",
  });
}

describe("staff auth-link repair environment", () => {
  test("does not require bootstrap expiry when no bootstrap email is configured", () => {
    expect(() =>
      assertAuthRepairEnvironment("repair-secret", {
        MIGRATION_SECRET: "repair-secret",
      })
    ).not.toThrow();
  });

  test("requires a valid future expiry only when bootstrap emails are configured", () => {
    expect(() =>
      assertAuthRepairEnvironment(
        "repair-secret",
        {
          MIGRATION_SECRET: "repair-secret",
          PORTAL_BOOTSTRAP_ADMINS: "admin@example.com",
        },
        Date.parse("2026-08-05T00:00:00.000Z")
      )
    ).toThrow("Bootstrap admin configuration requires a valid future expiry");

    expect(() =>
      assertAuthRepairEnvironment(
        "repair-secret",
        {
          MIGRATION_SECRET: "repair-secret",
          PORTAL_BOOTSTRAP_ADMINS: "admin@example.com",
          PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT: "2026-08-06T00:00:00.000Z",
        },
        Date.parse("2026-08-05T00:00:00.000Z")
      )
    ).not.toThrow();
  });
});

describe("bounded staff auth-link repair", () => {
  test("repairs one-to-one evidence and is idempotent", async () => {
    configureRepair();
    const { ctx, tables } = makeCtx({
      staffUsers: [staff("staff_unique", "unique@example.com", "A Unique")],
      userProfiles: [profile("profile_unique", "unique@example.com", "auth_unique")],
    });

    const inventory = await runRepair(ctx, { mode: "inventory" });
    expect(inventory.counts).toMatchObject({
      inspected: 1,
      repairable: 1,
      repaired: 0,
    });
    expect(tables.staffUsers[0]?.authUserId).toBeUndefined();

    const repaired = await runRepair(ctx, { mode: "repair" });
    expect(repaired.counts).toMatchObject({ repairable: 1, repaired: 1 });
    expect(tables.staffUsers[0]?.authUserId).toBe("auth_unique");

    const replay = await runRepair(ctx, { mode: "repair" });
    expect(replay.counts).toMatchObject({ linked: 1, repairable: 0, repaired: 0 });
  });

  test("leaves ambiguous profile evidence unchanged for manual review", async () => {
    configureRepair();
    const { ctx, tables } = makeCtx({
      staffUsers: [staff("staff_ambiguous", "ambiguous@example.com", "A Ambiguous")],
      userProfiles: [
        profile("profile_1", "ambiguous@example.com", "auth_1"),
        profile("profile_2", "ambiguous@example.com", "auth_2"),
      ],
    });

    const result = await runRepair(ctx, { mode: "repair" });

    expect(result.counts).toMatchObject({ ambiguous: 1, repaired: 0 });
    expect(result.review).toContainEqual({
      email: "ambiguous@example.com",
      reason: "multiple profiles share the normalized email",
      staffId: "staff_ambiguous",
      status: "ambiguous",
    });
    expect(tables.staffUsers[0]?.authUserId).toBeUndefined();
  });

  test("reports linked, missing-profile, and skipped inactive rows", async () => {
    configureRepair();
    const { ctx } = makeCtx({
      staffUsers: [
        staff("staff_linked", "linked@example.com", "A Linked", {
          authUserId: "auth_linked",
        }),
        staff("staff_missing", "missing@example.com", "B Missing"),
        staff("staff_inactive", "inactive@example.com", "C Inactive", { active: false }),
      ],
      userProfiles: [profile("profile_linked", "linked@example.com", "auth_linked")],
    });

    const result = await runRepair(ctx, { mode: "inventory" });

    expect(result.counts).toMatchObject({
      inspected: 3,
      linked: 1,
      missing: 1,
      skipped: 1,
    });
  });

  test("resumes with the opaque cursor and never inspects more than the requested batch", async () => {
    configureRepair();
    const { ctx } = makeCtx({
      staffUsers: [
        staff("staff_a", "a@example.com", "A"),
        staff("staff_b", "b@example.com", "B"),
        staff("staff_c", "c@example.com", "C"),
      ],
      userProfiles: [],
    });

    const first = await runRepair(ctx, { mode: "inventory", numItems: 2 });
    const second = await runRepair(ctx, {
      cursor: first.continueCursor,
      mode: "inventory",
      numItems: 2,
    });

    expect(first).toMatchObject({ counts: { inspected: 2 }, isDone: false });
    expect(second).toMatchObject({ counts: { inspected: 1 }, isDone: true });
  });

  test("rejects an unauthorized operator before reading data", async () => {
    configureRepair();
    const { ctx } = makeCtx({ staffUsers: [], userProfiles: [] });

    await expect(runRepair(ctx, { mode: "inventory", secret: "wrong-secret" })).rejects.toThrow(
      "Invalid migration secret"
    );
  });
});
