import { describe, expect, test } from "bun:test";
import {
  buildOwnerSuggestions,
  buildRoleCapacitySummary,
  buildStaffCapacityRows,
} from "./capacity.js";

describe("capacity", () => {
  test("computes staff load and role summaries", () => {
    const rows = buildStaffCapacityRows({
      staff: [{ _id: "s1", name: "A", roles: ["Sales"] }],
      queries: [{ salesOwnerId: "s1", salesStatus: "Proposal in discussion" }],
      jobCards: [],
    });
    expect(rows[0].load).toBe(1);
    expect(buildRoleCapacitySummary(rows)[0]).toMatchObject({ role: "Sales", staffCount: 1 });
    expect(buildOwnerSuggestions(rows)[0].id).toBe("s1");
  });
});
