import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import ts from "typescript";

const LEGACY_ARGUMENT_COUNTS = {
  delete: 1,
  get: 1,
  patch: 2,
  replace: 2,
} as const;
const SOURCE_FILE_PATTERN = /\.[jt]s$/;
const TEST_OR_CONFIG_FILE_PATTERN = /(?:\.test|\.config|\.convex\.integration)\.[jt]s$/;

type LegacyMethod = keyof typeof LEGACY_ARGUMENT_COUNTS;

interface Rewrite {
  file: string;
  method: LegacyMethod;
  position: number;
  table: string;
}

function isSourceFile(path: string, root: string) {
  const relativePath = relative(root, path).split(sep).join("/");
  return (
    !(
      relativePath.startsWith("_generated/") ||
      relativePath.startsWith("betterAuth/_generated/") ||
      TEST_OR_CONFIG_FILE_PATTERN.test(relativePath)
    ) && SOURCE_FILE_PATTERN.test(relativePath)
  );
}

export function uniqueTableName(typeText: string) {
  const names = new Set<string>();
  for (const match of typeText.matchAll(/Id<"([^"]+)">|__tableName:\s*"([^"]+)"/g)) {
    const name = match[1] ?? match[2];
    if (name) {
      names.add(name);
    }
  }
  return names.size === 1 ? [...names][0] : null;
}

function rewritesForFile(sourceFile: ts.SourceFile, checker: ts.TypeChecker, convexRoot: string) {
  const rewrites: Rewrite[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      // SAFETY: the preceding name-set guard limits this method to LegacyMethod literals.
      const method = node.expression.name.text as LegacyMethod;
      const databaseExpression = node.expression.expression;
      if (
        method in LEGACY_ARGUMENT_COUNTS &&
        node.arguments.length === LEGACY_ARGUMENT_COUNTS[method] &&
        ts.isPropertyAccessExpression(databaseExpression) &&
        databaseExpression.name.text === "db"
      ) {
        const [idArgument] = node.arguments;
        if (idArgument) {
          const typeText = checker.typeToString(checker.getTypeAtLocation(idArgument));
          const table = uniqueTableName(typeText);
          if (table) {
            rewrites.push({
              file: relative(convexRoot, sourceFile.fileName).split(sep).join("/"),
              method,
              position: idArgument.getStart(sourceFile),
              table,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return rewrites;
}

function runExplicitTableCodemod({ write }: { write: boolean }) {
  const repositoryRoot = resolve(import.meta.dir, "../..");
  const convexRoot = resolve(repositoryRoot, "convex");
  const configPath = resolve(convexRoot, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, convexRoot);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const byFile = new Map<string, Rewrite[]>();

  for (const sourceFile of program.getSourceFiles()) {
    if (!isSourceFile(sourceFile.fileName, convexRoot)) {
      continue;
    }
    const rewrites = rewritesForFile(sourceFile, checker, convexRoot);
    if (rewrites.length > 0) {
      byFile.set(sourceFile.fileName, rewrites);
    }
  }

  for (const [file, rewrites] of byFile) {
    if (!write) {
      continue;
    }
    let source = readFileSync(file, "utf8");
    for (const rewrite of [...rewrites].sort((left, right) => right.position - left.position)) {
      source = `${source.slice(0, rewrite.position)}"${rewrite.table}", ${source.slice(rewrite.position)}`;
    }
    writeFileSync(file, source);
  }

  const rewrites = [...byFile.values()].flat();
  return {
    files: byFile.size,
    methods: Object.fromEntries(
      Object.keys(LEGACY_ARGUMENT_COUNTS).map((method) => [
        method,
        rewrites.filter((rewrite) => rewrite.method === method).length,
      ])
    ),
    rewrites: rewrites.length,
    write,
  };
}

if (import.meta.main) {
  const result = runExplicitTableCodemod({ write: process.argv.includes("--write") });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
