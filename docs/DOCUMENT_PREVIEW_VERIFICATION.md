# Document Preview verification

GitHub [#187](https://github.com/CitiusHolidays/website/issues/187) and its child
issues own the specification. This reference describes executable proof seams
and their limits; it does not close their acceptance criteria. Keep the
[verification vocabulary](VERIFICATION.md), [E2E target guard](E2E_TESTING.md), and
[first-party preview decision](adr/0014-keep-document-preview-first-party.md)
in force.

## Source corpus and local measurements

`e2e/fixtures/documentPreviewCorpus.ts` creates deterministic synthetic PDF,
PNG, text, DOCX, PPTX, and XLSX files at small and exact 15 MiB source sizes.
The small fixtures include two PDF pages, two Word pages, two slides, and a
two-sheet workbook with safe, stored unsupported, and missing formula results.
Separate JPEG, GIF, and WebP fixtures exercise every accepted raster decoder.
Malformed, encrypted, and declared-expansion XLSX fixtures exercise unavailable
recovery. No customer files are required.

The 15 MiB fixtures use inert padding. They prove the source-size boundary, not
complex layout fidelity, large decoded images, large sheet populations, or
representative page/slide counts. The installed Office parser, spreadsheet
preparer, image decoder, and safety checks validate the fixture bytes in
`e2e/fixtures/documentPreviewCorpus.test.ts`. The browser journeys use the small
fixtures; a through-limit rendering claim requires a separate reviewed run.

Run the existing Bun tests with:

```sh
bun run test -- e2e/fixtures/documentPreviewCorpus.test.ts config/release/document-preview-performance.test.ts e2e/registry/portalViews.test.ts
```

The bounded local processor measurement reuses these fixtures and the current
processors. It takes 20 serial trials per case and emits only format, scenario,
size band, metric, outcome, p50, p95, and provenance. PDF/image/Word/PowerPoint
measure safety checks; text measures decoding; XLSX measures workbook
preparation, including the three hostile cases. The p50 is the median of the
20 samples and p95 is the nearest-rank 19th sample. Fixture construction and
copying occur outside the measured interval. Serial execution bounds memory;
it does not measure simultaneous viewers.

```sh
bun run performance:preview:local -- --measure-local > .scratch/preview-processors.json
bun run performance:preview:local -- --check-local .scratch/preview-processors.json .scratch/reviewed-preview-processors.json
```

The evidence binds the exact revision, clean/dirty state, recursive local
processor-source closure, lockfile/package input, corpus bytes, Bun/platform,
and a digest of runtime hardware/OS properties. It contains no hostname,
filename, source/storage ID, text, formula, cell value, credentials, or content.
Strict parsing rejects unknown fields, missing provenance, malformed
percentiles, and an incomplete or reordered corpus. Regression checking rejects
dirty, stale, or incomparable evidence and either p50 or p95 above the supplied
measured baseline. It never writes or replaces an accepted baseline.

There is **no accepted preview performance baseline in the repository**. Missing
baselines cannot pass. Source/corpus/environment changes require fresh evidence
and review; copying a candidate into the baseline position is not budget
acceptance. Before a baseline is accepted or replaced, record representative
corpus review, source-closure review, privacy review, stable repeated results,
and the written reason for any changed budget. Test-only numeric values exercise
the comparator and are not performance allowances.

These local measurements exclude viewer response, browser/WASM rendering,
network delivery, upload completion, active warming, prepared-artifact delivery,
uncached conversion, operational retry, concurrent viewers, and Staff Workspace
responsiveness. Those #198 metrics and their accepted p50/p95 thresholds remain
**unmeasured** until the named runtime and representative corpus are available.
The existing Staff route/resource/subscription budgets remain unchanged.

## Registered browser journeys

`e2e/specs/document-preview.spec.ts` registers five real journeys in the existing
Playwright harness and `e2e/registry/portalViews.ts`:

| Journey | Source-owned assertions |
| --- | --- |
| `document-preview-formats` | All six current format families and all raster types; visible decoded content, search/zoom/rotation as applicable, safe formula results and marked exceptions, no implicit download, explicit original bytes, first-party/private response headers, blocked fixture external links, filters/focus, 390 px/reduced-motion, durable URL and denied role. |
| `document-preview-lifecycle` | Filtered Previous/Next order with one byte request per selected file, original download after corrupt/encrypted/expansion failure, Back/focus restoration, explicit retry UI, recoverable deletion denial and restoration. The injected transport failure proves UI recovery, not operated-converter retry. |
| `document-preview-chain` | Query attachment, Proposal working file and replacement Proposal Doc, updated searchable content, original download, linked Sales visibility without source-team mutation authority or Proposal Doc history. |
| `document-preview-expense` | Owned Finance expense attachment, explicit download, single-file isolation, 390 px deep link and unrelated-role denial. |
| `document-preview-passport` | Operations encrypted passport upload/view/download, single-Traveller isolation, 390 px deep link and unrelated-role denial. The existing authorized Job Card product precondition remains explicit. |

Discovery is target-neutral and does not launch a browser:

```sh
bun run test:e2e:optional -- e2e/specs/document-preview.spec.ts --list
```

Registration is not execution. The existing reporter counts a cell as executed
only when that exact title passes in the selected run; a missing credential or
product-precondition skip contributes zero. Do not substitute optional discovery
for the strict run. After explicit authority and the approved target manifest
exist, the strict command is:

```sh
bun run test:e2e -- e2e/specs/document-preview.spec.ts
```

The harness must prove the complete owned graph is clean after these upload and
preview paths: Query/Proposal/expense/Traveller, original and encrypted storage,
upload sessions, Commercial Files and attachment projections, current and
historical Proposal Docs, preview operations/deliveries/artifacts, and ownership
ledger rows. Source-owned cleanup now tracks this graph and preserves shared
storage references; zero residuals remain a separate post-run proof, not inferred
from closing contexts.

## Current issue assessment and remaining gates

| Issue | Current source seam | Proof or contract gap retained |
| --- | --- | --- |
| #187 | Shared first-party host, route authorization and current-format processors; all seams below. | Parent completion requires the combined source, representative corpus, runtime, authorized target, and cleanup proof. |
| #188 | PDF source delivery, lazy worker rendering, host state/URL/focus contracts. | Through-limit representative render and complete keyboard, screen-reader, 200% zoom and coarse-pointer target proof. |
| #189 | Raster signatures/dimensions and plain-text rendering/search; synthetic raster decoding. | Representative empty/corrupt/resource-intensive all-format render and target accessibility/privacy proof. |
| #190 | Replay-safe Office preparation, source tickets, leases and lifecycle tests. | Separately operated converter isolation, resource/concurrency limits, actual artifact production and independent upload timing. |
| #191 | DOCX/PPTX first-party browser parsing/rendering and safe archive boundaries. | `.doc`/`.ppt` are download-only under ADR 0014; representative complex layout, unsupported embedded-content and isolated-runtime proof remain. |
| #192 | XLSX preparation, workbook-local safe formula tests, and a fixture with recalculated, stored unsupported and missing values. | `.xls` is download-only under ADR 0014; reviewed representative large/complex workbook oracle and isolated browser/network proof across the full approved subset remain. |
| #193 | Filtered navigation, durable internal URLs, Back/focus restoration and selected-file-only byte requests. | Authenticated loaded-page/selection/scroll restoration, permission loss, keyboard and adjacent-byte isolation across the full source matrix. |
| #194 | Shared Query/Proposal/Proposal Doc/Commercial File entry points, direct Job Card viewer with separate View/Download, and chain journey. | Prove linked-role context and commercial-file navigation on the exact target. |
| #195 | Bounded replay-safe warming, lease expiry, replacement/deletion/restoration and purge integration tests. | Operated interrupted warming/conversion and artifact lifecycle on the exact target, including no orphaned storage. |
| #196 | Traveller-scoped encrypted passport source and isolated viewer. | No visa-document storage/preview source exists in the current model; visa tracking is status/appointment data. Visa file semantics and an owning route cannot be inferred. Passport scope/Cement/sibling/permission-loss target proof remains. |
| #197 | Expense-authorized attachment source and single-file viewer. | Expense role/scope, permission loss, accessibility and encrypted/corrupt target proof. |
| #198 | Deterministic corpus, local processor p50/p95 measurement and strict regression evidence parser. | Approved representative corpus, all named browser/worker/upload/Staff metrics, and reviewed fastest stable budgets remain unmeasured. |
| #199 | Five dedicated journeys, strict target/revision harness, and source-owned record/storage cleanup with shared-reference preservation. | Exact approved non-production frontend/Convex pair, reviewed deployed SHA/backend fingerprint, credentials, authority, operated runtime, accepted budgets, complete run and zero-residual cleanup. |

The current ADR deliberately restricts legacy binaries to Download until a
bounded first-party renderer exists. The older issue criteria requesting those
formats remain unmet; this work neither widens that contract nor marks them
complete. The same distinction applies to the absent visa-file source.

`convex/crm/documentPreview.convex.integration.ts` owns registered source-ticket,
fresh authorization, separate View/Download audit, replay-safe generation,
lease expiry, stale artifact, replacement, recoverable deletion/restoration,
and bounded warming tests. `convex/crm/commercialFilePurge.convex.integration.ts`
owns bounded purge and shared-storage preservation. Local registered-handler
tests do not prove an operated external converter, deployed configuration, or
actual target-wide cleanup. Mounted host tests own pending-close/unmount and
permission-loss content disposal; do not replace those tests with a static
source-text assertion.

Before target contact, use the existing strict schema-v3 approved manifest and
preflight to verify the exact non-production frontend origin, Convex deployment
origin, target ID, clean reviewed 40-character frontend revision, code-baked
backend source fingerprint, protected credentials, and explicit authority.
Deploy/activation, authenticated execution, measurement, cleanup, and revocation
of any temporary bypass each need their own evidence state. This reference
authorizes no deployment, warming, seed, provider action, migration, or Production
access.
