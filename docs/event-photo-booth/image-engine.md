# Browser photo engine

The participant photo never leaves the browser. `src/lib/eventPhotoBooth/imageEngine.ts` owns local
photo decoding, worker lifetime, composition and PNG export. No account, inference API, per-photo
service fee, persistent participant storage or server photo upload is used.

## Consumer contract

- `loadSourcePhoto(file, { signal? })` returns a local `BoothPhoto` canvas. JPG, PNG and WebP still
  images are accepted up to 12 MiB and the existing raster safety ceiling of 25 million pixels.
  Animated, mismatched, malformed and oversized images fail before decoding. HEIC should be exported
  as JPG by the visitor; there is no heavyweight conversion dependency.
- `createCutoutProcessor()` creates no worker until `segment(photo, { signal?, onProgress? })`.
  Progress is `preparing` then `processing`. Segmentation returns `BoothCutout` with a local canvas
  and foreground bounds. `dispose()` terminates pending work and releases the model. Reuse one
  processor during an editing session; scene/format changes require no further inference.
- Abort the prior operation when replacing a photo. Genuine cancellation rejects with `AbortError`;
  model failures and the two-minute preparation limit reject with actionable ordinary errors.
  A generation ID prevents stale results from replacing a newer selection.
- Call `releaseBoothPhoto` on each original/cutout when replaced or when leaving the editor. Do not
  release an original until its pending processing has been aborted. No object URLs are retained.
- `loadBoothArtwork(url)` and `loadBoothLogo()` load cross-origin-safe raster layers. Reuse the loaded
  images; they contain no visitor data. Staff previews can render artwork and text without a photo.
- `renderBoothPhoto` synchronously produces the full-size canvas used for both preview and export.
  Pass artwork and logo images, localized `title`/`caption`, language `en`/`hi`, format
  `portrait`/`story`, explicit mode `cutout`/`frame`, and the relevant local photo. An optional canvas
  can be reused for interactive previews. Wait for `document.fonts.ready` in the consuming page
  before final rendering so configured Inter/Poppins fonts are available.
- `imageGeometry.ts` exports the format/transform types, `DEFAULT_TRANSFORM` and dimensions.
  Transforms are offsets as fractions of output width/height and a scale multiplier relative to
  automatic placement. `clampTransform` bounds these controls. Whole-photo frame mode deliberately
  contains the entire original photograph without cropping.
- `exportBoothPhoto(canvas)` returns a PNG Blob: portrait is 1080×1350 and Story is 1080×1920.
  The consuming UI owns its temporary export URL, download/native-share flow and URL revocation.

The decoder supplies only one resize dimension so EXIF-rotated JPEGs retain their aspect ratio.
Using the shorter precomputed bound keeps either orientation's longest edge at most 1600 pixels.
Landscape sources may therefore use a smaller working image than portrait sources; this keeps
phone memory bounded without introducing another EXIF parser. No RGB recoloring, face generation,
face replacement, relighting or clothing changes occur. The worker keeps every nonbackground
class and applies a soft alpha between 10% and 90% foreground confidence, suppressing background
haze while retaining uncertain edges. Inspect the result; hair and occlusion remain model limits.

## Pinned runtime and model

- Runtime: [`@mediapipe/tasks-vision` 1.0.1](https://registry.npmjs.org/@mediapipe/tasks-vision/1.0.1),
  Apache-2.0. Only `vision_bundle.mjs` and the module SIMD loader/WASM pair are copied unchanged.
- Model: [Selfie Multiclass 256×256 float32, version 1](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite).
  The publisher's [model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf)
  explicitly declares Apache License 2.0 and multiple-person/full-body support. Its supplied copy
  and the upstream license are retained in `public/photo-booth/vendor/`.
- The model/runtime use CPU inside a module Worker and require OffscreenCanvas and WebAssembly
  SIMD. Unsupported browsers receive an explicit whole-photo frame option from the visitor UI.
- `assets-manifest.json` records exact deployed byte counts and SHA-256 hashes, including logo,
  artwork, runtime/model and controlled fixtures. The verification script checks every entry and
  compares the runtime bundle to the pinned installed package.

The immutable, versioned runtime/model URLs total **28,607,663 bytes** uncompressed on first cutout
use (about 27.3 MiB). They load only when segmentation starts. Framed-photo mode needs no model.
Scene assets total **1,611,560 bytes**, loaded as needed, and the existing logo copy is 51,106 bytes.
Hosting/bandwidth quotas still apply. Browser caches can be evicted or disabled, so unlimited free
hosting or a universally free repeat visit is not promised. The repository's 10 MiB changed-file rule has a narrow exception for these two exact binary
paths, sizes and hashes in `config/release/check-diff-hygiene.ts`; it does not exempt other vendor files.
Changing an immutable vendor artifact
requires a new versioned URL; update its hash/provenance and rerun the real browser verification.

## Asset provenance

The six scene masters were generated on 2026-09-23 with the built-in image tool at the user's
request, using the existing public visual identity and open foreground composition. No visitor
photo was provided to the generator. The output model version was not exposed. Draft generated
interpretations are not evidence of a visit or precise architectural fidelity; cultural/place
accuracy and final campaign approval remain release review items. WebP assets preserve each
1024×1536 master at quality 85. Top-aligned cover cropping protects the Paris/Dubai spires.

| Scene | Preserved generated master identifier |
| --- | --- |
| Paris | `exec-9f2ec0c7-fc5d-441b-b134-60dfdce155e1.png` |
| Bali | `exec-856016ca-617f-4c93-978b-3da5f7406689.png` |
| Dubai | `exec-150a2a2b-778d-450a-a588-2d3dcf4de7a9.png` |
| Kashi | `exec-44e80640-5db7-40a0-ba93-f7840e4fca82.png` |
| Ayodhya | `exec-39d5f3fd-4377-4562-827b-43f803ad4d02.png` |
| Kedarnath | `exec-64b2e7bd-d33c-41d1-aaec-5fad0a39f5eb.png` |

The logo is an unchanged copy of `src/static/logos/logo.webp`, Citius's existing authentic mark.
The solo and three-adult fixtures in `scripts/fixtures/event-photo-booth/` were generated for
local tests on 2026-09-24, with fictional adults and no real person's photo as input. Originals:
`exec-47551948-ea40-41c5-abfb-3f9ef8ad2d24.png` and
`exec-3b8f1ccb-2723-4cbb-b058-7575d11d166c.png`; JPEG copies use quality 90. They demonstrate the
pipeline on controlled adults, not child/family quality or real-device readiness.

## Local verification

Run `bun test src/lib/eventPhotoBooth/imageEngine.test.ts` for rejection and geometry checks.
Run `bun run photo-booth:verify` for actual local Chromium CPU/WASM inference,
annotated person/background pixels, unchanged opaque RGB, exact decoded export sizes, EXIF 6,
abort/stale-selection handling, model failure with explicit frame mode and cold/warm cache checks.
The runner starts a loopback static server and a fresh disposable persistent browser profile; it
never contacts a Convex target. The generated report and synthetic result images go to ignored
`.scratch/photo-booth/engine-proof/`. Raw fixture photos and results never enter a live service.

A Playwright incognito context does not consistently retain the large binary assets. The normal
persistent-profile run validates HTTP cache reuse without a service worker or CacheStorage layer.
The verification server uses uncompressed loopback transport and the same immutable header policy;
this is not hosted CDN compression, phone performance or weak-network proof. Real iPhone/Android,
Safari, native-share behavior, children and representative real-family photos remain release checks.
