// biome-ignore-all lint/performance/noAwaitInLoops: sequential fixture inference and exports deliberately measure one-editor memory and warm reuse.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { build, file as bunFile, serve } from "bun";
import sharp from "sharp";

const RUNTIME_EXTENSION = /\.(mjs|js|wasm|tflite)$/;
const root = resolve(import.meta.dir, "..");
const evidence = join(root, ".scratch/photo-booth/engine-proof");
await mkdir(evidence, { recursive: true });
const built = await build({
  entrypoints: [join(root, "src/lib/eventPhotoBooth/imageEngine.ts")],
  minify: false,
  target: "browser",
});
assert(built.success, String(built.logs));
const engineSource = await built.outputs[0].text();
// Read the installed package as well as deployed copies so dependency/provenance drift fails locally.
const require = createRequire(import.meta.url);
const runtimeDir = dirname(require.resolve("@mediapipe/tasks-vision"));
const manifest = JSON.parse(
  await readFile(join(root, "docs/event-photo-booth/assets-manifest.json"), "utf8")
);
for (const asset of manifest) {
  const bytes = await readFile(join(root, asset.path));
  assert.equal(bytes.length, asset.bytes, asset.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.path);
}
assert.deepEqual(
  await readFile(join(runtimeDir, "vision_bundle.mjs")),
  await readFile(join(root, "public/photo-booth/vendor/mediapipe-1.0.1/vision_bundle.mjs"))
);
const orientationFixture = await sharp(join(root, "scripts/fixtures/event-photo-booth/solo.jpg"))
  .withMetadata({ orientation: 6 })
  .jpeg()
  .toBuffer();
