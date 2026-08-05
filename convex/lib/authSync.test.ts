import { describe, expect, test } from "bun:test";
import { syncAuthRecords } from "./authSync";

function makeCtx(profileRows: Record<string, any>[]) {
  const tables: Record<string, Record<string, any>[]> = {
    staffUsers: [],
    userProfiles: profileRows,
  };
  let fullProfileScans = 0;
  return {
    ctx: {
      db: {
        delete: async (id: string) => {
          tables.userProfiles = tables.userProfiles.filter((row) => row._id !== id);
        },
        insert: async (table: string, value: Record<string, unknown>) => {
          const id = `${table}_new`;
          tables[table].push({ _id: id, ...value });
          return id;
        },
        patch: async (id: string, value: Record<string, unknown>) => {
          for (const table of Object.values(tables)) {
            const row = table.find((candidate) => candidate._id === id);
            if (row) {
              Object.assign(row, value);
            }
          }
        },
        query: (table: string) => {
          let rows = [...tables[table]];
          let indexed = false;
          const query = {
            collect: async () => {
              if (table === "userProfiles" && !indexed) {
                fullProfileScans += 1;
              }
              return rows;
            },
            unique: async () => rows[0] ?? null,
            withIndex: (_name: string, callback: (q: any) => unknown) => {
              indexed = true;
              const filters: Array<[string, unknown]> = [];
              const q = {
                eq: (field: string, value: unknown) => {
                  filters.push([field, value]);
                  return q;
                },
              };
              callback(q);
              rows = rows.filter((row) => filters.every(([field, value]) => row[field] === value));
              return query;
            },
          };
          return query;
        },
      },
    },
    getFullProfileScans: () => fullProfileScans,
    tables,
  };
}

describe("syncAuthRecords normalized email lookup", () => {
  test("migrates and deduplicates legacy case variants, then uses the normalized index", async () => {
    const { ctx, getFullProfileScans, tables } = makeCtx([
      { _id: "profile_1", authUserId: "legacy_1", email: "Foo@Example.com", name: "Foo" },
      { _id: "profile_2", authUserId: "legacy_2", email: "foo@example.com", name: "Duplicate" },
    ]);

    await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "Foo@Example.com",
      name: "Foo",
    });
    expect(tables.userProfiles).toHaveLength(1);
    expect(tables.userProfiles[0]).toMatchObject({
      authUserId: "auth_foo",
      emailNormalized: "foo@example.com",
    });
    expect(getFullProfileScans()).toBe(0);

    tables.userProfiles.push({
      _id: "profile_mixed_legacy",
      authUserId: "legacy_mixed",
      email: "FOO@example.com",
      name: "Mixed duplicate",
    });

    await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "foo@example.com",
      name: "Foo",
    });
    expect(tables.userProfiles).toHaveLength(1);
    expect(getFullProfileScans()).toBe(0);
  });
});
