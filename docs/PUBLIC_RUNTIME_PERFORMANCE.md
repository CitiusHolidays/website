# Public runtime performance

The credential-free public baseline covers Home at desktop and mobile widths, Pilgrimage desktop,
Sacred Bharat mobile, and Home with reduced motion and data saver enabled. Each checked-in sample
records the median and p95 of five cold Chromium contexts against a collector-owned local Next
production server. Results bind to revision, the served Next build ID, browser, build mode,
viewport, loopback network, cache mode, trial count, and a hash of the monitored public route/media
sources.

The collector records TTFB, FCP, LCP, DOM interactive/complete, load, requests, JS/CSS transfer,
critical transfer, first/third-party transfer, gated hero-media transfer, hero request count, and
the slowest first-party resources. `config/release/public-runtime-performance-budgets.json` defines
separate warning and failure thresholds for every scenario. Warnings stay visible without hiding a
green failure gate; failures or a stale source hash fail `bun run performance:check`.

Every replacement median is additionally compared with the last accepted median. Transfer metrics
may increase by 15% or 20,000 bytes, timing metrics by 25% or 200 ms, and request count by 15% or five
requests, whichever allowance is larger. The collector fails above either relative allowance and
still requires every median and p95 to pass the fixed failure ceilings; the minimum absolute values
are noise floors, not permission to widen the checked-in limits. With five observations, p95 is the
sample maximum, so it is deliberately fixed-only instead of being compared relatively with another
five-sample maximum.

The first schema-v2 replacement records median and p95 against fixed budgets but cannot compare
either aggregate with schema-v1: that collector did not own or prove the served build, so its timing
medians are not an admissible relative predecessor. Its provenance records
`p95RelativeComparison: not_available`, the accepted schema/version digest identifies the one-time
owned-server transition, and no relative pair is evaluated. New schema-v2 replacements record
`fixed_only`: medians compare with matching accepted medians and p95 remains subject to every hard
failure ceiling. Historical `included` evidence remains readable but is no longer emitted.

The current schema-v2 baseline was measured on 2026-08-15 from clean revision
`61b107aa06feb0132b6c355546faf14c7006b288` with the same served build ID, Chromium
151.0.7922.34, and five cold trials per scenario. All median and p95 fixed failure budgets passed.
Every median also passed its accepted-baseline-relative gate, while p95 is explicitly fixed-only.
Sacred Bharat mobile LCP fell from a bimodal 84/672 ms median/p95 predecessor to a stable 60/60 ms
after its largest hero copy stopped waiting on a 600 ms client-hydration entrance. Reduced-motion
and data-saver made zero hero-video requests, and every scenario recorded zero third-party transfer.
Median LCP ranged from 48 to 72 ms; p95 LCP peaked at 112 ms for Home desktop. CSS transfer remains
above its warning threshold on all six median and p95 scenarios (307,586 to 586,953 bytes), so that
advisory stays visible; no warning or failure limit was widened. The 206-file source closure is
current at hash `62a6b34c17904c08c8092e1cf186b158f705fd96fec2ce84d04d940439798ffa`.

Hero media is reported separately from critical render transfer. Reduced-motion and data-saver
samples must make zero `/hero.mp4` or `/hero-sm.mp4` requests. The static asset caps remain an
independent leading indicator.

To refresh locally, reserve an unused loopback port and let the collector build, start,
identity-check, measure, and stop its own Next production server:

```bash
bun run performance:public:collect -- --base-url http://localhost:3100 --build-mode production --trials 5
```

The collector requires a clean exact revision, the production build label, exactly five trials,
and an unused explicit loopback port. It bakes the exact revision into the Next build ID, proves the
served revision-specific build manifest before launching Chromium, rejects every non-loopback host,
and writes only below
`.scratch/public-runtime-performance/`. Review timing noise, slow-resource paths, opt-out media
requests, both median and p95 findings, comparison provenance, source hash, and policy impact before
updating the checked-in baseline. The fingerprint is
the deterministic import closure of the measured routes and harness plus dependency/build inputs;
unrelated documentation is excluded. This local public
benchmark is not Vercel, Convex deployment, authenticated workflow, or production Core Web Vitals
proof; provider field insights remain observational evidence.
