# AI runtime operations

Citius Concierge is the active server-only OpenRouter capability. Historical `journeyPlanner`
values remain in telemetry, control, and benchmark schemas so retained records stay readable, but
the old public endpoint returns HTTP 410 before provider, rate-limit, auth, or database work. Next.js
calls Convex with `AI_RUNTIME_SECRET`; the same value must be stored independently in the Next.js
deployment environment and the Convex runtime. `AI_RATE_LIMIT_SALT` belongs only to the Next.js
server and must never use a `NEXT_PUBLIC_` name.

## Local policy

Run `bun run ai:config-check` before deployment. It verifies that key names are assigned to the
correct server-only groups without reading or printing values. During Vercel Preview and Production
builds it also verifies, by name only, that `AI_RUNTIME_SECRET`, `AI_RATE_LIMIT_SALT`, and
`OPENROUTER_API_KEY` are non-empty in the pulled target environment. Local development may omit the
shared runtime configuration; it then uses the documented privacy-safe process-local limiter.
Production fails closed when shared rate-limit storage, its URL, salt, capability, or Admin
operational-control gateway is unavailable.

The 2026-08-19 Production incident returned HTTP 503 before provider selection because shared AI
runtime storage was not configured in the Next.js and Convex Production environments. Search
Vercel logs using request ID `req_d8c7f400-672d-476c-a015-4da669e61d35` for the captured boundary.
Source repair does not prove the hosted values have been installed; target configuration and a
revision-bound live smoke remain separate release evidence.

`src/lib/ai/runtimeService.ts` treats every shared rate-limit result as untrusted. It accepts only a
boolean `allowed` plus finite non-negative `remaining` and `retryAfterSec` values. A malformed result
fails closed; telemetry persistence remains best effort and cannot replace or break a user stream.

## Concierge privacy boundary

`convex/crm/lib/majorCapabilityPreparation.ts` is the last shared owner before route-owned provider
dispatch. It reconstructs an allowlisted payload containing only user/assistant text, the reviewed
system prompt, configured model candidates, and bounded generation budgets. Recognizable email,
phone, passport, payment, and secret patterns are replaced before dispatch. Non-text prompt parts,
unknown roles, empty content, oversized transcripts, and invalid budgets fail closed. The same
prepared transcript is used for every fallback attempt.

This deterministic filter reduces accidental disclosure; it is not a universal personal-data
classifier. Users see that the browser keeps at most twenty messages in tab-scoped
`sessionStorage`, that sending a question transfers a filtered copy to OpenRouter and a selected
model provider, and that their terms may apply. The separate advisor handoff sends no transcript
and requires affirmative contact consent before its allowlisted form payload is submitted.

Provider-stream telemetry keeps only closed terminal outcomes, latency buckets (`under_2_seconds`,
`2_to_8_seconds`, `over_8_seconds`, or `unknown`), and grounding (`canonical_tool` or `unknown`),
alongside bounded operational model/fallback/token fields. It never includes prompt text, reply
text, provider response bodies, contact details, record identifiers, or caught error objects.
Telemetry follows the existing 30-day deletion policy.

Source/local proof does not close the privacy threat model, OpenRouter or upstream-provider
processing and retention review, benchmark ownership, or an authorized non-Production provider
test. Those remain external blockers; no provider configuration, activation, live call, deployment,
or Production proof is authorized by this source change.

The shared AI bucket is the first compatibility pilot for the exactly pinned
`@convex-dev/rate-limiter@0.3.2` component. The app-owned `aiRuntime.consumeRateLimit` mutation keeps
its secret, privacy-safe HMAC key, arguments, and return shape; browsers and Next.js never call the
component directly. Its fixed window starts on first use so existing limit/reset/retry units remain
stable. Target-neutral registered tests mount the real component and prove independent keys,
concurrent consumption, reset timing, and fail-closed validation.

Component rollout remains deployment-specific. Mount and pilot it first on an explicitly named
non-production Convex deployment, generate the checked binding only for that classified target,
and run an authorized burst smoke. Retain legacy AI bucket rows and cleanup through at least one
full retention window; do not remove the old table/cron or migrate inbound intent, private-file, or
Sacred Bharat invite lanes until the AI pilot has target evidence. Production adoption and legacy
deletion are separate approvals.

## Canonical grounding and offline proof

Concierge company, service, destination, contact, and published pilgrimage facts come through
`src/lib/ai/canonicalPublicFacts.ts`. That adapter projects the same versioned modules consumed by
the public UI; it does not copy another tool-only catalog. Tool results include source identity and
version. Missing or conflicting facts require Citius-team confirmation.

Run `bun run ai:grounding-check` for the deterministic, provider-free grounding gate. Its fixed cases
cover company claims, all eleven services, destination spelling/content, office contacts, published
pilgrimage fields, live commercial uncertainty, visa/legal limits, and restricted-record refusal.
The command needs no provider key, network, Convex target, or customer data and must score `1`.

This gate deliberately contains no RAG, vector store, embedding, CMS replication, or private data.
Production retrieval remains direct structured lookup. A future retrieval system requires separate
product, privacy, source-freshness, deletion, index, target, and benchmark authority.

## Provider-attempt ownership

`src/lib/ai/runtimePolicy.ts` owns the typed attempt plan: model order, fallback flag, remaining route
budget, minimum useful budget, and per-attempt timeout. `src/lib/ai/providerStream.ts` owns the
existing AI SDK Web Stream boundary, pre-commit fallback, post-commit terminal behavior,
interruption, and telemetry finalization.

The 2026-08-12 Effect pilot review retained plain TypeScript here. Wrapping only `startAttempt` in
Effect would not own `ReadableStream` cancellation or backpressure and would add a second lifecycle
without reducing the stream state machine. Deterministic tests instead prove that timeout and client
disconnect clean up the active attempt and never start a fallback after output commits.

## Rotation

1. Generate new high-entropy values for `AI_RUNTIME_SECRET` and `AI_RATE_LIMIT_SALT`; do not paste them into source, chat, logs, or command history retained by the repository.
2. Set the new `AI_RUNTIME_SECRET` in Convex and the Next.js server environment. Set the new `AI_RATE_LIMIT_SALT` only in the Next.js server environment.
3. Redeploy Convex functions and Next.js within the same maintenance window. During a mismatched interval, AI requests fail closed rather than bypassing the shared limiter.
4. Run the manifest preflight and the authorized post-deploy smoke below.
5. Revoke the old values after both surfaces pass. Record only rotation time, operator, environment, and pass/fail—not values.

## Authorized post-deploy smoke

Live checks require separate authorization and valid deployment access.

- Open Concierge, submit a non-sensitive travel question, confirm streaming completes, and verify a repeated burst eventually returns the safe rate-limit response.
- Request the retired Sacred Bharat Journey Planner URL and confirm its stable HTTP 410 response;
  it must not consume an AI bucket or contact the provider.
- Verify the deployment logs and telemetry contain feature, model, latency, terminal state, and token counts only—no prompt, response, raw client key, capability, or salt.
- Temporarily test an unconfigured preview environment and confirm Concierge shows the actionable
  unavailable response while the archived planner remains a configuration-independent HTTP 410.
- Confirm the salt change creates new privacy-safe hashes and that expired buckets remain cleanup-eligible.

Do not infer these live results from local tests.
