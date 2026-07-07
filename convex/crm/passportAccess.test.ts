import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { loadPassportMetadata } from "./passport";

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
  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: staff.email,
        name: staff.name,
        subject: staff.authUserId,
      }),
    },
    db: {
      get: async (id: string) => {
        for (const rows of Object.values(allTables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      normalizeId(table: string, id: string) {
        const rows = allTables[table] ?? [];
        return rows.some((row) => row._id === id) ? id : null;
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
  return { ctx, staff };
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
    const metadata = await loadPassportMetadata(ctx as never, travellerId);
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
    await expect(loadPassportMetadata(ctx as never, travellerId)).rejects.toEqual(
      new ConvexError("FORBIDDEN")
    );
  });

  test("invalid traveller id returns null", async () => {
    const { ctx } = makePassportCtx({
      jobCards: [job],
      passportDetails: [passportRow],
      queries: [linkedQuery],
      travellers: [traveller],
    });
    await expect(loadPassportMetadata(ctx as never, "not-a-traveller-id")).resolves.toBeNull();
  });

  test("missing passport row returns null", async () => {
    const { ctx } = makePassportCtx({
      jobCards: [job],
      passportDetails: [],
      queries: [linkedQuery],
      travellers: [traveller],
    });
    await expect(loadPassportMetadata(ctx as never, travellerId)).resolves.toBeNull();
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
    await expect(loadPassportMetadata(ctx as never, travellerId)).rejects.toEqual(
      new ConvexError("FORBIDDEN")
    );
  });
});
