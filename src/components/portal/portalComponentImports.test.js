import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const PORTAL_COMPONENT_FILES = [
  "src/components/portal/PortalWorkspace.js",
  "src/components/portal/PortalCommandPalette.js",
  "src/components/portal/PortalListToolbar.js",
];

const INTRINSIC_TAGS = new Set([
  "a",
  "button",
  "dialog",
  "div",
  "form",
  "h1",
  "h2",
  "h3",
  "img",
  "input",
  "kbd",
  "label",
  "li",
  "ol",
  "option",
  "p",
  "select",
  "span",
  "table",
  "tbody",
  "td",
  "textarea",
  "th",
  "thead",
  "tr",
  "ul",
]);

function read(file) {
  return readFileSync(file, "utf8");
}

function collectImportedBindings(source) {
  const bindings = new Set();
  const importPattern = /^import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["'][^"']+["'];?$/gm;

  for (const match of source.matchAll(importPattern)) {
    const clause = match[1].trim();
    if (clause.startsWith("{")) {
      for (const part of clause.slice(1, -1).split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const alias = trimmed.split(/\s+as\s+/).pop()?.trim();
        if (alias) bindings.add(alias);
      }
      continue;
    }

    if (clause.startsWith("*")) {
      const alias = clause.match(/\s+as\s+(\w+)/)?.[1];
      if (alias) bindings.add(alias);
      continue;
    }

    const defaultAlias = clause.split(",")[0]?.trim();
    if (defaultAlias) bindings.add(defaultAlias);
  }

  return bindings;
}

function collectLocalBindings(source) {
  const bindings = new Set();
  const patterns = [
    /^function\s+([A-Z][\w$]*)\s*\(/gm,
    /^const\s+([A-Z][\w$]*)\s*=/gm,
    /^export\s+function\s+([A-Z][\w$]*)\s*\(/gm,
    /^export\s+const\s+([A-Z][\w$]*)\s*=/gm,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      bindings.add(match[1]);
    }
  }

  for (const match of source.matchAll(/function\s+\w+\s*\(\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(":")[0]?.trim();
      if (name && /^[A-Z]/.test(name)) bindings.add(name);
    }
  }

  return bindings;
}

function collectJsxComponents(source) {
  return new Set(
    [...source.matchAll(/<([A-Z][\w$]*)\b/g)].map((match) => match[1]),
  );
}

describe("portal component imports", () => {
  test("command palette exports used by PortalWorkspace resolve", async () => {
    const palette = await import("./PortalCommandPalette.js");

    expect(typeof palette.PortalCommandPaletteRoot).toBe("function");
    expect(typeof palette.PortalCommandPaletteTrigger).toBe("function");
  });

  for (const file of PORTAL_COMPONENT_FILES) {
    test(`${file} only renders components that are imported or defined locally`, () => {
      const source = read(file);
      const imports = collectImportedBindings(source);
      const locals = collectLocalBindings(source);
      const jsxComponents = collectJsxComponents(source);

      const unresolved = [...jsxComponents]
        .filter((name) => !imports.has(name) && !locals.has(name) && !INTRINSIC_TAGS.has(name))
        .sort();

      expect(unresolved).toEqual([]);
    });
  }
});
