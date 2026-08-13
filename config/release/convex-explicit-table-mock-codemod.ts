import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const LEGACY_PARAMETER_COUNTS = {
  delete: 1,
  get: 1,
  patch: 2,
  replace: 2,
} as const;
const TEST_FILE_PATTERN = /(?:\.test|\.convex\.integration)\.ts$/;

type MockMethod = keyof typeof LEGACY_PARAMETER_COUNTS;

interface Rewrite {
  file: string;
  method: MockMethod;
  position: number;
}

function testFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === "_generated" || name === "node_modules" ? [] : testFiles(path);
    }
    return TEST_FILE_PATTERN.test(name) ? [path] : [];
  });
}

function propertyName(node: ts.PropertyName | undefined) {
  if (node && (ts.isIdentifier(node) || ts.isStringLiteral(node))) {
    return node.text;
  }
  return null;
}

function isDirectDbObject(node: ts.ObjectLiteralExpression) {
  const { parent } = node;
  return (
    (ts.isPropertyAssignment(parent) && propertyName(parent.name) === "db") ||
    (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.name.text === "db")
  );
}

type MockCallable = ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration;

function mockCallable(property: ts.ObjectLiteralElementLike): MockCallable | null {
  if (ts.isMethodDeclaration(property)) {
    return property;
  }
  if (
    ts.isPropertyAssignment(property) &&
    (ts.isArrowFunction(property.initializer) || ts.isFunctionExpression(property.initializer))
  ) {
    return property.initializer;
  }
  return null;
}

function rewriteForProperty(
  property: ts.ObjectLiteralElementLike,
  source: string,
  sourceFile: ts.SourceFile,
  file: string
): Rewrite | null {
  const method = propertyName(property.name) as MockMethod | null;
  if (!(method && method in LEGACY_PARAMETER_COUNTS)) {
    return null;
  }
  const callable = mockCallable(property);
  if (!callable || callable.parameters.length !== LEGACY_PARAMETER_COUNTS[method]) {
    return null;
  }
  const [firstParameter] = callable.parameters;
  if (!firstParameter) {
    return null;
  }
  const preceding = source.slice(
    Math.max(0, firstParameter.getStart(sourceFile) - 1),
    firstParameter.getStart(sourceFile)
  );
  if (preceding !== "(") {
    throw new Error(`Unsupported unparenthesized DB mock ${file}:${method}`);
  }
  return { file, method, position: firstParameter.getStart(sourceFile) };
}

function rewritesInSource(source: string, file: string) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const rewrites: Rewrite[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node) && isDirectDbObject(node)) {
      for (const property of node.properties) {
        const rewrite = rewriteForProperty(property, source, sourceFile, file);
        if (rewrite) {
          rewrites.push(rewrite);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return rewrites;
}

export function runExplicitTableMockCodemod({ write }: { write: boolean }) {
  const repositoryRoot = resolve(import.meta.dir, "../..");
  const convexRoot = resolve(repositoryRoot, "convex");
  const byFile = new Map<string, Rewrite[]>();
  for (const path of testFiles(convexRoot)) {
    const file = relative(repositoryRoot, path).split(sep).join("/");
    const rewrites = rewritesInSource(readFileSync(path, "utf8"), file);
    if (rewrites.length > 0) {
      byFile.set(path, rewrites);
    }
  }
  for (const [file, rewrites] of byFile) {
    if (!write) {
      continue;
    }
    let source = readFileSync(file, "utf8");
    for (const rewrite of [...rewrites].sort((left, right) => right.position - left.position)) {
      source = `${source.slice(0, rewrite.position)}_table: string, ${source.slice(rewrite.position)}`;
    }
    writeFileSync(file, source);
  }
  const rewrites = [...byFile.values()].flat();
  return {
    files: byFile.size,
    methods: Object.fromEntries(
      Object.keys(LEGACY_PARAMETER_COUNTS).map((method) => [
        method,
        rewrites.filter((rewrite) => rewrite.method === method).length,
      ])
    ),
    rewrites: rewrites.length,
    write,
  };
}

if (import.meta.main) {
  process.stdout.write(
    `${JSON.stringify(runExplicitTableMockCodemod({ write: process.argv.includes("--write") }), null, 2)}\n`
  );
}
