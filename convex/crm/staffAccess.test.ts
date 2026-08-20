import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import { getPortalAccess } from "./lib/staffAccess";
import { getMyPortalAccess } from "./staff";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

function makeCtx(identity: RuntimeObject | null, staffRows: Row[], identityLinks: Row[] = []) {
  const tables = { authIdentityLinks: identityLinks, staffUsers: staffRows };
  const ctx = {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      query(table: keyof typeof tables) {
        let rows = [...(tables[table] ?? [])];
        const builder = {
          take: async (count: number) => rows.slice(0, count),
          unique: async () => rows[0] ?? null,
          withIndex(_indexName: string, callback: (q: TestIndexQuery) => TestIndexQuery) {
            const filters: { field: string; value: RuntimeValue }[] = [];
            const q: TestIndexQuery = {
              eq(field: string, value: RuntimeValue) {
                filters.push({ field, value });
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) => filters.every(({ field, value }) => row[field] === value));
            return builder;
          },
        };
        return builder;
      },
    },
  };
  return ctx;
}

describe("Portal staff identity scope", () => {
  test("Does not grant roles from an email-only staff match", async () => {
    const ctx = makeCtx(
      {
        email: "staff-access-regression@example.invalid",
        name: "Guest account",
        subject: "guest_auth_subject",
      },
      [
        {
          _id: "staff_1",
          active: true,
          authUserId: "provisioned_staff_subject",
          email: "staff-access-regression@example.invalid",
          emailNormalized: "staff-access-regression@example.invalid",
          name: "Provisioned staff",
          roles: ["Sales"],
        },
      ]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await getPortalAccess(fromAny<never, unknown>(ctx));

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("NOT_STAFF");
    expect(access.roles).toEqual([]);
  });

  test("Allows an explicitly provisioned staff auth subject", async () => {
    const ctx = makeCtx(
      {
        email: "staff-access-regression@example.invalid",
        name: "Provisioned staff",
        subject: "provisioned_staff_subject",
      },
      [
        {
          _id: "staff_1",
          active: true,
          authUserId: "provisioned_staff_subject",
          email: "staff-access-regression@example.invalid",
          emailNormalized: "staff-access-regression@example.invalid",
          name: "Provisioned staff",
          roles: ["Sales"],
        },
      ]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await getPortalAccess(fromAny<never, unknown>(ctx));

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_1");
    expect(access.roles).toEqual(["Sales"]);
    expect(access.permissions.length).toBeGreaterThan(0);
  });

  test("Allows a canonical-only explicit staff link and selects canonical write identity", async () => {
    const ctx = makeCtx(
      {
        email: "canonical@example.invalid",
        name: "Canonical staff",
        subject: "legacy-subject",
        tokenIdentifier: "issuer|canonical-subject",
      },
      [
        {
          _id: "staff_canonical",
          active: true,
          authUserId: "issuer|canonical-subject",
          email: "canonical@example.invalid",
          emailNormalized: "canonical@example.invalid",
          name: "Canonical staff",
          roles: ["Sales"],
        },
      ]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await fromAny<any, unknown>(getMyPortalAccess)._handler(ctx, {});

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_canonical");
    expect(access.authUserId).toBe("issuer|canonical-subject");
  });

  test("Allows a legacy-only explicit staff link during the expansion window", async () => {
    const ctx = makeCtx(
      {
        email: "legacy@example.invalid",
        subject: "legacy-subject",
        tokenIdentifier: "issuer|canonical-subject",
      },
      [
        {
          _id: "staff_legacy",
          active: true,
          authUserId: "legacy-subject",
          email: "legacy@example.invalid",
          emailNormalized: "legacy@example.invalid",
          name: "Legacy staff",
          roles: ["Sales"],
        },
      ],
      [
        {
          _id: "identity_link",
          canonicalAuthUserId: "issuer|canonical-subject",
          legacyAuthUserId: "legacy-subject",
          status: "linked",
        },
      ]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await getPortalAccess(fromAny<never, unknown>(ctx));

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_legacy");
  });

  test("Deduplicates equal canonical and legacy links", async () => {
    const ctx = makeCtx(
      {
        email: "same@example.invalid",
        subject: "same-subject",
        tokenIdentifier: "same-subject",
      },
      [
        {
          _id: "staff_same",
          active: true,
          authUserId: "same-subject",
          email: "same@example.invalid",
          emailNormalized: "same@example.invalid",
          name: "Same staff",
          roles: ["Sales"],
        },
      ]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await getPortalAccess(fromAny<never, unknown>(ctx));

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_same");
  });

  test("Fails closed when canonical and legacy candidates link different staff rows", async () => {
    const ctx = makeCtx(
      {
        email: "ambiguous@example.invalid",
        subject: "legacy-subject",
        tokenIdentifier: "issuer|canonical-subject",
      },
      [
        {
          _id: "staff_canonical",
          active: true,
          authUserId: "issuer|canonical-subject",
          email: "canonical@example.invalid",
          emailNormalized: "canonical@example.invalid",
          name: "Canonical staff",
          roles: ["Sales"],
        },
        {
          _id: "staff_legacy",
          active: true,
          authUserId: "legacy-subject",
          email: "legacy@example.invalid",
          emailNormalized: "legacy@example.invalid",
          name: "Legacy staff",
          roles: ["Finance"],
        },
      ]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await getPortalAccess(fromAny<never, unknown>(ctx));

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("NOT_STAFF");
    expect(access.roles).toEqual([]);
  });

  test("Fails closed when neither explicit identity candidate is linked", async () => {
    const ctx = makeCtx(
      {
        email: "missing@example.invalid",
        subject: "legacy-missing",
        tokenIdentifier: "issuer|canonical-missing",
      },
      []
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await getPortalAccess(fromAny<never, unknown>(ctx));

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("NOT_STAFF");
  });

  test("Does not let another issuer reuse a linked Staff subject or notification identity", async () => {
    const ctx = makeCtx(
      {
        email: "legacy@example.invalid",
        subject: "legacy-subject",
        tokenIdentifier: "issuer-b|legacy-subject",
      },
      [
        {
          _id: "staff_legacy",
          active: true,
          authUserId: "legacy-subject",
          email: "legacy@example.invalid",
          name: "Legacy staff",
          roles: ["Sales"],
        },
      ],
      [
        {
          _id: "identity_link",
          canonicalAuthUserId: "issuer-a|legacy-subject",
          legacyAuthUserId: "legacy-subject",
          status: "linked",
        },
      ]
    );
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const access = await getPortalAccess(fromAny<never, unknown>(ctx));
    expect(access.allowed).toBe(false);
    expect(access.authUserId).toBe("issuer-b|legacy-subject");
  });
});
