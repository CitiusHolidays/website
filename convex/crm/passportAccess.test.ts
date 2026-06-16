import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { loadPassportMetadata } from "./passport";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makePassportCtx(tables: Tables, staffOverrides: Partial<Row> = {}) {
  const staff = {
    _id: "staff_operations" as Id<"staffUsers">,
    authUserId: "auth_operations",
    email: "operations@citiusholidays.com",
    emailNormalized: "operations@citiusholidays.com",
    name: "Operations User",
    roles: ["Operations"],
    active: true,
    ...staffOverrides,
  };
  const allTables: Tables = { staffUsers: [staff], ...tables };
  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        subject: staff.authUserId,
        email: staff.email,
        name: staff.name,
      }),
    },
    db: {
      normalizeId(table: string, id: string) {
        const rows = allTables[table] ?? [];
        return rows.some((row) => row._id === id) ? id : null;
      },
      get: async (id: string) => {
        for (const rows of Object.values(allTables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) return row;
        }
        return null;
      },
      query(table: string) {
        let rows = allTables[table] ?? [];
        return {
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
          unique: async () => rows[0] ?? null,
          collect: async () => [...rows],
        };
      },
    },
  };
  return { ctx, staff };
}

describe("passport metadata access scope", () => {
  const queryId = "queries_1";
  const jobCardId = "jobCards_1";
  const travellerId = "travellers_1";
  const passportId = "passportDetails_1";
  const linkedQuery = {
    _id: queryId,
    queryCode: "Q-0001",
    queryType: "FIT",
    operationsOwnerId: "staff_operations",
    operationsOwnerName: "Operations User",
  };
  const job = {
    _id: jobCardId,
    jobCode: "JC-0001",
    queryId,
    queryType: "FIT",
    operationsOwnerId: "staff_operations",
    operationsOwnerName: "Operations User",
    createdAt: 1,
  };
  const traveller = { _id: travellerId, jobCardId, fullName: "Jane Doe", createdAt: 1 };
  const passportRow = {
    _id: passportId,
    travellerId,
    lastFour: "1234",
    expiryDate: "2030-01-01",
    status: "Received",
    storageId: "storage_1",
    fileName: "passport.pdf",
    mimeType: "application/pdf",
    createdAt: 1_700_000_000_000,
  };

  test("staff with view:visa and job-card visibility receives metadata", async () => {
    const { ctx } = makePassportCtx({
      queries: [linkedQuery],
      jobCards: [job],
      travellers: [traveller],
      passportDetails: [passportRow],
    });
    const metadata = await loadPassportMetadata(ctx as never, travellerId);
    expect(metadata).toEqual({
      id: passportId,
      travellerId,
      lastFour: "1234",
      expiryDate: "2030-01-01",
      status: "Received",
      storageId: "storage_1",
      fileName: "passport.pdf",
      mimeType: "application/pdf",
      createdAt: new Date(passportRow.createdAt).toISOString(),
    });
  });

  test("staff with view:visa but no job-card visibility is forbidden", async () => {
    const { ctx } = makePassportCtx({
      queries: [
        {
          ...linkedQuery,
          operationsOwnerId: "staff_other",
          operationsOwnerName: "Other Operations",
        },
      ],
      jobCards: [
        { ...job, operationsOwnerId: "staff_other", operationsOwnerName: "Other Operations" },
      ],
      travellers: [traveller],
      passportDetails: [passportRow],
    });
    await expect(loadPassportMetadata(ctx as never, travellerId)).rejects.toEqual(
      new ConvexError("FORBIDDEN"),
    );
  });

  test("invalid traveller id returns null", async () => {
    const { ctx } = makePassportCtx({
      queries: [linkedQuery],
      jobCards: [job],
      travellers: [traveller],
      passportDetails: [passportRow],
    });
    await expect(loadPassportMetadata(ctx as never, "not-a-traveller-id")).resolves.toBeNull();
  });

  test("missing passport row returns null", async () => {
    const { ctx } = makePassportCtx({
      queries: [linkedQuery],
      jobCards: [job],
      travellers: [traveller],
      passportDetails: [],
    });
    await expect(loadPassportMetadata(ctx as never, travellerId)).resolves.toBeNull();
  });

  test("staff without view:visa is forbidden", async () => {
    const { ctx } = makePassportCtx(
      {
        queries: [linkedQuery],
        jobCards: [job],
        travellers: [traveller],
        passportDetails: [passportRow],
      },
      { roles: ["Sales"] },
    );
    await expect(loadPassportMetadata(ctx as never, travellerId)).rejects.toEqual(
      new ConvexError("FORBIDDEN"),
    );
  });
});
