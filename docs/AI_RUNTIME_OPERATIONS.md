# AI runtime operations

Citius Concierge and the Sacred Bharat Journey Planner share one server-only OpenRouter and rate-limit configuration. Next.js calls Convex with `AI_RUNTIME_SECRET`; the same value must be stored independently in the Next.js deployment environment and the Convex runtime. `AI_RATE_LIMIT_SALT` belongs only to the Next.js server and must never use a `NEXT_PUBLIC_` name.

## Local policy

Run `bun run ai:config-check` before deployment. It verifies that key names are assigned to the correct server-only groups without reading or printing values. Local development may omit the shared runtime configuration; it then uses the documented privacy-safe process-local limiter. Production fails closed when shared rate-limit storage, its URL, salt, or capability is unavailable.

## Rotation

1. Generate new high-entropy values for `AI_RUNTIME_SECRET` and `AI_RATE_LIMIT_SALT`; do not paste them into source, chat, logs, or command history retained by the repository.
2. Set the new `AI_RUNTIME_SECRET` in Convex and the Next.js server environment. Set the new `AI_RATE_LIMIT_SALT` only in the Next.js server environment.
3. Redeploy Convex functions and Next.js within the same maintenance window. During a mismatched interval, AI requests fail closed rather than bypassing the shared limiter.
4. Run the manifest preflight and the authorized post-deploy smoke below.
5. Revoke the old values after both surfaces pass. Record only rotation time, operator, environment, and pass/fail—not values.

## Authorized post-deploy smoke

Live checks require separate authorization and valid deployment access.

- Open Concierge, submit a non-sensitive travel question, confirm streaming completes, and verify a repeated burst eventually returns the safe rate-limit response.
- Open Sacred Bharat Journey Planner, request a non-sensitive itinerary, and confirm its separate bucket streams a result.
- Verify the deployment logs and telemetry contain feature, model, latency, terminal state, and token counts only—no prompt, response, raw client key, capability, or salt.
- Temporarily test an unconfigured preview environment and confirm both routes show the actionable unavailable response without exposing the missing key name or value.
- Confirm the salt change creates new privacy-safe hashes and that expired buckets remain cleanup-eligible.

Do not infer these live results from local tests.
