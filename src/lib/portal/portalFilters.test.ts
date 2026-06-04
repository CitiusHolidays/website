import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import {
  assertBulkDeleteLimit,
  filterRecordsByDateRange,
  requestedProposalQueryIds,
  resolvePortalDateRange,
} from "../../../convex/crm/lib";

describe("portal date range filters", () => {
  test("returns all records when range is empty", () => {
    const rows = [
      { createdAt: Date.parse("2026-01-10T00:00:00Z") },
      { createdAt: Date.parse("2026-02-10T00:00:00Z") },
    ];
    expect(filterRecordsByDateRange(rows, undefined)).toEqual(rows);
    expect(resolvePortalDateRange(undefined)).toBeNull();
  });

  test("filters Convex createdAt timestamps inclusively through end day", () => {
    const inRange = Date.parse("2026-01-15T18:00:00Z");
    const outRange = Date.parse("2025-12-31T00:00:00Z");
    const rows = [{ createdAt: inRange }, { createdAt: outRange }];
    const filtered = filterRecordsByDateRange(rows, { from: "2026-01-01", to: "2026-01-31" });
    expect(filtered).toEqual([{ createdAt: inRange }]);
  });

  test("supports open-ended from-only ranges", () => {
    const recent = Date.parse("2026-02-01T12:00:00Z");
    const old = Date.parse("2025-01-01T12:00:00Z");
    const filtered = filterRecordsByDateRange(
      [{ createdAt: recent }, { createdAt: old }],
      { from: "2026-01-01" },
    );
    expect(filtered).toEqual([{ createdAt: recent }]);
  });
});

describe("requestedProposalQueryIds", () => {
  test("honors explicit queryIds including empty list", () => {
    expect(requestedProposalQueryIds({ queryIds: ["q1", "q2"] })).toEqual(["q1", "q2"]);
    expect(requestedProposalQueryIds({ queryIds: [], queryId: "legacy" })).toEqual([]);
  });

  test("maps legacy queryId to a single-item array", () => {
    expect(requestedProposalQueryIds({ queryId: "q1" })).toEqual(["q1"]);
    expect(requestedProposalQueryIds({ queryId: "" })).toEqual([]);
  });

  test("returns null when neither field is provided", () => {
    expect(requestedProposalQueryIds({})).toBeNull();
  });
});

describe("assertBulkDeleteLimit", () => {
  test("rejects empty bulk deletes", () => {
    expect(() => assertBulkDeleteLimit(0)).toThrow(ConvexError);
    expect(() => assertBulkDeleteLimit(1)).not.toThrow();
    expect(() => assertBulkDeleteLimit(500)).not.toThrow();
  });
});
