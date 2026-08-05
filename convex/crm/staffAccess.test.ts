import { describe, expect, test } from "bun:test";
import { getPortalAccess } from "./lib/staffAccess";

type Row = { _id: string; [key: string]: unknown };

function makeCtx(identity: Record<string, unknown> | null, staffRows: Row[]) {
  const tables = { staffUsers: staffRows };
  const ctx = {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      query(table: keyof typeof tables) {
        let rows = [...(tables[table] ?? [])];
        const builder = {
          unique: async () => rows[0] ?? null,
          withIndex(_indexName: string, callback: (q: unknown) => unknown) {
            const filters: Array<{ field: string; value: unknown }> = [];
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
});
