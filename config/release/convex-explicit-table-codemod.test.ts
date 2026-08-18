import { describe, expect, test } from "bun:test";
import { uniqueTableName } from "./convex-explicit-table-codemod";
import {
  legacyExplicitTableMockRewritesInSource,
  runExplicitTableMockCodemod,
} from "./convex-explicit-table-mock-codemod";

describe("Convex explicit-table codemod", () => {
  test("Extracts one concrete table from generated Id types", () => {
    expect(uniqueTableName('Id<"queries">')).toBe("queries");
    expect(uniqueTableName('string & { __tableName: "staffUsers"; }')).toBe("staffUsers");
  });

  test("Refuses ambiguous, generic, and erased ID types", () => {
    expect(uniqueTableName('Id<"queries"> | Id<"jobCards">')).toBeNull();
    expect(uniqueTableName("Id<TableName>")).toBeNull();
    expect(uniqueTableName("any")).toBeNull();
  });

  test("Keeps direct Convex database mocks on the explicit-table signature", () => {
    expect(runExplicitTableMockCodemod({ write: false })).toMatchObject({
      rewrites: 0,
      write: false,
    });
  });

  test("Finds legacy database mocks delegated to a local helper", () => {
    const source = `
      const findById = async (id: string) => rows.get(id);
      const ctx = { db: { get: findById } };
    `;
    expect(legacyExplicitTableMockRewritesInSource(source, "fixture.test.ts")).toEqual([
      expect.objectContaining({ file: "fixture.test.ts", method: "get" }),
    ]);
  });
});
