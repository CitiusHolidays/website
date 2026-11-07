# React Doctor triage record

This repository pins React Doctor `0.9.22`; the 2026-08-20 review below was made with `0.9.11`.
That repository-wide review began from an
ignore-free scan of 1,394 files: 614 diagnostics (20 errors and 594 warnings) across 210 files. The
previous configuration displayed five warnings in four files and suppressed 609 diagnostics.

The reviewed configured scan now reports 100/100 with no diagnostics:

```sh
bun run doctor -- --verbose
```

This is local static-analysis evidence, not browser, Preview, or Production proof.

## Findings removed from ignores and fixed

- 395 manual-memoization diagnostics were removed by unwrapping obsolete `useMemo` and
  `useCallback` calls after TypeScript and focused tests proved the compiler-safe mechanical
  recipe. The former repository-wide manual-memoization override is gone.
- Sequential collection passes, linear lookups, URL parsing, length guards, fetch-status checks,
  loading cleanup, reducer state, accessible labels, object URL lifecycles, and unused source were
  corrected at their call sites.
- Render-time ref writes, impure state updater side effects, stale effect dependencies, and
  set-state synchronization were refactored rather than suppressed.
- Oversized Portal/document/import components were split into focused hooks, stores, renderers,
  and view sections. Fast Refresh component-only modules were separated where the finding was
  real.
- Unused files and exports were removed only after callers, dynamic registration, framework
  discovery, scripts, and tests were checked. A second ignore-free scan caught seven auth helper
  exports that the first pass had treated too generously; source search proved they had no caller,
  so they were deleted and their exception was removed.

## Narrow reviewed exceptions

`doctor.config.json` contains no directory wildcard, category-wide exemption, or empty override.
The final ignore-free scan reports 122 retained diagnostics: 48 ordered loop awaits, 32 ordered
await sequences, 19 dynamically loaded tool files, and 23 individual framework or analyzer
limitations. Every override names the exact file and rule whose behavior was inspected:

