import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { innerEsbuild } from "../../node_modules/convex/src/bundler/debugBundle";
import { serverOnlyPlugin } from "../../node_modules/convex/src/bundler/serverOnly";
import { wasmPlugin } from "../../node_modules/convex/src/bundler/wasm";

test("Convex HTTP and reachability registries bundle in the isolate runtime", async () => {
  // Installed Convex bundler, entirely offline: no target analysis, codegen or deployment.
  const result = await innerEsbuild({
    chunksFolder: "_deps",
    dir: resolve("convex"),
    entryPoints: ["convex/http.ts", "convex/_runtimeModules.ts", "convex/_exportSurface.ts"],
    extraConditions: [],
    generateSourceMaps: false,
    logLevel: "silent",
    platform: "browser",
    plugins: [serverOnlyPlugin, wasmPlugin],
  });
  expect(result.outputFiles.length).toBeGreaterThan(0);
  expect(Object.keys(result.metafile.inputs).some((path) => path.includes("/sharp/"))).toBe(false);
});
