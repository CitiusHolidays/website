import { describe, expect, test } from "bun:test";
import {
  ensureCanonicalIdentityLink,
  establishCanonicalIdentityLink,
  publicAccountId,
} from "./customerIdentityAccess";
import type { RuntimeObject, RuntimeValue } from "./runtimeValues";

interface Row {
  _id: string;
  [field: string]: RuntimeValue;
}

const PUBLIC_ACCOUNT_ID_PATTERN = /^account_[a-f0-9]{32}$/;

function makeContext() {
  const tables = {
    authIdentityLinks: [],
    authIdentityQuarantines: [],
  } satisfies Record<string, Row[]>;
  let nextId = 1;
  const db = {
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
      const row = Object.values(tables)
        .flat()
        .find((candidate) => candidate._id === id);
      if (row) {
        Object.assign(row, value);
      }
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        first: async () => rows[0] ?? null,
        take: async (limit: number) => rows.slice(0, limit),
        withIndex: (_index: string, callback: (range: any) => RuntimeValue) => {
          const filters: [string, unknown][] = [];
          const range = {
            eq: (field: string, value: RuntimeValue) => {
              filters.push([field, value]);
              return range;
            },
          };
          callback(range);
          rows = rows.filter((row) => filters.every(([field, value]) => row[field] === value));
          return builder;
        },
      };
      return builder;
    },
  };
  return { ctx: { db }, tables };
}

describe("canonical customer identity links", () => {
  test("projects profile IDs or privacy-safe fallbacks without exposing token identifiers", async () => {
    const identity = {
      subject: "raw-subject",
      tokenIdentifier: "https://issuer.example|raw-subject",
    };
    expect(await publicAccountId(identity, "profile_1")).toBe("profile_1");
    const fallback = await publicAccountId(identity);
    expect(fallback).toMatch(PUBLIC_ACCOUNT_ID_PATTERN);
    expect(fallback).not.toContain("raw-subject");
    expect(fallback).not.toContain("issuer.example");
  });

  test("quarantines an issuer collision without storing the raw legacy subject", async () => {
    const { ctx, tables } = makeContext();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await ensureCanonicalIdentityLink(ctx as never, {
      issuer: "issuer-a",
      subject: "shared-subject",
      tokenIdentifier: "issuer-a|shared-subject",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const conflict = await establishCanonicalIdentityLink(ctx as never, {
      issuer: "issuer-b",
      subject: "shared-subject",
      tokenIdentifier: "issuer-b|shared-subject",
    });
    expect(conflict).toEqual({ authUserId: null, status: "conflict" });
    expect(tables.authIdentityLinks[0].status).toBe("quarantined");
    expect(tables.authIdentityQuarantines).toHaveLength(1);
    expect(tables.authIdentityQuarantines[0]).toMatchObject({
      reason: "conflicting_canonical_link",
      table: "authIdentityLinks",
    });
    expect(JSON.stringify(tables.authIdentityQuarantines)).not.toContain("shared-subject");
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      ensureCanonicalIdentityLink(ctx as never, {
        issuer: "issuer-b",
        subject: "shared-subject",
        tokenIdentifier: "issuer-b|shared-subject",
      })
    ).rejects.toThrow("AUTH_IDENTITY_CONFLICT");
  });
});
