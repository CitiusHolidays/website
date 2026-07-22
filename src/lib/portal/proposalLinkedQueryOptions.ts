import { proposalLinkedQueryIds } from "@/lib/portal/proposalLinks";

type ProposalLinkSource = {
  id?: string;
  queryId?: string;
  queryIds?: string[];
  status?: string;
};

type QueryOptionSource = {
  id: string;
  salesStatus?: string;
};

function isQueryLinkedToAcceptedProposal(
  queryId: string,
  proposals: ProposalLinkSource[],
  editingProposalId?: string
) {
  return proposals.some((proposal) => {
    if (editingProposalId && String(proposal.id) === String(editingProposalId)) {
      return false;
    }
    if (proposal.status !== "Accepted") {
      return false;
    }
    return proposalLinkedQueryIds(proposal).includes(queryId);
  });
}

export function isProposalLinkedQueryEligible(
  query: QueryOptionSource,
  proposals: ProposalLinkSource[],
  editingProposalId?: string
) {
  if (query.salesStatus !== "Order Confirmed") {
    return true;
  }
  return !isQueryLinkedToAcceptedProposal(query.id, proposals, editingProposalId);
}

export function proposalLinkedQueryOptions(
  queries: QueryOptionSource[],
  proposals: ProposalLinkSource[],
  selectedQueryIds: string[],
  editingProposalId?: string
) {
  const selected = new Set(selectedQueryIds);
  return queries.filter((query) => {
    if (selected.has(query.id)) {
      return true;
    }
    return isProposalLinkedQueryEligible(query, proposals, editingProposalId);
  });
}
