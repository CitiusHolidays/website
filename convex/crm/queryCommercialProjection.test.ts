import { describe, expect, test } from "bun:test";
import { selectLatestProposal, selectProposalDocument } from "./queryCommercialProjection";

const proposal = (proposalId: string, updatedAt: number) => ({
  costPrice: 10,
  handedOffRevision: undefined,
  proposalCode: proposalId,
  // SAFETY: This test controls the asserted value at the framework boundary below.
  proposalId: proposalId as never,
  proposalRevision: 1,
  status: "Draft",
  updatedAt,
});

const document = (
  proposalId: string,
  rank: number,
  uploadedAt: number | undefined,
  updatedAt: number
) => ({
  fileName: `${proposalId}.pdf`,
  // SAFETY: This test controls the asserted value at the framework boundary below.
  proposalId: proposalId as never,
  rank,
  updatedAt,
  uploadedAt,
});

describe("Query commercial projection selection", () => {
  test("Selects the newest proposal with a deterministic id tie-break", () => {
    expect(selectLatestProposal(proposal("p1", 20), proposal("p2", 10)).proposalId).toBe("p1");
    expect(selectLatestProposal(proposal("p1", 20), proposal("p2", 20)).proposalId).toBe("p2");
  });

  test("Prefers Accepted documents before Sent, then newest upload", () => {
    const accepted = document("accepted", 0, 10, 100);
    const sent = document("sent", 1, 200, 200);
    expect(selectProposalDocument(sent, accepted)?.proposalId).toBe("accepted");

    const newerAccepted = document("accepted-new", 0, 20, 90);
    expect(selectProposalDocument(accepted, newerAccepted)?.proposalId).toBe("accepted-new");
  });

  test("Stores metadata only and never exposes a storage id", () => {
    const selected = selectProposalDocument(undefined, document("p1", 0, 10, 20));
    expect(selected).toEqual({
      fileName: "p1.pdf",
      proposalId: "p1",
      rank: 0,
      updatedAt: 20,
      uploadedAt: 10,
    });
    expect("storageId" in (selected ?? {})).toBe(false);
  });
});
