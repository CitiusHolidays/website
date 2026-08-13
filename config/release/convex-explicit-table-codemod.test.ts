import { describe, expect, test } from "bun:test";
import { uniqueTableName } from "./convex-explicit-table-codemod";
import { runExplicitTableMockCodemod } from "./convex-explicit-table-mock-codemod";

describe("Convex explicit-table codemod", () => {
  test("extracts one concrete table from generated Id types", () => {
    expect(uniqueTableName('Id<"queries">')).toBe("queries");
    expect(uniqueTableName('string & { __tableName: "staffUsers"; }')).toBe("staffUsers");
  });

  test("refuses ambiguous, generic, and erased ID types", () => {
    expect(uniqueTableName('Id<"queries"> | Id<"jobCards">')).toBeNull();
    expect(uniqueTableName("Id<TableName>")).toBeNull();
    expect(uniqueTableName("any")).toBeNull();
  });

  test("keeps direct Convex database mocks on the explicit-table signature", () => {
    expect(runExplicitTableMockCodemod({ write: false })).toMatchObject({
      rewrites: 0,
      write: false,
    });
  });
});
