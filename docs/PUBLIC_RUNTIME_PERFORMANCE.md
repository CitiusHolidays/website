# Public runtime performance

The credential-free public baseline covers Home at desktop and mobile widths, Pilgrimage desktop,
Sacred Bharat mobile, and Home with reduced motion and data saver enabled. Each checked-in sample
is the median of three cold Chromium contexts against a local Next production server. Results bind
to revision, browser, build mode, viewport, loopback network, cache mode, trial count, and a hash of
the monitored public route/media sources.

The collector records TTFB, FCP, LCP, DOM interactive/complete, load, requests, JS/CSS transfer,
critical transfer, first/third-party transfer, gated hero-media transfer, hero request count, and
the slowest first-party resources. `config/release/public-runtime-performance-budgets.json` defines
separate warning and failure thresholds for every scenario. Warnings stay visible without hiding a
green failure gate; failures or a stale source hash fail `bun run performance:check`.

Hero media is reported separately from critical render transfer. Reduced-motion and data-saver
samples must make zero `/hero.mp4` or `/hero-sm.mp4` requests. The static asset caps remain an
independent leading indicator.

To refresh locally, build without the repository's target-aware Convex wrapper, start that build on
loopback, and collect into ignored evidence:

```bash
bunx next build
bunx next start -p 3100
bun run performance:public:collect -- --base-url http://localhost:3100 --build-mode production --trials 3
```

The collector rejects every non-loopback host and writes only below
`.scratch/public-runtime-performance/`. Review timing noise, slow-resource paths, opt-out media
requests, source hash, and policy impact before updating the checked-in baseline. The fingerprint is
the deterministic import closure of the measured routes and harness plus dependency/build inputs;
unrelated documentation is excluded. This local public
benchmark is not Vercel, Convex deployment, authenticated workflow, or production Core Web Vitals
proof; provider field insights remain observational evidence.
