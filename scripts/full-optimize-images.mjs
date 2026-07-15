import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const TARGET_DIRS = ["./public", "./src/static"];
const QUALITY = 100;
const MAX_WIDTH = 1920;

async function optimizeImage(inputPath) {
  const ext = extname(inputPath).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) {
    return;
  }

  const outputPath = inputPath.replace(new RegExp(`\\${ext}$`, "i"), ".webp");

  try {
    const stats = await stat(inputPath);
    if (stats.isDirectory()) {
      return;
    }

    // Skip if already a webp or if target already exists and is newer
    try {
      const outStats = await stat(outputPath);
      if (outStats.mtime > stats.mtime) {
        console.log(`Skipping ${basename(inputPath)} (already optimized)`);
        return;
      }
    } catch {
      // Output doesn't exist, proceed
    }

    console.log(`Optimizing: ${inputPath} (${(stats.size / 1024).toFixed(1)} KB)`);

    const image = sharp(inputPath);
    const metadata = await image.metadata();

    let pipeline = image;
    if (metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, null, { withoutEnlargement: true });
    }

    await pipeline.webp({ effort: 6, quality: QUALITY }).toFile(outputPath);

    const newStats = await stat(outputPath);
    console.log(
      `  -> Saved as WebP: ${(newStats.size / 1024).toFixed(1)} KB (${((1 - newStats.size / stats.size) * 100).toFixed(1)}% reduction)`
    );
  } catch (err) {
    console.error(`Error processing ${inputPath}:`, err.message);
  }
}

async function walk(dir) {
  const files = await readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const res = join(dir, file.name);
    if (file.isDirectory()) {
      // biome-ignore lint/performance/noAwaitInLoops: Sequential traversal bounds Sharp memory use.
      await walk(res);
    } else {
      await optimizeImage(res);
    }
  }
}

async function run() {
  const fileArgs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  console.log("Starting full image optimization...\n");

  if (fileArgs.length > 0) {
    for (const rel of fileArgs) {
      // biome-ignore lint/performance/noAwaitInLoops: Explicit files are processed sequentially to bound memory use.
      await optimizeImage(resolve(rel));
    }
    console.log("\nImage optimization complete!");
    return;
  }

  for (const dir of TARGET_DIRS) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: Directory batches are sequential to bound Sharp memory use.
      await walk(dir);
    } catch {
      console.warn(`Directory not found or inaccessible: ${dir}`);
    }
  }
  console.log("\nImage optimization complete!");
}

run();
