export function proposalLinkedQueryIds(proposal) {
  if (Array.isArray(proposal?.queryIds) && proposal.queryIds.length > 0) {
    return proposal.queryIds;
  }
  return proposal?.queryId ? [proposal.queryId] : [];
}

export function proposalPrimaryQuery(proposal) {
  if (proposal?.query) {
    return proposal.query;
  }
  return Array.isArray(proposal?.queries) ? proposal.queries[0] : null;
}

export function proposalLinkedQueryLabel(proposal) {
  const linkedQueries =
    Array.isArray(proposal?.queries) && proposal.queries.length > 0
      ? proposal.queries
      : proposal?.query
        ? [proposal.query]
        : [];
  if (linkedQueries.length === 0) {
    return "-";
  }
  return linkedQueries.map((query) => query.queryCode).join(", ");
}
