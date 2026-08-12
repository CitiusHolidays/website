import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStagedCommands } from "../../lint-staged.config.mjs";

const root = resolve(import.meta.dir, "../..");
const SLOW_HOOK_COMMAND_PATTERN = /\b(?:build|test|typecheck)\b/;
const MUTATING_HOOK_COMMAND_PATTERN = /\b(?:fix|format)\b/;

describe("staged-file quality routing", () => {
  test("routes root code to check-only Biome and Studio sources to pinned Prettier", () => {
    const commands = createStagedCommands([
      resolve(root, "src/app/page.tsx"),
      resolve(root, "citius-blog/schemaTypes/post.ts"),
      resolve(root, "citius-blog/README.md"),
      resolve(root, "docs/LOCAL_DEV.md"),
      resolve(root, "public/logo.png"),
    ]);

    expect(commands).toHaveLength(2);
    expect(commands[0]).toContain("node_modules/ultracite/dist/index.js check");
    expect(commands[0]).toContain("src/app/page.tsx");
    expect(commands[0]).not.toContain("citius-blog");
    expect(commands[1]).toContain("citius-blog/node_modules/prettier/bin/prettier.cjs --check");
    expect(commands[1]).toContain("schemaTypes/post.ts");
    expect(commands[1]).toContain("citius-blog/README.md");
    expect(commands.join("\n")).not.toContain("docs/LOCAL_DEV.md");
    expect(commands.join("\n")).not.toContain("public/logo.png");
  });

  test("quotes special filenames and safely skips unsupported or empty lists", () => {
    const special = resolve(root, "src/a file $(touch unsafe).ts");
    expect(createStagedCommands([special])).toEqual([
      `node node_modules/ultracite/dist/index.js check ${JSON.stringify(special)}`,
    ]);
    expect(createStagedCommands([])).toEqual([]);
    expect(createStagedCommands([resolve(root, "assets/archive.zip")])).toEqual([]);
  });

  test("keeps the hook fast, staged-only, and non-mutating", () => {
    const hook = readFileSync(resolve(root, ".husky/pre-commit"), "utf8");
    expect(hook).toContain("git diff --cached --check");
    expect(hook).toContain("lint-staged");
    expect(hook).not.toMatch(SLOW_HOOK_COMMAND_PATTERN);
    expect(hook).not.toMatch(MUTATING_HOOK_COMMAND_PATTERN);
  });
});
