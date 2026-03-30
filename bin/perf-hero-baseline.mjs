/**
 * Prints byte sizes for hero video assets under public/ (baseline for perf work).
 * Run: node bin/perf-hero-baseline.mjs
 */
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "public");
const names = [
  "hero.mp4",
  "hero.webm",
  "hero-sm.mp4",
  "hero-sm.webm",
];

async function main() {
  console.log("Hero video baseline (public/):\n");
  for (const name of names) {
    try {
      const p = join(root, name);
      const s = await stat(p);
      const mb = (s.size / (1024 * 1024)).toFixed(2);
      console.log(`  ${name}: ${s.size} bytes (${mb} MiB)`);
    } catch {
      console.log(`  ${name}: (not present)`);
    }
  }
  try {
    const entries = await readdir(root);
    const heroish = entries.filter((f) => /^hero/i.test(f));
    if (heroish.length) {
      console.log("\nOther hero* files:", heroish.join(", "));
    }
  } catch {
    console.log("\n(public/ missing or unreadable)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
