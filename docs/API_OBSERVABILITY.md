# API observability

Every browser-facing API method passes through `src/lib/observability/api-log.js`. The checked-in
registry at `src/lib/observability/api-route-registry.js` owns the route pattern, method, route
family, and response mode. `config/release/api-observability-contract.test.ts` fails when a route
module or exported method is missing from that registry or bypasses the wrapper.

Each request receives one correlation ID and produces exactly one `api.request.completed` event.
The server always generates `req_<uuid>` and ignores an inbound `x-request-id`; a caller can never
choose the canonical value or merge unrelated traces. The same value is returned on the response
and is diagnostic only: it never authorizes, selects, or deduplicates a business record. Reviewed
5xx UI paths display that bounded value as a support reference, while preserving each surface's
existing recovery copy.

The event schema is closed and content-free:

- `route`, `family`, `method`, `responseMode`, and nullable `errorCategory` come only from the
  registry;
- `status`, `durationMs`, `completion`, and `outcome` describe the request boundary;
- `requestId`, `service`, `event`, and `timestamp` provide correlation and event identity.

Arbitrary fields cannot pass through the completion-event builder. Request bodies, query values,
cookies, tokens, signatures, payment payloads, contact details, file or record identifiers,
provider responses, and exception messages or stacks are absent rather than conditionally
redacted.

JSON, delegated-auth, and private/binary responses complete when the handler returns a response.
Streaming AI responses complete only when the response body closes, fails, or is cancelled; a
returned stream is not falsely reported as completed. The wrapper preserves the original status,
body, cookies, cache policy, range/download headers, and public response shape, adding only the
correlation header. A handled 5xx is an error-level event even when the handler returns normally;
4xx responses remain informational. Stream status is classified exactly once at close, failure, or
cancellation.

Selected account and payment routes pass the same server-owned value into the existing Better Auth
token-exchange diagnostic field. The value is not added to Convex business arguments or records,
and raw downstream errors remain outside the completion event.

When adding an API route:

1. register its route pattern, methods, family, and response mode;
2. wrap each exported HTTP method exactly once;
3. keep dynamic identifiers in the route pattern, never the emitted event;
4. run the observability inventory plus the route-specific behavior tests.

Use the request ID when searching deployment logs. Never paste request headers, cookies, access
tokens, bodies, or provider payloads into tickets. Provider activation, retention, sampling, alert
routing, and Production monitoring remain separate operational decisions and evidence gates.
