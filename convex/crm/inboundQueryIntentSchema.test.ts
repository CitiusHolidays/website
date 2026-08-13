import { describe, expect, test } from "bun:test";
import schema from "../schema";

describe("inbound Query intent index rollout", () => {
  test("stages the compound triage and direct handoff indexes before readers switch", () => {
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

    expect(stagedByTable.inboundQueryIntents).toEqual(
      expect.arrayContaining(["by_status_createdAt", "by_status_source_createdAt"])
    );
    expect(stagedByTable.crmHandoffEvents).toContain("by_inboundIntentId_createdAt");
  });
});
