import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

export const CONVEX_REGISTRATION_KINDS = [
  "query",
  "mutation",
  "action",
  "internalQuery",
  "internalMutation",
  "internalAction",
] as const;

export type ConvexRegistrationKind = (typeof CONVEX_REGISTRATION_KINDS)[number];

export interface ConvexRegistration {
  block: string;
  file: string;
  kind: ConvexRegistrationKind;
  module: string;
  name: string;
}

const DIRECT_REGISTRATIONS = new Set<string>(CONVEX_REGISTRATION_KINDS);
const SOURCE_EXTENSION = /\.[jt]s$/;
const NON_SOURCE_FILE = /(?:\.test|\.config)\.[jt]s$/;
const CONVEX_SERVER_MODULE = /(?:^|\/)_generated\/server$/;
const OUT_OF_SCOPE_CONVEX_SERVER_EXPORTS = new Set(["env", "httpAction"]);

interface ConvexServerImports {
  constructorBindings: Map<string, ConvexRegistrationKind>;
  otherBindings: Set<string>;
}

function namedConvexServerImports(statement: ts.Statement, file: string) {
  if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
    return null;
  }
  if (!CONVEX_SERVER_MODULE.test(statement.moduleSpecifier.text)) {
    return null;
  }
  const { importClause } = statement;
  if (!importClause || importClause.isTypeOnly) {
    return null;
  }
  if (
    importClause.name ||
    (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings))
  ) {
    throw new Error(
      `Unsupported Convex server import in ${file}; use named constructor imports so the registration inventory can classify them`
    );
  }
  return importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)
    ? importClause.namedBindings
    : null;
}

function recordConvexServerImport(specifier: ts.ImportSpecifier, imports: ConvexServerImports) {
  if (specifier.isTypeOnly) {
    return;
  }
  const importedName = (specifier.propertyName ?? specifier.name).text;
  const localName = specifier.name.text;
  if (DIRECT_REGISTRATIONS.has(importedName)) {
    // SAFETY: DIRECT_REGISTRATIONS contains only ConvexRegistrationKind literals.
    imports.constructorBindings.set(localName, importedName as ConvexRegistrationKind);
  } else if (!OUT_OF_SCOPE_CONVEX_SERVER_EXPORTS.has(importedName)) {
    imports.otherBindings.add(localName);
  }
}

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

function exportedVariableName(statement: ts.VariableStatement) {
  const exported = statement.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );
  if (!exported || statement.declarationList.declarations.length !== 1) {
    return null;
  }
  const [declaration] = statement.declarationList.declarations;
  if (!(declaration && ts.isIdentifier(declaration.name) && declaration.initializer)) {
    return null;
  }
  return { initializer: declaration.initializer, name: declaration.name.text };
}

function convexServerImports(sourceFile: ts.SourceFile, file: string): ConvexServerImports {
  const imports: ConvexServerImports = {
    constructorBindings: new Map(),
    otherBindings: new Set(),
  };

  for (const statement of sourceFile.statements) {
    const namedImports = namedConvexServerImports(statement, file);
    if (!namedImports) {
      continue;
    }
    for (const specifier of namedImports.elements) {
      recordConvexServerImport(specifier, imports);
    }
  }

  return imports;
}

function registrationKindForCallee(
  callee: ts.LeftHandSideExpression,
  imports: ConvexServerImports,
  file: string
) {
  if (!ts.isIdentifier(callee)) {
    return null;
  }
  const kind = imports.constructorBindings.get(callee.text);
  if (kind) {
    return kind;
  }
  if (imports.otherBindings.has(callee.text)) {
    throw new Error(
      `Unrecognized Convex server registration constructor ${file}:${callee.text}; classify it before exporting capabilities`
    );
  }
  return null;
}

function directRegistrationCalls(
  node: ts.Node,
  imports: ConvexServerImports,
  file: string
): ConvexRegistrationKind[] {
  const kinds: ConvexRegistrationKind[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child)) {
      const kind = registrationKindForCallee(child.expression, imports, file);
      if (kind) {
        kinds.push(kind);
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return kinds;
}

function localRegistrationFactories(
  sourceFile: ts.SourceFile,
  imports: ConvexServerImports,
  file: string
) {
  const factories = new Map<string, ConvexRegistrationKind>();
  for (const statement of sourceFile.statements) {
    let name: string | null = null;
    let body: ts.Node | null = null;
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      const { body: functionBody, name: functionName } = statement;
      name = functionName.text;
      body = functionBody;
    } else if (ts.isVariableStatement(statement)) {
      const [declaration] = statement.declarationList.declarations;
      if (
        statement.declarationList.declarations.length === 1 &&
        declaration &&
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        name = declaration.name.text;
        const { body: initializerBody } = declaration.initializer;
        body = initializerBody;
      }
    }
    if (!(name && body)) {
      continue;
    }
    const kinds = [...new Set(directRegistrationCalls(body, imports, file))];
    if (kinds.length === 1) {
      factories.set(name, kinds[0]);
    } else if (kinds.length > 1) {
      throw new Error(`Registration factory ${name} delegates to multiple Convex constructors`);
    }
  }
  return factories;
}

export function registrationsInSource(
  source: string,
  file: string,
  allowedFactories: ReadonlySet<string> = new Set()
): ConvexRegistration[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = convexServerImports(sourceFile, file);
  const localFactories = localRegistrationFactories(sourceFile, imports, file);
  const module = file.replace(SOURCE_EXTENSION, "").split(sep).join("/");
  const registrations: ConvexRegistration[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    const exported = exportedVariableName(statement);
    if (!(exported && ts.isCallExpression(exported.initializer))) {
      continue;
    }
    const callee = exported.initializer.expression;
    if (!ts.isIdentifier(callee)) {
      continue;
    }
    const directKind = registrationKindForCallee(callee, imports, file);
    const factoryKind = localFactories.get(callee.text);
    if (factoryKind && !allowedFactories.has(`${file}:${callee.text}`)) {
      throw new Error(
        `Unrecognized Convex registration factory ${file}:${callee.text}; classify it before exporting capabilities`
      );
    }
    const kind = directKind ?? factoryKind;
    if (!kind) {
      continue;
    }
    registrations.push({
      block: exported.initializer.getText(sourceFile),
      file,
      kind,
      module,
      name: exported.name,
    });
  }
  return registrations;
}

export function discoverConvexRegistrations(
  convexRoot: string,
  allowedFactories: ReadonlySet<string> = new Set()
) {
  return sourceFiles(convexRoot).flatMap((path) => {
    const file = relative(convexRoot, path).split(sep).join("/");
    return registrationsInSource(readFileSync(path, "utf8"), file, allowedFactories);
  });
}
