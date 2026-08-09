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
  let linkedQueries = [];
  if (Array.isArray(proposal?.queries) && proposal.queries.length > 0) {
    linkedQueries = proposal.queries;
  } else if (proposal?.query) {
    linkedQueries = [proposal.query];
  }
  if (linkedQueries.length === 0) {
    return "-";
  }
  const preview = linkedQueries.map((query) => query.queryCode).join(", ");
  const remaining = Math.max(
    0,
    Number(proposal.linkedQueryCount ?? linkedQueries.length) - linkedQueries.length
  );
  return remaining > 0 ? `${preview} +${remaining} more` : preview;
}