const requests = [];
const server = serve({
  async fetch(request) {
    const path = new URL(request.url).pathname;
    requests.push({ method: request.method, path });
    if (path === "/") {
      return new Response(
        '<!doctype html><html lang="en"><head><title>Local engine verification</title></head><body></body></html>',
        { headers: { "Content-Type": "text/html" } }
      );
    }
    if (path === "/engine.js") {
      return new Response(engineSource, { headers: { "Content-Type": "text/javascript" } });
    }
    if (path === "/orientation.jpg") {
      return new Response(orientationFixture, { headers: { "Content-Type": "image/jpeg" } });
    }
    const file = path.startsWith("/fixture/")
      ? join(root, "scripts/fixtures/event-photo-booth", path.slice(9))
      : join(root, "public", path);
    if (!(file.startsWith(root) && (await bunFile(file).exists()))) {
      return new Response("Not found", { status: 404 });
    }
    const headers = { "Cache-Control": "public, max-age=31536000, immutable" };
    if (path.endsWith(".mjs")) {
      headers["Content-Type"] = "text/javascript";
    }
    return new Response(bunFile(file), { headers });
  },
  hostname: "127.0.0.1",
  port: 0,
});
const profile = await mkdtemp(join(tmpdir(), "citius-booth-proof-"));
const context = await chromium.launchPersistentContext(profile, { headless: true });
try {
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error("Browser error", error.message));
  await page.goto(server.url.href);
  const results = await page.evaluate(async () => {
    const engine = await import(new URL("/engine.js", location.origin).href);
    const processor = engine.createCutoutProcessor();
    const artwork = await engine.loadBoothArtwork("/images/event-photo-booth/paris.webp");
    const logo = await engine.loadBoothLogo();
    const photoFrom = async (url) =>
      engine.loadSourcePhoto(
        new File([await (await fetch(url)).blob()], "fixture.jpg", { type: "image/jpeg" })
      );
    const readPixel = (sample, x, y) => [
      ...sample.canvas
        .getContext("2d")
        .getImageData(Math.round(x * (sample.width - 1)), Math.round(y * (sample.height - 1)), 1, 1)
        .data,
    ];
    const fixtureResults = [];
    for (const name of ["solo", "group"]) {
      const photo = await photoFrom(`/fixture/${name}.jpg`);
      const phases = [];
      const start = performance.now();
      const cutout = await processor.segment(photo, { onProgress: (phase) => phases.push(phase) });
      const durationMs = performance.now() - start;
      const foreground =
        name === "solo"
          ? [
              [0.5, 0.25],
              [0.5, 0.5],
              [0.5, 0.8],
            ]
          : [
              [0.32, 0.19],
              [0.5, 0.15],
              [0.68, 0.2],
              [0.32, 0.4],
              [0.5, 0.4],
              [0.68, 0.4],
              [0.3, 0.7],
              [0.46, 0.7],
              [0.7, 0.7],
            ];
      const background = [
        [0.05, 0.05],
        [0.95, 0.05],
        [0.04, 0.6],
        [0.96, 0.6],
      ];
      const retained = foreground.map(([x, y]) => ({
        cutout: readPixel(cutout, x, y),
        original: readPixel(photo, x, y),
        x,
        y,
      }));
      const removed = background.map(([x, y]) => readPixel(cutout, x, y));
      const formats = [];
      for (const format of ["portrait", "story"]) {
        const canvas = engine.renderBoothPhoto({
          artwork,
          caption: "A little closer to your next journey",
          cutout,
          format,
          language: "en",
          logo,
          mode: "cutout",
          photo,
          title: "Paris",
        });
        const blob = await engine.exportBoothPhoto(canvas);
        const decoded = await createImageBitmap(blob);
        formats.push({
          bytes: blob.size,
          data: canvas.toDataURL("image/png"),
          format,
          height: decoded.height,
          width: decoded.width,
        });
        decoded.close();
      }
      const framed = engine.renderBoothPhoto({
        artwork,
        caption: "आपकी अगली यात्रा",
        format: "portrait",
        language: "hi",
        logo,
        mode: "frame",
        photo,
        title: "पेरिस",
      });
      const frame = framed.toDataURL("image/png");
      const scenePreviews = [];
      if (name === "group") {
        for (const scene of ["paris", "bali", "dubai", "kashi", "ayodhya", "kedarnath"]) {
          const sceneArtwork = await engine.loadBoothArtwork(
            `/images/event-photo-booth/${scene}.webp`
          );
          for (const format of ["portrait", "story"]) {
            const preview = engine.renderBoothPhoto({
              artwork: sceneArtwork,
              caption: "Your next journey",
              cutout,
              format,
              language: "en",
              logo,
              mode: "cutout",
              photo,
              title: scene,
            });
            scenePreviews.push({ format, image: preview.toDataURL("image/jpeg", 0.85), scene });
          }
        }
      }
      fixtureResults.push({
        bounds: cutout.bounds,
        cutout: cutout.canvas.toDataURL("image/png"),
        durationMs,
        formats,
        frame,
        name,
        phases,
        removed,
        retained,
        scenePreviews,
      });
      engine.releaseBoothPhoto(photo);
      engine.releaseBoothPhoto(cutout);
    }
    const oriented = await photoFrom("/orientation.jpg");
    const orientation = { height: oriented.height, width: oriented.width };
    engine.releaseBoothPhoto(oriented);
    // Stale work and genuine cancellation must not replace a newer selection.
    const photo = await photoFrom("/fixture/solo.jpg");
    const controller = new AbortController();
    const cancelled = processor.segment(photo, { signal: controller.signal }).then(
      () => "unexpected success",
      (error) => error.name
    );
    controller.abort();
    const cancelledName = await cancelled;
    const old = processor.segment(photo).then(
      () => "unexpected success",
      (error) => error.name
    );
    const current = processor.segment(photo);
    const staleName = await old;
    const latest = await current;
    engine.releaseBoothPhoto(latest);
    engine.releaseBoothPhoto(photo);
    processor.dispose();
    return { cancelledName, orientation, results: fixtureResults, staleName };
  });
  for (const result of results.results) {
    for (const point of result.retained) {
      assert(
        point.cutout[3] >= 240,
        `${result.name}: lost annotated person pixel ${JSON.stringify(point)}`
      );
      assert.deepEqual(
        point.cutout.slice(0, 3),
        point.original.slice(0, 3),
        `${result.name}: source RGB changed`
      );
    }
    for (const point of result.removed) {
      assert(point[3] < 30, `${result.name}: background retained`);
    }
    for (const output of result.formats) {
      assert.equal(output.width, 1080);
      assert.equal(output.height, output.format === "portrait" ? 1350 : 1920);
      await writeFile(
        join(evidence, `${result.name}-${output.format}.png`),
        Buffer.from(output.data.split(",")[1], "base64")
      );
      output.data = undefined;
    }
    await writeFile(
      join(evidence, `${result.name}-frame.png`),
      Buffer.from(result.frame.split(",")[1], "base64")
    );
    await writeFile(
      join(evidence, `${result.name}-cutout.png`),
      Buffer.from(result.cutout.split(",")[1], "base64")
    );
    result.frame = undefined;
    result.cutout = undefined;
    for (const preview of result.scenePreviews) {
      await writeFile(
        join(evidence, `${preview.scene}-${preview.format}.jpg`),
        Buffer.from(preview.image.split(",")[1], "base64")
      );
      preview.image = undefined;
    }
  }
  assert.equal(results.cancelledName, "AbortError");
  assert.equal(results.staleName, "AbortError");
  assert(
    Math.abs(results.orientation.width / results.orientation.height - 1.5) < 0.002,
    "EXIF orientation must retain the rotated aspect ratio within one decoder pixel"
  );
  assert(
    requests.every((request) => request.method === "GET"),
    "Participant data must never be uploaded"
  );
  const modelRequestsBefore = requests.filter(({ path }) => path.includes("vendor/")).length;
  await page.reload();
  const warm = await page.evaluate(async () => {
    const engine = await import(new URL("/engine.js", location.origin).href);
    const photo = await engine.loadSourcePhoto(
      new File([await (await fetch("/fixture/solo.jpg")).blob()], "solo.jpg", {
        type: "image/jpeg",
      })
    );
    const processor = engine.createCutoutProcessor();
    const start = performance.now();
    const cutout = await processor.segment(photo);
    const durationMs = performance.now() - start;
    processor.dispose();
    engine.releaseBoothPhoto(photo);
    engine.releaseBoothPhoto(cutout);
    return { durationMs };
  });
  const modelRequestsAfter = requests.filter(({ path }) => path.includes("vendor/")).length;
  assert.equal(
    modelRequestsAfter,
    modelRequestsBefore,
    "The second page session should reuse cached runtime/model bytes"
  );
  const failurePage = await context.newPage();
  await failurePage.route("**/*.tflite", (route) => route.abort());
  await failurePage.goto(server.url.href);
  const failed = await failurePage.evaluate(async () => {
    const engine = await import(new URL("/engine.js", location.origin).href);
    const photo = await engine.loadSourcePhoto(
      new File([await (await fetch("/fixture/solo.jpg")).blob()], "solo.jpg", {
        type: "image/jpeg",
      })
    );
    const processor = engine.createCutoutProcessor();
    const error = await processor.segment(photo).then(
      () => "unexpected success",
      (failure) => failure.message
    );
    const [artwork, logo] = await Promise.all([
      engine.loadBoothArtwork("/images/event-photo-booth/bali.webp"),
      engine.loadBoothLogo(),
    ]);
    const frame = engine.renderBoothPhoto({
      artwork,
      caption: "Whole-photo frame",
      format: "portrait",
      language: "en",
      logo,
      mode: "frame",
      photo,
      title: "Bali",
    });
    processor.dispose();
    engine.releaseBoothPhoto(photo);
    return { error, width: frame.width };
  });
  assert.match(failed.error, /whole-photo frame/);
  assert.equal(failed.width, 1080);
  const vendorRequests = requests.filter(({ path }) => path.includes("vendor/"));
  const rawBytes = manifest
    .filter(({ path }) => RUNTIME_EXTENSION.test(path))
    .reduce((total, file) => total + file.bytes, 0);
  const report = {
    ...results,
    browser: context.browser()?.version(),
    coldRawBytes: rawBytes,
    failed,
    notes:
      "Loopback uncompressed transport and Chromium desktop CPU. Real iPhone/Android, weak cellular network, real family quality and native share are unverified.",
    vendorRequests,
    warm,
    warmVendorNetworkRequests: modelRequestsAfter - modelRequestsBefore,
  };
  await writeFile(join(evidence, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  server.stop(true);
  await rm(profile, { force: true, recursive: true });
}
