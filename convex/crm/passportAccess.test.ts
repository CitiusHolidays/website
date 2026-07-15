import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { encryptBuffer } from "../lib/encryption";
import {
  deletePassportMetadata,
  getPassportMetadata,
  logViewActivity,
  savePassportMetadata,
} from "./passport";
import {
  encryptAndStorePassport,
  generateUploadUrl,
  getPassportDocument,
  getPassportFile,
  removePassport,
} from "./passportActions";
import { getMyPortalAccess } from "./staff";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makePassportCtx(tables: Tables, staffOverrides: Partial<Row> = {}) {
  const staff = {
    _id: "staff_operations" as Id<"staffUsers">,
    active: true,
    authUserId: "auth_operations",
    email: "operations@citiusholidays.com",
    emailNormalized: "operations@citiusholidays.com",
    name: "Operations User",
    roles: ["Operations"],
    ...staffOverrides,
  };
  const allTables: Tables = { staffUsers: [staff], ...tables };
  let nextInsertedId = 1;
  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: staff.email,
        name: staff.name,
        subject: staff.authUserId,
      }),
    },
    db: {
      delete: async (id: string) => {
        for (const rows of Object.values(allTables)) {
          const index = rows.findIndex((entry) => entry._id === id);
          if (index >= 0) {
            rows.splice(index, 1);
            return;
          }
        }
        throw new Error(`Missing row: ${id}`);
      },
      get: async (id: string) => {
        for (const rows of Object.values(allTables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: async (table: string, value: Record<string, unknown>) => {
        let rows = allTables[table];
        if (!rows) {
          rows = [];
          allTables[table] = rows;
        }
        const id = `${table}_inserted_${nextInsertedId}`;
        nextInsertedId += 1;
        rows.push({ _id: id, ...value });
        return id;
      },
      normalizeId(table: string, id: string) {
        const rows = allTables[table] ?? [];
        return rows.some((row) => row._id === id) ? id : null;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        for (const rows of Object.values(allTables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            Object.assign(row, value);
            return;
          }
        }
        throw new Error(`Missing row: ${id}`);
      },
      query(table: string) {
        let rows = allTables[table] ?? [];
        return {
          collect: async () => [...rows],
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
            rows = rows.filter((row) => filters.every((f) => row[f.field] === f.value));
            return this;
          },
        };
      },
    },
  };
  return { ctx, staff, tables: allTables };
}

function makePassportActionCtx(
  queryCtx: unknown,
  storageBlobs: Record<string, Blob> = {},
  beforeMutation?: (name: string) => Promise<void> | void
) {
  const blobs = { ...storageBlobs };
  const effects = {
    mutations: [] as string[],
    storageDeletes: [] as string[],
    storageReads: [] as string[],
    storageStores: 0,
    storageUploadUrls: 0,
  };
  const ctx = {
    runMutation: async (reference: unknown, args: Record<string, unknown>) => {
      const name = getFunctionName(reference as never);
      effects.mutations.push(name);
      await beforeMutation?.(name);
      if (name === "crm/passport:logViewActivity") {
        return await (logViewActivity as any)._handler(queryCtx, args);
      }
      if (name === "crm/passport:savePassportMetadata") {
        return await (savePassportMetadata as any)._handler(queryCtx, args);
      }
      if (name === "crm/passport:deletePassportMetadata") {
        return await (deletePassportMetadata as any)._handler(queryCtx, args);
      }
      throw new Error(`Unexpected mutation: ${name}`);
    },
    runQuery: async (reference: unknown, args: Record<string, unknown>) => {
      const name = getFunctionName(reference as never);
      if (name === "crm/staff:getMyPortalAccess") {
        return await (getMyPortalAccess as any)._handler(queryCtx, {});
      }
      if (name === "crm/passport:getPassportMetadata") {
        return await (getPassportMetadata as any)._handler(queryCtx, args);
      }
      throw new Error(`Unexpected query: ${name}`);
    },
    storage: {
      delete: async (id: string) => {
        effects.storageDeletes.push(id);
        delete blobs[id];
      },
      generateUploadUrl: async () => {
        effects.storageUploadUrls += 1;
        return "https://storage.example/upload";
      },
      get: async (id: string) => {
        effects.storageReads.push(id);
        return blobs[id] ?? null;
      },
      store: async (blob: Blob) => {
        effects.storageStores += 1;
        blobs.storage_new = blob;
        return "storage_new";
      },
    },
  };
  return { ctx, effects };
}

