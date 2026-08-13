import { describe, expect, test } from "bun:test";
import { getPortalAccess } from "./lib/staffAccess";
import { getMyPortalAccess } from "./staff";

interface Row {
  _id: string;
  [key: string]: unknown;
}

function makeCtx(
  identity: Record<string, unknown> | null,
  staffRows: Row[],
  identityLinks: Row[] = []
) {
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
          withIndex(_indexName: string, callback: (q: unknown) => unknown) {
            const filters: { field: string; value: unknown }[] = [];
            const q = {
              eq(field: string, value: unknown) {
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

describe("portal staff identity scope", () => {
  test("does not grant roles from an email-only staff match", async () => {
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

    const access = await getPortalAccess(ctx as never);

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("NOT_STAFF");
    expect(access.roles).toEqual([]);
  });

  test("allows an explicitly provisioned staff auth subject", async () => {
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

    const access = await getPortalAccess(ctx as never);

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_1");
    expect(access.roles).toEqual(["Sales"]);
    expect(access.permissions.length).toBeGreaterThan(0);
  });

  test("allows a canonical-only explicit staff link and selects canonical write identity", async () => {
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

    const access = await (getMyPortalAccess as any)._handler(ctx, {});

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_canonical");
    expect(access.authUserId).toBe("issuer|canonical-subject");
  });

  test("allows a legacy-only explicit staff link during the expansion window", async () => {
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

    const access = await getPortalAccess(ctx as never);

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_legacy");
  });

  test("deduplicates equal canonical and legacy links", async () => {
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

    const access = await getPortalAccess(ctx as never);

    expect(access.allowed).toBe(true);
    expect(access.staffId).toBe("staff_same");
  });

  test("fails closed when canonical and legacy candidates link different staff rows", async () => {
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

    const access = await getPortalAccess(ctx as never);

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("NOT_STAFF");
    expect(access.roles).toEqual([]);
  });

  test("fails closed when neither explicit identity candidate is linked", async () => {
    const ctx = makeCtx(
      {
        email: "missing@example.invalid",
        subject: "legacy-missing",
        tokenIdentifier: "issuer|canonical-missing",
      },
      []
    );

    const access = await getPortalAccess(ctx as never);

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("NOT_STAFF");
  });

  test("does not let another issuer reuse a linked Staff subject or notification identity", async () => {
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
    const access = await getPortalAccess(ctx as never);
    expect(access.allowed).toBe(false);
    expect(access.authUserId).toBe("issuer-b|legacy-subject");
  });
});