| Scope | Rule | Evidence |
|---|---|---|
| Listed Convex migrations, projections, paginated transactions, and integration tests | `async-await-in-loop`, `server-sequential-independent-await` | Iterations carry cursors, revisions, transaction ordering, deterministic test state, or bounded external pacing. Reordering changes behavior. |
| `config/release/migration-rehearsal.ts` | `path-traversal-risk` | The CLI validates the requested migration against its checked-in registry before constructing the local path. |
| `convex/crm/e2eSeedActions.ts` | `async-parallel` | Seed registration is deliberately ordered so later fixtures can reference earlier durable IDs. |
| Portal action/route lifecycle modules | `only-export-components` | The co-located exports are React component wrappers or route lifecycle models consumed together; the analyzer cannot identify the wrapper contract. |
| Three reviewed transition boundaries | `motion-animate-presence-must-outlive-child` | The parent boundary intentionally owns error, modal, or image replacement transitions and remains mounted for exit completion. |
| Document preview host | fetch/effect post-await findings | The request is event-driven, uses `AbortController` plus a disposed guard, revokes resources, and keeps status parsing and cleanup in one lifecycle. |
| Spreadsheet shell and Chatbot messages | prop-adjust/set-state findings | State represents an explicit exit-animation snapshot or screen-reader announcement, not renderable derived state. |
| Passenger export | object URL finding | Every created download URL is revoked in the same action lifecycle. |
| AI grounding benchmark | set/map lookup finding | The flagged expression is substring matching, not repeated membership lookup. |
| Office check-in IP parsing | `js-length-check-first` | `parseIp` tests a 12-byte IPv4-mapped prefix against a 16-byte IPv6 address. Requiring equal lengths would stop mapped clients matching IPv4 office ranges; the IPv4-mapped cases in `officeCheckInVerification.test.ts` pin the prefix behavior. |
| Tracked Convex subscriptions | crypto and compiler TODO findings | SHA-256 is a non-security dedupe fingerprint; the compiler limitation is a dynamic hook-spread registry with focused lifecycle tests. |
| Better Auth delivery correlation | `url-prefilled-privileged-action` | The URL carries only a random opaque correlation. Staff-setup routing requires a matching server-written, expiring intent bound to the recipient digest and purpose; crafted URL values fall back to the ordinary verification/reset control in regression tests. |
| Exact vendored Oxlint anti-slop source files | `unused-file` | Oxlint loads the plugin entrypoint and its rule modules through `oxlint.config.ts`; `bun run lint:anti-slop` is the executable contract. |
| `package.json` | `unused-dependency` | `brace-expansion` and `undici` are deliberate patched transitive security floors protected by ADR 0010 and the package contract test. |
| Office staff assignment dialog | `async-await-in-loop` | Each person is saved in turn so every row shows its own outcome and one failure does not stop the rest. |
| Transactional email template (`convex/lib/transactionalEmail.tsx`) | `only-export-components` | Rendered to HTML inside Convex; it is never loaded by the browser, so Fast Refresh does not apply. |
| Auth layout artwork script | `nextjs-no-native-script`, `rendering-script-defer-async` | The script must choose and preload one hero image before first paint. `next/script` `beforeInteractive` is only allowed in the root layout, and `afterInteractive` would flash a different image. The config path uses `[(]auth[)]` because the matcher treats bare parentheses as a group. |
| Notification inbox times | `no-locale-format-in-render` | Inbox rows come only from client Convex subscriptions (`useQuery`; no server preloading), so no time is rendered during server rendering and no hydration mismatch can occur. |
| Document preview host polling | `effect-needs-cleanup` | The poll timer lives in `pollTimerRef`; the effect cleanup and `close()` both clear it. The analyzer does not follow the ref. |
| Delete session form | `no-loading-flag-reset-outside-finally` | The request is settled with `.then(onFulfilled, onRejected)` before the busy flags reset, so no path skips the reset. A `finally` block would make React Compiler skip the component (`Handle TryStatement with a finalizer`). |
| Customer account erasure (`convex/lib/accountErasure.ts`) | `async-await-in-loop`, `async-parallel`, `server-sequential-independent-await` | The app-table steps run together, then the Better Auth login is erased last, so a too-large refusal never starts the component's writes. Within a login, sessions, accounts, live verifications and the user row are erased in that order through Better Auth component mutations, and logins are erased one at a time. This pass kept that existing order rather than change deletion behaviour; `accountDeletion.convex.integration.ts` and `dataRetention.convex.integration.ts` pin the outcome. |
| Retention page apply (`convex/crm/lib/retentionRun.ts`) | `async-await-in-loop` | Decisions on one page may touch the same rows (guardian links, Job Cards), so they apply in plan order. |
| Portal home redirect (`PortalWorkspace.tsx`) | `nextjs-no-client-side-redirect` | The server boundary already redirects a login without Staff Workspace access. The remaining `/portal` to first-allowed-page redirect follows the live `getMyPortalAccess` subscription, so it also fires when permissions change while the page is open; a server `redirect()` cannot see that. |
| Auth sign-in redirect (`src/lib/auth-login-pages.js`) | `clickjacking-redirect-risk` | The target is `resolveAuthReturnPath`, which accepts only a same-origin path inside the variant's own area (`auth-return-path.test.js` covers off-site, protocol-relative, backslash and control-character values), or the variant's fixed home. Every route sends `X-Frame-Options: DENY` (`next.config.mjs`). |

On 2026-11-06, with React Doctor `0.9.22`, the integration tests for notification email outbox,
notification audience, post-tour feedback and reports, team travel and traveler feedback were added
to the ordered-await test exception for the same reason as the existing integration tests.
Later the same day, also with `0.9.22`, the integration tests for account deletion, booking customer
emails, the app pilot, connect field access, data retention, external tour manager access, tour
manager job visibility, the tour manager legacy names migration, traveller guardian consent and
traveller guardians were added to the same exception: each builds fixtures in a fixed order so ids,
creation times and assertions stay deterministic.
On 2026-11-07, with `0.9.22`, the field passport preview integration test (from main) joined the
same exception: each case freezes the clock, seeds a traveller, stores a scan into that record and
only then reads it back, so the awaits depend on each other.

Each exception is a claim to re-check when the scoped code changes. New suppressions require the
same source inspection and a focused behavior test; React Doctor output alone is a hypothesis, not
proof that a diagnostic is true or false.

## Reproduction

Run the configured scan first. To audit the exceptions, copy the checkout to a disposable worktree
or temporarily remove `doctor.config.json`, then run the same pinned command. Never weaken the
shared config merely to make a local score pass.
