import { describe, expect, test } from "bun:test";
import {
  isProposalLinkedQueryEligible,
  proposalLinkedQueryOptions,
} from "./proposalLinkedQueryOptions";

describe("proposalLinkedQueryOptions", () => {
  const queries = [
    { id: "q_open", salesStatus: "Proposal in discussion" },
    { id: "q_confirmed", salesStatus: "Order Confirmed" },
    { id: "q_confirmed_other", salesStatus: "Order Confirmed" },
  ];

  const proposals = [
    {
      id: "p_accepted",
      queryIds: ["q_confirmed"],
      status: "Accepted",
    },
    {
      id: "p_sent",
      queryIds: ["q_confirmed_other"],
      status: "Sent",
    },
  ];

  test("hides Order Confirmed queries linked to an Accepted proposal", () => {
    expect(isProposalLinkedQueryEligible(queries[1], proposals)).toBe(false);
    expect(isProposalLinkedQueryEligible(queries[2], proposals)).toBe(true);
    expect(isProposalLinkedQueryEligible(queries[0], proposals)).toBe(true);
  });

  test("preserves selected queries while editing", () => {
    const options = proposalLinkedQueryOptions(queries, proposals, ["q_confirmed"], "p_editing");
    expect(options.map((query) => query.id)).toEqual([
      "q_open",
      "q_confirmed",
      "q_confirmed_other",
    ]);
  });

  test("ignores the proposal currently being edited when checking eligibility", () => {
    expect(isProposalLinkedQueryEligible(queries[1], proposals, "p_accepted")).toBe(true);
  });
});
