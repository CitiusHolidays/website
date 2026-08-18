const ROOT_BIOME_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

const STUDIO_PRETTIER_EXTENSIONS = new Set([
  ...ROOT_BIOME_EXTENSIONS,
  ".md",
  ".mdx",
  ".scss",
  ".yaml",
  ".yml",
]);

function extension(path) {
  const filename = path.split("/").at(-1) ?? "";
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function quoteArguments(paths) {
  return paths.map((path) => JSON.stringify(path)).join(" ");
}

export function createStagedCommands(files) {
  const rootFiles = files.filter(
    (file) => !file.includes("/citius-blog/") && ROOT_BIOME_EXTENSIONS.has(extension(file))
  );
  const studioFiles = files.filter(
    (file) => file.includes("/citius-blog/") && STUDIO_PRETTIER_EXTENSIONS.has(extension(file))
  );
  const commands = [];
  if (rootFiles.length > 0) {
    commands.push(`node node_modules/ultracite/dist/index.js check ${quoteArguments(rootFiles)}`);
  }
  if (studioFiles.length > 0) {
    commands.push(
      `node citius-blog/node_modules/prettier/bin/prettier.cjs --check ${quoteArguments(studioFiles)}`
    );
  }
  return commands;
}

export default {
  "*": createStagedCommands,
};
