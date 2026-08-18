# cnfast benchmark decision

## Decision: defer adoption

`cnfast 0.1.0` is promising in an isolated microbenchmark, but this report does
not establish that class merging is a material Citius runtime or build-time
bottleneck. The candidate is also at an early package version, and this
benchmark deliberately did not perform a Next.js, React, or React Compiler
application integration.

No implementation ticket is warranted yet. Reconsider only if profiling finds
a meaningful class-merging cost in a representative Citius workload or a later
candidate materially improves the compatibility and maintenance case. This
benchmark did not change the application `cn` implementation, package manifest,
or lockfile dependency graph.

## Scope and fixtures

The benchmark compared the current `clsx` plus `tailwind-merge` implementation
with the candidate's exported `cn` function. Eight static, privacy-safe fixture
groups are transcribed and varied from named, checked-in component call sites
covered by the harness contract across the four distinct Citius boundaries:

- Public site: CTA and full-height media composition states.
- Sacred Bharat: Trail grid and Soul Score badge states.
- Customer Travel Account: navigation-control and Account surface-card states.
- Staff Workspace: sticky-toolbar and numeric-cell states.

The harness checked the eight representative calls directly and generated
5,000 cold-cache variants containing a unique unknown class. All 5,008 outputs
were byte-for-byte equal. No customer, CRM, authentication, provider, or live
deployment data was read.

## Reproduction

The recorded run used:

- Git revision: `7966017c8dd3fe24865773b61dc09e6a2820767f`
  with benchmark work present in the working tree.
- Runtime: Bun 1.3.14 on macOS arm64; Node compatibility v24.3.0.
- Project toolchain: Next.js 16.3.0, React 19.2.8, React Compiler 1.0.0,
  and `tailwind-merge` 3.6.0.
- Candidate: cnfast 0.1.0, extracted from its published npm tarball into a
  temporary directory rather than installed into the project.
- Sampling: 20,000 iterations per trial, 7 trials, alternating which merger
  ran first. A warm-up pass preceded measurements.

```bash
npm pack cnfast@0.1.0 --pack-destination "$BENCHMARK_TMP"
tar -xzf "$BENCHMARK_TMP/cnfast-0.1.0.tgz" -C "$BENCHMARK_TMP/cnfast-0.1.0"
bun scripts/benchmark-cnfast.ts \
  --candidate "$BENCHMARK_TMP/cnfast-0.1.0/package/dist/index.mjs" \
  --iterations 20000 \
  --trials 7
```

Use an explicit temporary directory for `BENCHMARK_TMP`; the candidate must not
be added to `package.json` or `bun.lock` for this benchmark-only workflow.

## Results

| Signal | Current `cn` | cnfast 0.1.0 | Interpretation |
| --- | ---: | ---: | --- |
| Warm median throughput | 5,182,186 ops/s | 6,863,712 ops/s | Warm-cache median speedup: 1.324x |
| Warm range | 4,899,709-5,671,278 ops/s | 5,727,241-7,386,659 ops/s | Relative standard deviation was 5.6% and 9.0% |
| Cold median throughput | 454,624 ops/s | 904,931 ops/s | Cold-cache median speedup: 1.991x |
| Cold range | 437,617-471,516 ops/s | 858,596-934,670 ops/s | Relative standard deviation was 2.6% and 3.0% |
| Correctness mismatches | 0 of 5,008 | 0 of 5,008 | Representative and generated outputs matched |

The directional memory sample reported a median heap delta of zero for both
implementations after explicit Bun garbage collection. Median RSS deltas were
229,376 bytes for the current implementation and 16,384 bytes for the candidate,
with high relative variation and maxima of 4,423,680 and 884,736 bytes. This
noisy process-level signal is not an allocation profile or a memory budget and
does not support a memory claim.

### Package footprint

| Footprint | Current packages | cnfast 0.1.0 |
| --- | ---: | ---: |
| Published files on disk | 1,023,341 bytes | 1,016,883 bytes |
| Resolved runtime entry bytes | 106,268 bytes | 100,919 bytes |
| Gzipped resolved runtime entries | 18,062 bytes | 18,763 bytes |

The current-package column sums `clsx` and `tailwind-merge`. Published-file
sizes include documentation and metadata, while runtime-entry sizes are only a
directional dependency comparison; they are not client bundle measurements.

## Compatibility and limitations

- Bun ESM import and the candidate's framework-agnostic function API passed.
- The fixture input model includes the arrays, objects, conditions, conflicting
  utilities, arbitrary values, variants, and `!important` forms used by the
  four surface examples.
- The benchmark did not import cnfast from application code, run React Compiler
  over it, produce a Next.js bundle, or exercise a browser workload.
- The test is a focused class-merging microbenchmark. It does not measure page
  latency, interaction latency, build duration, or production cost.
- Results are a single-machine snapshot with visible trial spread, not a
  durable performance budget.

If future profiling justifies reconsideration, open a separate implementation
ticket that requires application-level typechecking, target-aware build proof,
bundle comparison, representative browser measurements, and rollback criteria.
Do not treat this report as adoption authority.
