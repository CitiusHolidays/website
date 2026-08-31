import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import { resolveSalesOwnerSelection } from "./queryCreation";

function staffContext(staff: RuntimeObject[]) {
  const query = () => {
    let selected = staff;
    const builder = {
      take: async (limit: number) => selected.slice(0, limit),
      withIndex: (_indexName: string, callback: (range: TestIndexQuery) => TestIndexQuery) => {
        const range: TestIndexQuery = {
          eq: (field: string, value: RuntimeValue) => {
            selected = selected.filter((member) => member[field] === value);
            return range;
          },
        };
        callback(range);
        return builder;
      },
    };
    return builder;
  };
  return {
    db: {
      get: async (_table: string, id: string) => staff.find((member) => member._id === id) ?? null,
      normalizeId: (_table: string, id: string) => id,
      query,
    },
  };
}

describe("Sales Rep selection", () => {
  test("Resolves the submitted stable staff id without requiring an auth-subject fallback", async () => {
    const selected = await resolveSalesOwnerSelection(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(
        staffContext([
          {
            _id: "staff_director",
            active: true,
            authUserId: "auth_director",
            name: "Dana Director",
            roles: ["Directors"],
          },
          {
            _id: "staff_sales",
            active: true,
            name: "Maya Kapoor",
            roles: ["Sales"],
          },
        ])
      ),
      // SAFETY: This test controls the asserted value at the framework boundary below.
      { name: "Dana Director", staffId: fromAny<any, unknown>("staff_director") },
      "staff_sales"
    );

    expect(selected._id).toBe("staff_sales");
    expect(selected.name).toBe("Maya Kapoor");
  });

  test("Rejects a non-Sales staff id", async () => {
    await expect(
      resolveSalesOwnerSelection(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<any, unknown>(
          staffContext([
            {
              _id: "staff_director",
              active: true,
              authUserId: "auth_director",
              name: "Dana Director",
              roles: ["Directors"],
            },
          ])
        ),
        // SAFETY: This test controls the asserted value at the framework boundary below.
        { name: "Dana Director", staffId: fromAny<any, unknown>("staff_director") },
        "staff_director"
      )
    ).rejects.toThrow("Select an active Sales Rep");
  });

  test("Rejects duplicate display names instead of choosing a Staff identity", async () => {
    await expect(
      resolveSalesOwnerSelection(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<any, unknown>(
          staffContext([
            {
              _id: "staff_sales_a",
              active: true,
              name: "Shared Sales",
              roles: ["Sales"],
            },
            {
              _id: "staff_sales_b",
              active: true,
              name: "Shared Sales",
              roles: ["Sales Head"],
            },
          ])
        ),
        { name: "Director" },
        undefined,
        "Shared Sales"
      )
    ).rejects.toThrow("Select one Sales Rep from the staff list");
  });
});
