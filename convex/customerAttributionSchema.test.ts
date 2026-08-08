import { describe, expect, test } from "bun:test";
import schema from "./schema";

describe("customer attribution index rollout", () => {
  test("stages indexes added to existing customer and Query tables", () => {
    const exported = JSON.parse(schema.export()) as {
      tables: Array<{
        stagedDbIndexes: Array<{ fields: string[]; indexDescriptor: string }>;
        tableName: string;
      }>;
    };
    const stagedByTable = Object.fromEntries(
      exported.tables.map((table) => [
        table.tableName,
        table.stagedDbIndexes.map((index) => index.indexDescriptor),
      ])
    );

    expect(stagedByTable.clients).toContain("by_emailNormalized");
    expect(stagedByTable.inboundQueryIntents).toContain("by_contactEmailNormalized");
    expect(stagedByTable.queries).toContain("by_clientId");
  });
});
