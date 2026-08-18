import { describe, expect, test } from "bun:test";
import { syncAuthRecords } from "./authSync";
import type { RuntimeObject, RuntimeValue } from "./runtimeValues";

function makeCtx(profileRows: RuntimeObject[], staffRows: RuntimeObject[] = []) {
  const tables = {
    sacredBharatLeaderboardSummaries: [],
    staffUsers: staffRows,
    userProfiles: profileRows,
  } satisfies Record<string, RuntimeObject[]>;
  let fullProfileScans = 0;
  return {
    ctx: {
      db: {
        delete: (_table: string, id: string) => {
          tables.userProfiles = tables.userProfiles.filter((row) => row._id !== id);
        },
        insert: (table: string, value: RuntimeObject) => {
          const id = `${table}_new`;
          tables[table].push({ _id: id, ...value });
          return id;
        },
        patch: (_table: string, id: string, value: RuntimeObject) => {
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
            collect: () => {
              if (table === "userProfiles" && !indexed) {
                fullProfileScans += 1;
              }
              return rows;
            },
            unique: () => {
              if (rows.length > 1) {
                throw new Error("unique() query matched more than one document");
              }
              return rows[0] ?? null;
            },
            withIndex: (_name: string, callback: (q: any) => RuntimeValue) => {
              indexed = true;
              const filters: [string, unknown][] = [];
              const q = {
                eq: (field: string, value: RuntimeValue) => {
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

describe("SyncAuthRecords normalized email lookup", () => {
  test("Migrates only the authoritative legacy identity and leaves same-email owners separate", async () => {
    const { ctx, getFullProfileScans, tables } = makeCtx([
      { _id: "profile_1", authUserId: "legacy_1", email: "Foo@Example.com", name: "Foo" },
      { _id: "profile_2", authUserId: "legacy_2", email: "foo@example.com", name: "Duplicate" },
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "Foo@Example.com",
      legacyAuthUserId: "legacy_1",
      name: "Foo",
    });
    expect(tables.userProfiles).toHaveLength(2);
    expect(tables.userProfiles.find((row) => row._id === "profile_1")).toMatchObject({
      authUserId: "auth_foo",
      emailNormalized: "foo@example.com",
    });
    expect(tables.userProfiles.find((row) => row._id === "profile_2")?.authUserId).toBe("legacy_2");
    expect(getFullProfileScans()).toBe(0);

    tables.userProfiles.push({
      _id: "profile_mixed_legacy",
      authUserId: "legacy_mixed",
      email: "FOO@example.com",
      name: "Mixed duplicate",
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "foo@example.com",
      name: "Foo",
    });
    expect(tables.userProfiles).toHaveLength(3);
    expect(getFullProfileScans()).toBe(0);
  });

  test("Guest profile synchronization never claims a staff record by email", async () => {
    const { ctx, tables } = makeCtx(
      [],
      [
        {
          _id: "staff_1",
          active: true,
          authUserId: "provisioned_staff_auth",
          email: "staff@example.com",
          emailNormalized: "staff@example.com",
          name: "Staff User",
          roles: ["Sales"],
        },
      ]
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await syncAuthRecords(ctx as any, {
      authUserId: "guest_auth",
      email: "staff@example.com",
      name: "Guest User",
    });

    expect(result.linkedStaff).toBe(false);
    expect(tables.staffUsers[0]).toMatchObject({
      authUserId: "provisioned_staff_auth",
      roles: ["Sales"],
    });
    expect(tables.userProfiles).toHaveLength(1);
    expect(tables.userProfiles[0]).toMatchObject({
      authUserId: "guest_auth",
      emailNormalized: "staff@example.com",
    });
  });

  test("Merges durable Customer fields before removing a duplicate profile", async () => {
    const { ctx, tables } = makeCtx([
      {
        _id: "profile_auth",
        authUserId: "auth_foo",
        createdAt: 200,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Traveler",
        passportDetailsEncrypted: "",
        phoneNumber: "",
      },
      {
        _id: "profile_legacy",
        authUserId: "legacy_foo",
        createdAt: 100,
        email: "Foo@Example.com",
        emailNormalized: "foo@example.com",
        legacyUserId: "legacy-user-7",
        name: "Legacy Name",
        passportDetailsEncrypted: "encrypted-passport",
        phoneNumber: "+91 99999 11111",
        sacredBharatLeaderboardOptOut: true,
      },
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "foo@example.com",
      legacyAuthUserId: "legacy_foo",
    });

    expect(tables.userProfiles).toHaveLength(1);
    expect(tables.userProfiles[0]).toMatchObject({
      _id: "profile_auth",
      legacyUserId: "legacy-user-7",
      name: "Legacy Name",
      passportDetailsEncrypted: "encrypted-passport",
      phoneNumber: "+91 99999 11111",
      sacredBharatLeaderboardOptOut: true,
    });
  });

  test("Selects the oldest orphan deterministically regardless of query order", async () => {
    const { ctx, tables } = makeCtx([
      {
        _id: "profile_newer",
        authUserId: undefined,
        createdAt: 200,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Newer",
      },
      {
        _id: "profile_older",
        authUserId: undefined,
        createdAt: 100,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Older",
      },
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "foo@example.com",
    });

    expect(result.profileId).toBe("profile_older");
    expect(tables.userProfiles).toHaveLength(1);
    expect(tables.userProfiles[0]._id).toBe("profile_older");
  });

  test("Archives a conflicting duplicate instead of deleting durable data", async () => {
    const { ctx, tables } = makeCtx([
      {
        _id: "profile_auth",
        authUserId: "auth_foo",
        createdAt: 100,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Foo",
        phoneNumber: "+91 11111 11111",
      },
      {
        _id: "profile_conflict",
        authUserId: "legacy_foo",
        createdAt: 200,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Foo legacy",
        phoneNumber: "+91 22222 22222",
      },
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "foo@example.com",
      legacyAuthUserId: "legacy_foo",
    });

    expect(tables.userProfiles).toHaveLength(2);
    expect(tables.userProfiles.find((row) => row._id === "profile_conflict")).toMatchObject({
      archivedAuthUserId: "legacy_foo",
      authUserId: undefined,
      mergeConflictFields: ["phoneNumber"],
      mergedIntoProfileId: "profile_auth",
    });
    expect(
      tables.userProfiles.find((row) => row._id === "profile_conflict")?.archivedAt
    ).toBeNumber();
  });

  test("Repairs duplicate rows sharing one auth identity without a unique lookup", async () => {
    const { ctx, tables } = makeCtx([
      {
        _id: "profile_older",
        authUserId: "auth_foo",
        createdAt: 100,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Traveler",
        phoneNumber: "",
      },
      {
        _id: "profile_newer",
        authUserId: "auth_foo",
        createdAt: 200,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Foo",
        phoneNumber: "+91 99999 11111",
      },
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await syncAuthRecords(ctx as any, {
      authUserId: "auth_foo",
      email: "foo@example.com",
    });

    expect(result.profileId).toBe("profile_older");
    expect(tables.userProfiles).toHaveLength(1);
    expect(tables.userProfiles[0]).toMatchObject({
      _id: "profile_older",
      authUserId: "auth_foo",
      name: "Foo",
      phoneNumber: "+91 99999 11111",
    });
  });

  test("Does not let a retired auth identity take over the canonical profile", async () => {
    const { ctx, tables } = makeCtx([
      {
        _id: "profile_canonical",
        authUserId: "auth_current",
        createdAt: 100,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        name: "Foo",
      },
      {
        _id: "profile_archived",
        archivedAt: 200,
        archivedAuthUserId: "auth_retired",
        createdAt: 150,
        email: "foo@example.com",
        emailNormalized: "foo@example.com",
        mergedIntoProfileId: "profile_canonical",
        name: "Old Foo",
      },
    ]);

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      syncAuthRecords(ctx as any, {
        authUserId: "auth_retired",
        email: "foo@example.com",
      })
    ).rejects.toThrow("PROFILE_IDENTITY_CONFLICT");
    expect(tables.userProfiles.find((row) => row._id === "profile_canonical")?.authUserId).toBe(
      "auth_current"
    );
  });
});
