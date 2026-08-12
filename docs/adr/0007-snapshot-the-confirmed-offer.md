# Snapshot the confirmed offer

Order confirmation creates one immutable Confirmed Offer from the exact Proposal revision handed to
Sales for the selected Query. The handoff key is `{ proposalId, queryId, proposalRevision }`; the
offer stores that revision and handoff identity. Land, airfare, visa, selling price, tax, and
calculated profit come from the immutable handoff snapshot, never editable browser fields.

Sales Decision is the only terminal commercial writer. Contracting Progress cannot set confirmed or
lost outcomes, and the old Proposal acceptance and generic Query status mutations fail closed. A
UUID receipt makes confirmation replay-safe; the receipt is stored only after the offer, Query,
activity, and notification effects succeed. The Query and Confirmed Offer share one `confirmedAt`
clock, and a Query can have at most one offer.

Job Cards inherit commercial values from this snapshot instead of reading a live Proposal. Accounts
must load focused Query detail, sees the exact Proposal and all immutable amounts before Save, and
cannot create a Job Card when the offer is missing. Later Proposal edits cannot silently alter a
confirmed order, and Accounts cannot change the commercial agreement while opening operational
work.
