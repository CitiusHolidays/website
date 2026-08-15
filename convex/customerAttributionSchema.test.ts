import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import schema from "./schema";

describe("customer attribution index rollout", () => {
  test("keeps Preview-verified indexes enabled on existing customer and Query tables", () => {
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

    expect(indexesByTable.clients).toContain("by_emailNormalized");
    expect(indexesByTable.inboundQueryIntents).toContain("by_contactEmailNormalized");
    expect(indexesByTable.queries).toContain("by_clientId");
  });

  test("reads confirmed trips only through the explicit entitlement index and a cursor", () => {
    const source = readFileSync(new URL("./customerConfirmedTrips.ts", import.meta.url), "utf8");
    const packetPage = source.slice(
      source.indexOf("export async function loadConfirmedTripPacketPage"),
      source.indexOf("export const getMyConfirmedTripPackets")
    );

    expect(packetPage).toContain('withIndex("by_authUserId_createdAt"');
    expect(packetPage).toContain(".paginate(");
    expect(packetPage).not.toContain(".collect(");
    expect(packetPage).not.toContain(".take(");
    expect(source).not.toContain('.query("clients")');
    expect(source).not.toContain('.query("inboundQueryIntents")');
    expect(source).not.toContain("emailNormalized");
  });
});
