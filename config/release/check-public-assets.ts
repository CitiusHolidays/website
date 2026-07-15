import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

interface SourceFile {
  path: string;
  source: string;
}

const ASSET_REFERENCE_PATTERN =
  /["'`](\/(?!api\/|_next\/)[^"'`?#]+\.[a-zA-Z0-9]{2,5})(?:[?#][^"'`]*)?["'`]/g;
const SOURCE_EXTENSIONS = new Set([".css", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

export function findMissingPublicAssetReferences(sources: SourceFile[], publicAssets: Set<string>) {
  const missing = new Set<string>();
  for (const file of sources) {
    for (const match of file.source.matchAll(ASSET_REFERENCE_PATTERN)) {
      const asset = match[1];
      if (asset && !publicAssets.has(asset)) {
        missing.add(`${file.path} references missing public asset ${asset}`);
      }
    }
  }
  return [...missing].sort((left, right) => left.localeCompare(right));
}

function filesUnder(path: string): string[] {
  if (statSync(path).isFile()) {
    return [path];
  }
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    filesUnder(join(path, entry.name))
  );
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const publicRoot = join(root, "public");
  const publicAssets = new Set(
    filesUnder(publicRoot).map((path) => `/${relative(publicRoot, path)}`)
  );
  const sources = filesUnder(join(root, "src")).flatMap((path) => {
    if (!SOURCE_EXTENSIONS.has(extname(path))) {
      return [];
    }
    return [{ path: relative(root, path), source: readFileSync(path, "utf8") }];
  });
  const missing = findMissingPublicAssetReferences(sources, publicAssets);
  if (missing.length > 0) {
    console.error("Public asset reference smoke failed:");
    for (const error of missing) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Public asset reference smoke passed: ${publicAssets.size} deployed assets checked across ${sources.length} source files.`
    );
  }
}
