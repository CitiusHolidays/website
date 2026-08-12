import ts from "typescript";

export type TransitionPolicyViolationKind =
  | "bare-transition"
  | "broad-transition"
  | "global-css-variable-motion"
  | "layout-motion"
  | "layout-transition"
  | "permanent-will-change";

export interface TransitionPolicyViolation {
  detail: string;
  file: string;
  kind: TransitionPolicyViolationKind;
  line: number;
}

interface ScanTransitionPolicySourceInput {
  allowedLayoutProperties?: ReadonlySet<string>;
  contents: string;
  file: string;
}

const CLASS_HELPERS = new Set(["clsx", "cn", "cva"]);
const MOTION_STATE_PROPS = new Set([
  "animate",
  "exit",
  "initial",
  "whileFocus",
  "whileHover",
  "whileInView",
  "whileTap",
]);
const LAYOUT_PROPERTIES = new Set([
  "align-items",
  "bottom",
  "border-width",
  "display",
  "flex",
  "flex-basis",
  "flex-grow",
  "flex-shrink",
  "font-size",
  "gap",
  "grid-gap",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "justify-content",
  "left",
  "letter-spacing",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "overflow",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "position",
  "right",
  "text-align",
  "top",
  "vertical-align",
  "white-space",
  "width",
  "word-spacing",
]);
const BARE_TRANSITION_TOKEN = /^transition$/;
const BROAD_TRANSITION_TOKEN = /^transition-all$/;
const ARBITRARY_TRANSITION_TOKEN = /^transition-\[([^\]]+)\]$/;
const CLASS_TOKEN_SEPARATOR = /\s+/;
const GLOBAL_STYLE_VARIABLE_PATTERN =
  /document\.(?:documentElement|body)\.style\.setProperty\(\s*["'](--[^"']+)/g;
const GLOBAL_CSS_VARIABLE_TRANSITION_PATTERN =
  /(?::root|\bhtml\b|\bbody\b)[^{]*\{[^}]*transition(?:-property)?\s*:[^;}]*?(--[\w-]+)/g;
const CSS_LAYOUT_TRANSITION_PATTERN =
  /transition(?:-property)?\s*:[^;}]*\b(width|height|max-height|max-width|min-height|min-width|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|top|right|bottom|left|font-size|line-height|grid-template-(?:rows|columns)|gap|letter-spacing|word-spacing)\b/g;
const CSS_WILL_CHANGE_PATTERN = /will-change\s*:\s*([^;}]+)/g;

function normalizePropertyName(value: string): string {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replaceAll("_", "-")
    .toLowerCase();
}

function lineFor(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function scriptKindFor(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (file.endsWith(".jsx") || file.endsWith(".js")) {
    return ts.ScriptKind.JSX;
  }
  return ts.ScriptKind.TS;
}

function collectClassText(node: ts.Node, output: Array<{ node: ts.Node; text: string }>) {
  if (ts.isStringLiteralLike(node)) {
    output.push({ node, text: node.text });
    return;
  }
  if (ts.isTemplateExpression(node)) {
    output.push({ node: node.head, text: node.head.text });
    for (const span of node.templateSpans) {
      collectClassText(span.expression, output);
      output.push({ node: span.literal, text: span.literal.text });
    }
    return;
  }
  ts.forEachChild(node, (child) => collectClassText(child, output));
}

function propertyName(property: ts.ObjectLiteralElementLike): string | null {
  if (!(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))) {
    return null;
  }
  const { name } = property;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text;
  }
  return null;
}

function collectMotionObjectProperties(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  allowedLayoutProperties: ReadonlySet<string>,
  violations: TransitionPolicyViolation[]
) {
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      const rawName = propertyName(property);
      if (!rawName) {
        continue;
      }
      const normalizedName = normalizePropertyName(rawName);
      if (LAYOUT_PROPERTIES.has(normalizedName) && !allowedLayoutProperties.has(normalizedName)) {
        violations.push({
          detail: normalizedName,
          file: sourceFile.fileName,
          kind: "layout-motion",
          line: lineFor(sourceFile, property.getStart(sourceFile)),
        });
      }
    }
    return;
  }
  ts.forEachChild(node, (child) =>
    collectMotionObjectProperties(child, sourceFile, allowedLayoutProperties, violations)
  );
}

function directTransitionKind(token: string): TransitionPolicyViolationKind | null {
  if (BARE_TRANSITION_TOKEN.test(token)) {
    return "bare-transition";
  }
  if (BROAD_TRANSITION_TOKEN.test(token)) {
    return "broad-transition";
  }
  return token.startsWith("will-change-") ? "permanent-will-change" : null;
}

