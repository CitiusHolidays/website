# API observability

Browser-facing API routes use `src/lib/observability/api-log.js` for one
request correlation id and one structured completion event. The `x-request-id`
header is accepted only when it is a short, log-safe identifier; otherwise a
server-generated `req_<uuid>` is used and returned on the response.

Logs contain route, method, status, duration, and a safe error category. The
redaction boundary removes values whose keys look like credentials, tokens,
cookies, signatures, API keys, passwords, email addresses, or phone numbers.
Provider response bodies, auth cookies, and payment payloads are never logged.

Use the request id when searching deployment logs. Do not paste request
headers, cookies, access tokens, or full payment/webhook bodies into tickets.
The environment preflight uses the same privacy rule and reports missing or
invalid variable names only.
