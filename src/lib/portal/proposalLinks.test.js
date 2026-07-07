import { describe, expect, test } from "bun:test";
import {
  proposalLinkedQueryIds,
  proposalLinkedQueryLabel,
  proposalPrimaryQuery,
} from "./proposalLinks.js";

describe("proposalLinks", () => {
  test("prefers queryIds array over legacy queryId", () => {
    expect(
      proposalLinkedQueryIds({
        queryId: "legacy",
        queryIds: ["q1", "q2"],
      })
    ).toEqual(["q1", "q2"]);
  });

  test("falls back to single queryId when queryIds is empty", () => {
    expect(proposalLinkedQueryIds({ queryId: "q1", queryIds: [] })).toEqual(["q1"]);
    expect(proposalLinkedQueryIds({ queryId: "q1" })).toEqual(["q1"]);
    expect(proposalLinkedQueryIds({})).toEqual([]);
  });

  test("labels linked queries from queries array", () => {
    expect(
      proposalLinkedQueryLabel({
        queries: [{ queryCode: "QY-1" }, { queryCode: "QY-2" }],
      })
    ).toBe("QY-1, QY-2");
  });

  test("uses primary query for pax and legacy single-query label", () => {
    const primary = { paxCount: 7, queryCode: "QY-9" };
    expect(
      proposalPrimaryQuery({
        queries: [{ queryCode: "OTHER" }],
        query: primary,
      })
    ).toBe(primary);
    expect(proposalLinkedQueryLabel({ query: primary })).toBe("QY-9");
    expect(proposalLinkedQueryLabel({})).toBe("-");
  });
});
