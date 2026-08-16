import { describe, expect, test } from "bun:test";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import { makeInviteCode } from "./lib/sacredBharatInvites";
import { joinGroupByInviteCode } from "./sacredBharat";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

function makeCtx() {
  const groupCode = makeInviteCode();
  const tables = {
    sacredBharatGroupMembers: [],
    sacredBharatGroups: [
      {
        _id: "sacredBharatGroups_1",
        createdAt: 1,
        inviteCode: groupCode,
        isArchived: false,
        name: "Test group",
        ownerAuthUserId: "auth_owner",
        updatedAt: 1,
      },
    ],
    sacredBharatInviteAttempts: [],
  } satisfies Record<string, Row[]>;
  let nextId = 1;
  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "yatri@example.com",
        name: "Test Yatri",
        subject: "auth_yatri",
      }),
    },
    db: {
      insert: (table: string, value: RuntimeObject) => {
        const id = `${table}_${nextId}`;
        nextId += 1;
        tables[table].push({ _id: id, ...value });
        return id;
      },
      patch: (tableOrId: string, idOrValue: string | RuntimeObject, maybeValue?: RuntimeObject) => {
        // SAFETY: This test controls the asserted value at the framework boundary below.
        const id = maybeValue ? (idOrValue as string) : tableOrId;
        // SAFETY: This test controls the asserted value at the framework boundary below.
        const value = maybeValue ?? (idOrValue as RuntimeObject);
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            Object.assign(row, value);
            return;
          }
        }
      },
      query: (table: string) => {
        let rows = tables[table] ?? [];
        const builder = {
          first: async () => rows[0] ?? null,
          take: async (limit: number) => rows.slice(0, limit),
          unique: async () => rows[0] ?? null,
          withIndex: (_name: string, callback: (query: any) => RuntimeValue) => {
            const filters: Array<{ field: string; value: unknown }> = [];
            const query = {
              eq: (field: string, value: RuntimeValue) => {
                filters.push({ field, value });
                return query;
              },
            };
            callback(query);
            rows = rows.filter((row) => filters.every(({ field, value }) => row[field] === value));
            return builder;
          },
        };
        return builder;
      },
    },
  };
  return { ctx, groupCode, tables };
}

// SAFETY: This test controls the asserted value at the framework boundary below.
const join = joinGroupByInviteCode as typeof joinGroupByInviteCode & {
  _handler: (
    ctx: ReturnType<typeof makeCtx>["ctx"],
    args: { inviteCode: string }
  ) => Promise<RuntimeValue>;
};

describe("Sacred Bharat invite mutation", () => {
  test("persists failed attempts and returns a privacy-safe throttle result", async () => {
    const { ctx, tables } = makeCtx();
    const attempts = await Array.from({ length: 5 }).reduce<Promise<unknown[]>>(
      async (previous) => [
        ...(await previous),
        await join._handler(ctx, { inviteCode: "wrong-code" }),
      ],
      Promise.resolve([])
    );
    expect(attempts).toEqual(Array.from({ length: 5 }, () => ({ notFound: true })));
    await expect(join._handler(ctx, { inviteCode: "wrong-code" })).resolves.toMatchObject({
      rateLimited: true,
    });
    expect(tables.sacredBharatInviteAttempts[0].attemptCount).toBe(6);
    expect(tables.sacredBharatGroupMembers).toHaveLength(0);
  });

  test("accepts a strong code and creates one membership", async () => {
    const { ctx, groupCode, tables } = makeCtx();
    await expect(
      join._handler(ctx, { inviteCode: ` ${groupCode.toLowerCase()} ` })
    ).resolves.toEqual({
      id: "sacredBharatGroups_1",
    });
    expect(tables.sacredBharatGroupMembers).toHaveLength(1);
  });
});
