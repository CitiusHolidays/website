# Sacred Bharat recurring editions

The file-backed registry at `src/data/sacredBharat/editionRegistry.js` is the publication boundary.
Each edition is a reviewed content file with five questions, an explicit publication state,
edition-owned media and metadata, a CC0 Story image, a closed event vocabulary, and a dated content
record. The registry names one active edition separately from the list of retained editions.

Only Edition 001 is registered. The recurring contract is proven with synthetic editions in tests;
synthetic content is never imported by the production registry.

## Stable entry and archive policy

- `/sacred-bharat` opens the explicit active selector.
- New share artifacts use `/sacred-bharat/{edition}` so a later active-edition change cannot rewrite
  their meaning.
- Existing unversioned links with a valid `via` token remain bound to Edition 001.
- `/sacred-bharat/{edition}` renders only a registered edition. Unknown edition ids fail closed.
- Retired tracker routes keep their existing redirects, Journey Planner remains HTTP 410, and no
  historical record is deleted or migrated by edition publication.

## Events and insight

The API and Convex gateway derive their edition, question, score, style, and event allowlists from the
same registry. Schema fields are source-widened to strings so a future reviewed edition can be
represented, but runtime policy rejects every unregistered identity. Anonymous tokens remain hashed
and expire after 30 days. The exact-Admin insight query stays range-bounded and returns aggregate
counts only; it exposes no event rows, tokens, person identity, Account identity, or CRM handoff.

No schema migration, deployment, target write, historical cleanup, or hosted proof is part of this
source change.

## Provenance and crop gate

Each question records the canonical HTTPS fact and image sources, creator, licence, local
edition-owned WebP path, and reviewed 4:5 output dimensions. Registry validation permits only the
documented crop and WebP conversion steps. The asset test checks the file format and exact dimensions
on disk. Factual and cultural review remain human publication gates; passing validation does not
approve the content.

## Edition 002 activation blocker

Edition 002 must not be added to the production registry or selected as active until all of these
owners have supplied reviewed evidence:

- the cultural owner approves every prompt, distractor, reveal, fact, alt, and image treatment;
- the editorial owner approves the complete five-question edition and correction record;
- the source owner approves every factual source and source-to-claim mapping;
- the licence owner approves each original, derivative crop, attribution, and Story-artifact use;
- the old-link/data owner approves the retained Edition 001 link policy, existing anonymous-row
  interpretation, target-specific schema rehearsal, retention, and rollback.

After those approvals, publication still needs an exact reviewed Edition 002 file and assets,
accessibility and browser proof, an authorized migration rehearsal for the exact target, a separate
publication-control decision, and separately authorized Preview/Production evidence. None exists in
this commit.
