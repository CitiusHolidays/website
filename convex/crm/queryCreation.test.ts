import { describe, expect, test } from "bun:test";
import { resolveSalesOwnerSelection } from "./queryCreation";

function staffContext(staff: Array<Record<string, unknown>>) {
  return {
    db: {
      get: async (id: string) => staff.find((member) => member._id === id) ?? null,
      normalizeId: (_table: string, id: string) => id,
      query: () => ({ collect: async () => staff }),
    },
  };
}

describe("Sales Rep selection", () => {
  test("resolves the submitted stable staff id instead of the query creator", async () => {
    const selected = await resolveSalesOwnerSelection(
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
          authUserId: "auth_sales",
          name: "Maya Kapoor",
          roles: ["Sales"],
        },
      ]) as any,
      { name: "Dana Director", staffId: "staff_director" as any },
      "staff_sales"
    );

    expect(selected.authUserId).toBe("auth_sales");
    expect(selected.name).toBe("Maya Kapoor");
  });

  test("rejects a non-Sales staff id", async () => {
    await expect(
      resolveSalesOwnerSelection(
        staffContext([
          {
            _id: "staff_director",
            active: true,
            authUserId: "auth_director",
            name: "Dana Director",
            roles: ["Directors"],
          },
        ]) as any,
        { name: "Dana Director", staffId: "staff_director" as any },
        "staff_director"
      )
    ).rejects.toThrow("Select an active Sales Rep");
  });
});
