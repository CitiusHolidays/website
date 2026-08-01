# Team-scoped Commercial Files in the portal

**Status:** accepted

The portal will expose non-sensitive Commercial Files through a table-integrated modal across the linked Query, Proposal, and Job Card chain, while retaining source ownership and the read-only sharing boundary established by ADR 0006. A logical file registry will preserve source record, Team File Area, uploader provenance, category, notes, history, and deletion state without duplicating stored file bytes; the Source-owning team manages its files, other chain-authorized teams read/download them, explicit deletes remain recoverable for 14 days before system purge, and Proposal Doc replacements are retained as private restorable history. This was chosen over a separate portal tab and ad hoc per-file sharing so teams can collaborate in their existing tables without widening sensitive-document access or interrupting workflow.
