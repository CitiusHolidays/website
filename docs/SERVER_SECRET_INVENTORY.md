# Server-secret comparison inventory

| Boundary | Credential | Comparison | Follow-up |
|---|---|---|---|
| Sanity revalidation route | `SANITY_REVALIDATE_SECRET` header | `timingSafeSecretEqual` | Canonical shared helper. |
| Razorpay signature verification | Razorpay HMAC signature | Timing-safe byte comparison in `src/lib/razorpay.js` | Signature-specific HMAC contract; do not replace with plain equality. |
| Razorpay-to-Convex payment mutations | `PAYMENT_MUTATION_SECRET` | Server-only assertion in `convex/lib/paymentMutationAuth` | Keep server-to-server and never expose through public environment variables. |
| AI Next.js-to-Convex runtime | `AI_RUNTIME_SECRET` | Runtime capability contract | Same rotated value in both server stores; keep separate from CMS revalidation. |
| Operational-control gateway | `OPERATIONAL_CONTROL_GATEWAY_SECRET` | Server-only capability contract | Same rotated value in Next.js and Convex; authorizes control resolution, never Admin mutation. |
| Sacred Bharat edition events | `SACRED_BHARAT_EVENT_GATEWAY_SECRET` | Server-only capability contract | Same rotated value in Next.js and Convex; browsers can reach only the bounded same-origin gateway. |

Invalid credentials always receive non-leaking responses. Missing production configuration fails closed. Secret values must not be logged, returned, or embedded in browser code.
