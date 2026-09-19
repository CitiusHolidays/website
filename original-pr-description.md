# Original PR #285 implementation description

Preserved from before the feature inventory. This records historical implementation verification, not new verification on 19 September 2026.

The blog index buried stories beneath an oversized introduction, while Account and Staff pages repeated routine status and secondary information ahead of the task. This implements the audit in #284 and the additional document-preview source work that can proceed without new product or operator decisions.

Closes #284

Stacked on #283 (`codex/implement-burn-portfolio-282`), with review base `b67950fda7ffcc358ac95a7f3c4f74c22f493eb9`. The original checkout and all 27 pre-existing repair files are preserved; those repairs are included in the first commit.

## Changes

- Rebuild the blog as a compact journal with one feature, recent stories, bounded continuation, and article-to-list focus/history restoration.
- Simplify public navigation, Services, Gallery, enquiry entry points and pilgrimage layouts; correct image descriptions, contact ordering, mobile reflow and reduced-motion hydration.
- Remove routine Account confirmation badges and duplicate trip information; retain useful exceptions, itinerary navigation, editable profile and actual preferences.
- Put Staff work queues, record identity and primary actions first. Consolidate table controls, Job Card details, Settings and Activity; correct loaded-data counts, loading/empty states, Contracting attention and Leave identity/status.
- Repair spreadsheet reference calculations and formula search. Connect the existing viewer to direct Job Card entry, retain explicit Download, and restrict multi-file navigation to validated Commercial sources.
- Extend the synthetic preview corpus, local processor measurement contract, five registered authenticated journeys, and run-owned cleanup for records, uploads, preview artifacts and shared storage.

Public, Customer Account, Staff Workspace and Sacred Bharat retain their separate design and permission boundaries. No new dependency or excluded Burn product is introduced.

## Verification

Final source: `d6c24b0a244f3ea110d98061160dcef873d65cb3`.

- Pinned Bun 1.4.0 `verify:local -- --evidence auto` passed: zero-warning lint, ownership-critical docs, application/Convex types, **2,327 Bun tests**, **176 Convex tests**, and high-risk coverage/29 of 29 branch contracts.
- Dead-code ratchet passed: 126 of 183 reviewed findings remain; the baseline is unchanged. Full diff hygiene passed.
- Existing anonymous public Playwright profile: **13 passed, 0 failed, 0 skipped** against localhost.
- Fresh local browser checks: **58 route/viewport states across 29 public routes**, plus **20 journal/article/reflow/Back-focus checks**; zero page/hydration errors or document overflow. These cover the named states, not full authenticated route/role acceptance.
- Fresh local processor measurements: 15 synthetic cases with 20 trials each and validated revision/source/corpus/runtime provenance. No performance budget was adopted.
- Both independent review axes are resolved: three Standards findings and four Spec findings, plus browser/verifier findings. Focused negative controls reproduced the Activity and hydration regressions before their corrections.

The final two-file follow-up fixes CI harness timing: full processor setup gets a 120-second test timeout with all 15×20 trials and regression assertions preserved; Passport tests observe actual focus/open/close readiness. A delayed-frame control reproduced the original CI focus failure and passes with the correction. Application/backend code is unchanged from the browser-verified `1de4a8fc`; browser artifacts retain that revision.

Hosted **Required quality**, automatic **Vercel Preview**, and **Vercel Preview Comments** all passed for `d6c24b0a` ([Hosted Quality run](https://github.com/CitiusHolidays/website/actions/runs/34196197811)). Preview completion does not establish a matching deployed backend or authenticated acceptance.

## Acceptance still requiring outside input or target proof

- Final signed-in laptop/mobile comparison is pending because the Mac is locked. Earlier local signed-in observations were diagnostic, used the existing session and Development backend, and do not establish final-revision or least-privilege-role coverage.
- Four CMS article-opening corrections are prepared but unpublished.
- The five new preview journeys are registered, not executed. A matching approved non-production frontend/backend, role fixtures, operated isolated converter, representative complex corpus, accepted performance budgets and zero-residual run proof remain required. Local processor timings do not measure reader/browser latency; legacy `.doc`, `.ppt` and `.xls` remain download-only under ADR 0014.
- All 25 other open issues were assessed. Director/product decisions, approved branding/licensed content, provider/security policy and configuration, target migrations and Production observation retain their existing gates. No issue family is treated as fully accepted because its source exists.

Additional source work: refs #187, #188, #189, #192, #193, #194, #195, #197, #198, #199. See `docs/DOCUMENT_PREVIEW_VERIFICATION.md` for the source-to-acceptance matrix.

No merge, Production operation, CMS publication, provider send or target data migration is included in this work. Automated hosted quality and Vercel Preview results are separate from local and authenticated evidence.

