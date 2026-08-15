import { describe, expect, test } from "bun:test";
import schema from "../schema";

describe("inbound Query intent index rollout", () => {
  test("keeps the Preview-verified triage and direct handoff indexes enabled", () => {
    const exported = JSON.parse(schema.export()) as {
      tables: Array<{
        indexes: Array<{ fields: string[]; indexDescriptor: string }>;
        tableName: string;
      }>;
    };
    const indexesByTable = Object.fromEntries(
      exported.tables.map((table) => [
        table.tableName,
        table.indexes.map((index) => index.indexDescriptor),
      ])
    );

    expect(indexesByTable.inboundQueryIntents).toEqual(
      expect.arrayContaining(["by_status_createdAt", "by_status_source_createdAt"])
    );
    expect(indexesByTable.crmHandoffEvents).toContain("by_inboundIntentId_createdAt");
  });
});
