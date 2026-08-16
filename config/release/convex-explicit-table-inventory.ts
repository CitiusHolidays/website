import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

export type ConvexLegacyDocumentMethod = "delete" | "get" | "patch" | "replace";

export interface ConvexLegacyDocumentCall {
  file: string;
  method: ConvexLegacyDocumentMethod;
}

const LEGACY_ARGUMENT_COUNTS = {
  delete: 1,
  get: 1,
  patch: 2,
  replace: 2,
} satisfies Record<ConvexLegacyDocumentMethod, number>;
const SOURCE_EXTENSION = /\.[jt]s$/;
const NON_SOURCE_FILE = /(?:\.test|\.config|\.convex\.integration)\.[jt]s$/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === "_generated" || name === "node_modules") {
      return [];
    }
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    if (!SOURCE_EXTENSION.test(name) || NON_SOURCE_FILE.test(name)) {
      return [];
    }
    return [path];
  });
}

export function legacyDocumentCallsInSource(source: string, file: string) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const calls: ConvexLegacyDocumentCall[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      // SAFETY: the preceding name-set guard limits this method to ConvexLegacyDocumentMethod literals.
      const method = node.expression.name.text as ConvexLegacyDocumentMethod;
      const databaseExpression = node.expression.expression;
      if (
        method in LEGACY_ARGUMENT_COUNTS &&
        node.arguments.length === LEGACY_ARGUMENT_COUNTS[method] &&
        ts.isPropertyAccessExpression(databaseExpression) &&
        databaseExpression.name.text === "db"
      ) {
        calls.push({ file, method });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

export function discoverLegacyDocumentCalls(convexRoot: string) {
  return sourceFiles(convexRoot).flatMap((path) => {
    const file = relative(convexRoot, path).split(sep).join("/");
    return legacyDocumentCallsInSource(readFileSync(path, "utf8"), file);
  });
}

export function summarizeLegacyDocumentCalls(calls: readonly ConvexLegacyDocumentCall[]) {
  const summary = new Map<string, number>();
  for (const { file, method } of calls) {
    const key = `${file}:${method}`;
    summary.set(key, (summary.get(key) ?? 0) + 1);
  }
  return [...summary.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}=${count}`);
}