function collectClassTokenViolation(
  token: string,
  line: number,
  sourceFile: ts.SourceFile,
  allowedLayoutProperties: ReadonlySet<string>,
  violations: TransitionPolicyViolation[]
) {
  const directKind = directTransitionKind(token);
  if (directKind) {
    violations.push({ detail: token, file: sourceFile.fileName, kind: directKind, line });
    return;
  }
  const arbitrary = token.match(ARBITRARY_TRANSITION_TOKEN);
  if (!arbitrary?.[1]) {
    return;
  }
  for (const property of arbitrary[1].split(",").map(normalizePropertyName)) {
    if (LAYOUT_PROPERTIES.has(property) && !allowedLayoutProperties.has(property)) {
      violations.push({
        detail: property,
        file: sourceFile.fileName,
        kind: "layout-transition",
        line,
      });
    }
  }
}

function collectClassViolations(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  allowedLayoutProperties: ReadonlySet<string>,
  violations: TransitionPolicyViolation[]
) {
  const fragments: Array<{ node: ts.Node; text: string }> = [];
  collectClassText(node, fragments);

  for (const fragment of fragments) {
    const line = lineFor(sourceFile, fragment.node.getStart(sourceFile));
    for (const token of fragment.text.split(CLASS_TOKEN_SEPARATOR).filter(Boolean)) {
      collectClassTokenViolation(token, line, sourceFile, allowedLayoutProperties, violations);
    }
  }
}

function classExpressions(node: ts.Node, sourceFile: ts.SourceFile): ts.Node[] {
  if (ts.isJsxAttribute(node)) {
    const name = node.name.getText(sourceFile);
    return (name === "className" || name === "class") && node.initializer ? [node.initializer] : [];
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    CLASS_HELPERS.has(node.expression.text) &&
    !hasClassAttributeAncestor(node, sourceFile)
  ) {
    return [...node.arguments];
  }
  return [];
}

function hasClassAttributeAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let { parent } = node;
  while (parent) {
    if (ts.isJsxAttribute(parent)) {
      const name = parent.name.getText(sourceFile);
      return name === "className" || name === "class";
    }
    ({ parent } = parent);
  }
  return false;
}

function motionExpression(node: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
  if (
    ts.isJsxAttribute(node) &&
    MOTION_STATE_PROPS.has(node.name.getText(sourceFile)) &&
    node.initializer
  ) {
    return node.initializer;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "animate"
  ) {
    return node.arguments[1] ?? null;
  }
  return null;
}

function collectRegexViolations(
  input: ScanTransitionPolicySourceInput,
  pattern: RegExp,
  kind: TransitionPolicyViolationKind,
  detailGroup: number,
  violations: TransitionPolicyViolation[]
) {
  pattern.lastIndex = 0;
  for (const match of input.contents.matchAll(pattern)) {
    const detail = match[detailGroup];
    if (!detail || match.index === undefined) {
      continue;
    }
    violations.push({
      detail,
      file: input.file,
      kind,
      line: input.contents.slice(0, match.index).split("\n").length,
    });
  }
}

export function scanTransitionPolicySource(
  input: ScanTransitionPolicySourceInput
): TransitionPolicyViolation[] {
  const allowedLayoutProperties = input.allowedLayoutProperties ?? new Set<string>();
  const violations: TransitionPolicyViolation[] = [];

  if (input.file.endsWith(".css")) {
    collectRegexViolations(
      input,
      CSS_LAYOUT_TRANSITION_PATTERN,
      "layout-transition",
      1,
      violations
    );
  } else {
    const sourceFile = ts.createSourceFile(
      input.file,
      input.contents,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(input.file)
    );

    function visit(node: ts.Node) {
      for (const expression of classExpressions(node, sourceFile)) {
        collectClassViolations(expression, sourceFile, allowedLayoutProperties, violations);
      }
      const expression = motionExpression(node, sourceFile);
      if (expression) {
        collectMotionObjectProperties(expression, sourceFile, allowedLayoutProperties, violations);
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  collectRegexViolations(
    input,
    GLOBAL_STYLE_VARIABLE_PATTERN,
    "global-css-variable-motion",
    1,
    violations
  );
  collectRegexViolations(
    input,
    GLOBAL_CSS_VARIABLE_TRANSITION_PATTERN,
    "global-css-variable-motion",
    1,
    violations
  );
  collectRegexViolations(input, CSS_WILL_CHANGE_PATTERN, "permanent-will-change", 1, violations);

  return violations;
}
