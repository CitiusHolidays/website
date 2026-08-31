import { describe, expect, test } from "bun:test";
import schema from "./schema";

interface ExportedIndex {
  fields: string[];
  indexDescriptor: string;
}

interface ExportedTable {
  indexes: ExportedIndex[];
  stagedDbIndexes: ExportedIndex[];
  tableName: string;
}

function exportedTable(tableName: string) {
  // SAFETY: Convex owns schema.export(); this test validates the asserted table shape immediately below.
  const exported = JSON.parse(schema.export()) as { tables: ExportedTable[] };
  const table = exported.tables.find((candidate) => candidate.tableName === tableName);
  expect(table, `Schema should export ${tableName}`).toBeDefined();
  if (!table) {
    throw new Error(`Schema should export ${tableName}`);
  }
  return table;
}

describe("populated-table index staging", () => {
  test("keeps organization-wide scorecard clocks staged and out of active readers", () => {
    expect(exportedTable("confirmedOffers")).toMatchObject({
      indexes: expect.not.arrayContaining([
        { fields: ["createdAt"], indexDescriptor: "by_createdAt" },
      ]),
      stagedDbIndexes: [{ fields: ["createdAt"], indexDescriptor: "by_createdAt" }],
    });
    expect(exportedTable("proposalQueryHandoffs")).toMatchObject({
      indexes: expect.not.arrayContaining([
        { fields: ["handedOffAt"], indexDescriptor: "by_handedOffAt" },
      ]),
      stagedDbIndexes: [{ fields: ["handedOffAt"], indexDescriptor: "by_handedOffAt" }],
    });
  });

  test("does not retain the unused payment outcome index", () => {
    const table = exportedTable("bookingPaymentEvents");
    expect([...table.indexes, ...table.stagedDbIndexes]).not.toContainEqual({
      fields: ["outcome", "createdAt"],
      indexDescriptor: "by_outcome_createdAt",
    });
  });
});
