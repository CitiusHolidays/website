import { describe, expect, test } from "bun:test";
import { canDeleteQuery } from "./queryDeletionAccess";

describe("CanDeleteQuery", () => {
  test("Allows Admin and Directors only", () => {
    expect(canDeleteQuery({ roles: ["Admin"] })).toBe(true);
    expect(canDeleteQuery({ roles: ["Directors"] })).toBe(true);
    expect(canDeleteQuery({ roles: ["Sales"] })).toBe(false);
    expect(canDeleteQuery({ roles: ["Contracting"] })).toBe(false);
    expect(canDeleteQuery({ roles: ["Sales", "Admin"] })).toBe(true);
  });
});