describe("passport metadata access scope", () => {
  const queryId = "queries_1";
  const jobCardId = "jobCards_1";
  const travellerId = "travellers_1";
  const passportId = "passportDetails_1";
  const linkedQuery = {
    _id: queryId,
    operationsOwnerId: "staff_operations",
    operationsOwnerName: "Operations User",
    queryCode: "Q-0001",
    queryType: "FIT",
  };
  const job = {
    _id: jobCardId,
    createdAt: 1,
    jobCode: "JC-0001",
    operationsOwnerId: "staff_operations",
    operationsOwnerName: "Operations User",
    queryId,
    queryType: "FIT",
  };
  const traveller = { _id: travellerId, createdAt: 1, fullName: "Jane Doe", jobCardId };
  const passportRow = {
    _id: passportId,
    createdAt: 1_700_000_000_000,
    expiryDate: "2030-01-01",
    fileName: "passport.pdf",
    lastFour: "1234",
    mimeType: "application/pdf",
    status: "Received",
    storageId: "storage_1",
    travellerId,
  };

  test("staff with view:visa and job-card visibility receives metadata", async () => {
    const { ctx } = makePassportCtx({
      jobCards: [job],
      passportDetails: [passportRow],
      queries: [linkedQuery],
      travellers: [traveller],
    });
    const metadata = await (getPassportMetadata as any)._handler(ctx, { travellerId });
    expect(metadata).toEqual({
      createdAt: new Date(passportRow.createdAt).toISOString(),
      expiryDate: "2030-01-01",
      fileName: "passport.pdf",
      id: passportId,
      lastFour: "1234",
      mimeType: "application/pdf",
      status: "Received",
      storageId: "storage_1",
      travellerId,
    });
  });

  test("staff with view:visa but no job-card visibility is forbidden", async () => {
    const { ctx } = makePassportCtx({
      jobCards: [
        { ...job, operationsOwnerId: "staff_other", operationsOwnerName: "Other Operations" },
      ],
      passportDetails: [passportRow],
      queries: [
        {
          ...linkedQuery,
          operationsOwnerId: "staff_other",
          operationsOwnerName: "Other Operations",
        },
      ],
      travellers: [traveller],
    });
    await expect((getPassportMetadata as any)._handler(ctx, { travellerId })).rejects.toEqual(
      new ConvexError("FORBIDDEN")
    );
  });

  test("unassigned staff cannot read, replace, or delete before storage is touched", async () => {
    const { ctx: queryCtx } = makePassportCtx({
      jobCards: [
        { ...job, operationsOwnerId: "staff_other", operationsOwnerName: "Other Operations" },
      ],
      passportDetails: [passportRow],
      queries: [
        {
          ...linkedQuery,
          operationsOwnerId: "staff_other",
          operationsOwnerName: "Other Operations",
        },
      ],
      travellers: [traveller],
    });
    const { ctx, effects } = makePassportActionCtx(queryCtx, {
      storage_temp: new Blob(["replacement"]),
    });
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      await expect((generateUploadUrl as any)._handler(ctx, { travellerId })).rejects.toEqual(
        new ConvexError("FORBIDDEN")
      );
      await expect((getPassportDocument as any)._handler(ctx, { travellerId })).rejects.toEqual(
        new ConvexError("FORBIDDEN")
      );
      await expect((getPassportFile as any)._handler(ctx, { travellerId })).rejects.toEqual(
        new ConvexError("FORBIDDEN")
      );
      await expect(
        (encryptAndStorePassport as any)._handler(ctx, {
          fileName: "replacement.pdf",
          fileSize: 11,
          mimeType: "application/pdf",
          tempStorageId: "storage_temp",
          travellerId,
        })
      ).rejects.toEqual(new ConvexError("FORBIDDEN"));
      await expect((removePassport as any)._handler(ctx, { travellerId })).rejects.toEqual(
        new ConvexError("FORBIDDEN")
      );
    } finally {
      if (previousKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousKey;
      }
    }

    expect(effects).toEqual({
      mutations: [],
      storageDeletes: [],
      storageReads: [],
      storageStores: 0,
      storageUploadUrls: 0,
    });
  });

  for (const role of ["Operations Head", "Admin", "Directors"]) {
    test(`${role} retains authorized passport metadata access`, async () => {
      const { ctx: queryCtx } = makePassportCtx(
        {
          jobCards: [
            {
              ...job,
              operationsOwnerId: "staff_other",
              operationsOwnerName: "Other Operations",
            },
          ],
          passportDetails: [passportRow],
          queries: [
            {
              ...linkedQuery,
              operationsOwnerId: "staff_other",
              operationsOwnerName: "Other Operations",
            },
          ],
          travellers: [traveller],
        },
        { roles: [role] }
      );

      await expect(
        (getPassportMetadata as any)._handler(queryCtx, { travellerId })
      ).resolves.toMatchObject({
        id: passportId,
        travellerId,
      });

      const { ctx: actionCtx } = makePassportActionCtx(queryCtx);
      await expect((generateUploadUrl as any)._handler(actionCtx, { travellerId })).resolves.toBe(
        "https://storage.example/upload"
      );
    });
  }

  test("authorized Operations can read, replace, and remove the passport document", async () => {
    const { ctx: queryCtx } = makePassportCtx({
      activityLogs: [],
      jobCards: [job],
      passportDetails: [{ ...passportRow }],
      queries: [linkedQuery],
      travellers: [{ ...traveller }],
    });
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    try {
      const encryptedDocument = encryptBuffer(Buffer.from("original passport"));
      const { ctx } = makePassportActionCtx(queryCtx, {
        storage_1: new Blob([new Uint8Array(encryptedDocument)]),
        storage_temp: new Blob(["replacement passport"]),
      });

      await expect((generateUploadUrl as any)._handler(ctx, { travellerId })).resolves.toBe(
        "https://storage.example/upload"
      );

      const document = await (getPassportDocument as any)._handler(ctx, { travellerId });
      expect(document.success).toBe(true);
      expect(Buffer.from(document.bytes).toString()).toBe("original passport");

      const download = await (getPassportFile as any)._handler(ctx, { travellerId });
      expect(Buffer.from(download.bytes).toString()).toBe("original passport");

      await expect(
        (encryptAndStorePassport as any)._handler(ctx, {
          fileName: "replacement.pdf",
          fileSize: 20,
          mimeType: "application/pdf",
          tempStorageId: "storage_temp",
          travellerId,
        })
      ).resolves.toEqual({ success: true });
      await expect(
        (getPassportMetadata as any)._handler(queryCtx, { travellerId })
      ).resolves.toMatchObject({
        fileName: "replacement.pdf",
        storageId: "storage_new",
      });

      await expect((removePassport as any)._handler(ctx, { travellerId })).resolves.toEqual({
        success: true,
      });
      await expect(
        (getPassportMetadata as any)._handler(queryCtx, { travellerId })
      ).resolves.toBeNull();
    } finally {
      if (previousKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousKey;
      }
    }
  });

  test("replacement rechecks scope before commit and preserves the current document", async () => {
    const { ctx: queryCtx, tables } = makePassportCtx({
      jobCards: [{ ...job }],
      passportDetails: [{ ...passportRow }],
      queries: [{ ...linkedQuery }],
      travellers: [{ ...traveller }],
    });
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 10).toString("base64");
    try {
      const { ctx, effects } = makePassportActionCtx(
        queryCtx,
        {
          storage_1: new Blob([new Uint8Array(encryptBuffer(Buffer.from("original passport")))]),
          storage_temp: new Blob(["replacement passport"]),
        },
        (name) => {
          if (name !== "crm/passport:savePassportMetadata") {
            return;
          }
          Object.assign(tables.jobCards[0], {
            operationsOwnerId: "staff_other",
            operationsOwnerName: "Other Operations",
          });
          Object.assign(tables.queries[0], {
            operationsOwnerId: "staff_other",
            operationsOwnerName: "Other Operations",
          });
        }
      );

      await expect(
        (encryptAndStorePassport as any)._handler(ctx, {
          fileName: "replacement.pdf",
          fileSize: 20,
          mimeType: "application/pdf",
          tempStorageId: "storage_temp",
          travellerId,
        })
      ).rejects.toEqual(new ConvexError("FORBIDDEN"));
      expect(effects.storageDeletes).not.toContain("storage_1");
      expect(effects.storageDeletes).toContain("storage_new");

      Object.assign(tables.jobCards[0], job);
      Object.assign(tables.queries[0], linkedQuery);
      await expect(
        (getPassportMetadata as any)._handler(queryCtx, { travellerId })
      ).resolves.toMatchObject({
        fileName: "passport.pdf",
        storageId: "storage_1",
      });
    } finally {
      if (previousKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousKey;
      }
    }
  });

  test("replacement deletes the storage version displaced by its transaction", async () => {
    const { ctx: queryCtx, tables } = makePassportCtx({
      jobCards: [{ ...job }],
      passportDetails: [{ ...passportRow }],
      queries: [{ ...linkedQuery }],
      travellers: [{ ...traveller }],
    });
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
    try {
      const { ctx, effects } = makePassportActionCtx(
        queryCtx,
        {
          storage_1: new Blob(["original encrypted passport"]),
          storage_concurrent: new Blob(["concurrent encrypted passport"]),
          storage_temp: new Blob(["replacement passport"]),
        },
        (name) => {
          if (name === "crm/passport:savePassportMetadata") {
            tables.passportDetails[0].storageId = "storage_concurrent";
          }
        }
      );

      await expect(
        (encryptAndStorePassport as any)._handler(ctx, {
          fileName: "replacement.pdf",
          fileSize: 20,
          mimeType: "application/pdf",
          tempStorageId: "storage_temp",
          travellerId,
        })
      ).resolves.toEqual({ success: true });
      expect(effects.storageDeletes).toContain("storage_concurrent");
      expect(effects.storageDeletes).not.toContain("storage_1");
    } finally {
      if (previousKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousKey;
      }
    }
  });

  test("deletion rechecks scope before commit and preserves the current document", async () => {
    const { ctx: queryCtx, tables } = makePassportCtx({
      jobCards: [{ ...job }],
      passportDetails: [{ ...passportRow }],
      queries: [{ ...linkedQuery }],
      travellers: [{ ...traveller }],
    });
    const { ctx, effects } = makePassportActionCtx(
      queryCtx,
      { storage_1: new Blob(["encrypted passport"]) },
      (name) => {
        if (name !== "crm/passport:deletePassportMetadata") {
          return;
        }
        Object.assign(tables.jobCards[0], {
          operationsOwnerId: "staff_other",
          operationsOwnerName: "Other Operations",
        });
        Object.assign(tables.queries[0], {
          operationsOwnerId: "staff_other",
          operationsOwnerName: "Other Operations",
        });
      }
    );

    await expect((removePassport as any)._handler(ctx, { travellerId })).rejects.toEqual(
      new ConvexError("FORBIDDEN")
    );
    expect(effects.storageDeletes).not.toContain("storage_1");

    Object.assign(tables.jobCards[0], job);
    Object.assign(tables.queries[0], linkedQuery);
    await expect(
      (getPassportMetadata as any)._handler(queryCtx, { travellerId })
    ).resolves.toMatchObject({
      fileName: "passport.pdf",
      storageId: "storage_1",
    });
  });

  test("deletion removes the storage version deleted by its transaction", async () => {
    const { ctx: queryCtx, tables } = makePassportCtx({
      jobCards: [{ ...job }],
      passportDetails: [{ ...passportRow }],
      queries: [{ ...linkedQuery }],
      travellers: [{ ...traveller }],
    });
    const { ctx, effects } = makePassportActionCtx(
      queryCtx,
      {
        storage_1: new Blob(["original encrypted passport"]),
        storage_concurrent: new Blob(["concurrent encrypted passport"]),
      },
      (name) => {
        if (name === "crm/passport:deletePassportMetadata") {
          tables.passportDetails[0].storageId = "storage_concurrent";
        }
      }
    );

    await expect((removePassport as any)._handler(ctx, { travellerId })).resolves.toEqual({
      success: true,
    });
    expect(effects.storageDeletes).toContain("storage_concurrent");
    expect(effects.storageDeletes).not.toContain("storage_1");
  });

  test("invalid traveller id uses the same safe denial as an inaccessible record", async () => {
    const { ctx } = makePassportCtx({
      jobCards: [job],
      passportDetails: [passportRow],
      queries: [linkedQuery],
      travellers: [traveller],
    });
    await expect(
      (getPassportMetadata as any)._handler(ctx, { travellerId: "not-a-traveller-id" })
    ).rejects.toEqual(new ConvexError("FORBIDDEN"));
  });

  test("traveller whose Job Card is missing uses the same safe denial", async () => {
    const { ctx: queryCtx } = makePassportCtx({
      jobCards: [],
      passportDetails: [passportRow],
      queries: [linkedQuery],
      travellers: [traveller],
    });
    await expect((getPassportMetadata as any)._handler(queryCtx, { travellerId })).rejects.toEqual(
      new ConvexError("FORBIDDEN")
    );

    const { ctx: actionCtx, effects } = makePassportActionCtx(queryCtx);
    await expect((generateUploadUrl as any)._handler(actionCtx, { travellerId })).rejects.toEqual(
      new ConvexError("FORBIDDEN")
    );
    expect(effects.storageUploadUrls).toBe(0);
  });

  test("authorized traveller whose passport row was deleted returns null", async () => {
    const { ctx: queryCtx } = makePassportCtx({
      jobCards: [job],
      passportDetails: [],
      queries: [linkedQuery],
      travellers: [traveller],
    });
    await expect(
      (getPassportMetadata as any)._handler(queryCtx, { travellerId })
    ).resolves.toBeNull();

    const { ctx: actionCtx } = makePassportActionCtx(queryCtx);
    await expect((generateUploadUrl as any)._handler(actionCtx, { travellerId })).resolves.toBe(
      "https://storage.example/upload"
    );
  });

  test("staff without view:visa is forbidden", async () => {
    const { ctx } = makePassportCtx(
      {
        jobCards: [job],
        passportDetails: [passportRow],
        queries: [linkedQuery],
        travellers: [traveller],
      },
      { roles: ["Sales"] }
    );
    await expect((getPassportMetadata as any)._handler(ctx, { travellerId })).rejects.toEqual(
      new ConvexError("FORBIDDEN")
    );
  });
});
