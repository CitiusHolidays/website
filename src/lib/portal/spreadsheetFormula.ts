import { isRuntimeNumber } from "../runtimeValues";

export type SpreadsheetScalar = number | string | boolean | null;

export interface SpreadsheetFormulaResolver {
  resolveCell: (reference: string) => SpreadsheetScalar;
  resolveRange: (start: string, end: string) => SpreadsheetScalar[];
}

export type SpreadsheetFormulaResult =
  | { status: "calculated"; value: number }
  | { status: "unsupported" };

type FormulaValue = number | SpreadsheetScalar[];
interface Token {
  type: "cell" | "identifier" | "number" | "operator";
  value: string;
}

const SAFE_FUNCTIONS = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA"]);
const CELL_PATTERN = /^\$?[A-Z]{1,3}\$?\d+$/i;
const IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9_.]*$/i;
const NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;
const SHEET_CELL_PATTERN = /^(?:'((?:[^']|'')+)'|([A-Z_][A-Z0-9_.]*))!(\$?[A-Z]{1,3}\$?\d+)/i;
const FORMULA_PREFIX_PATTERN = /^=/;
const FORBIDDEN_FORMULA_PATTERN = /[[\]{};"@]/;
const OPERATOR_PATTERN = /^[()+\-*/,:]/;
const WHITESPACE_PATTERN = /^\s+/;
const WORD_PATTERN = /^[A-Z_$][A-Z0-9_.$]*/i;

function normalizeCellReference(value: string) {
  return value.replaceAll("$", "").toUpperCase();
}

function tokenize(formula: string): Token[] | null {
  const source = formula.trim().replace(FORMULA_PREFIX_PATTERN, "");
  if (!(source && !FORBIDDEN_FORMULA_PATTERN.test(source))) {
    return null;
  }
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < source.length) {
    const remaining = source.slice(offset);
    const whitespace = WHITESPACE_PATTERN.exec(remaining)?.[0];
    if (whitespace) {
      offset += whitespace.length;
      continue;
    }
    const sheetCell = SHEET_CELL_PATTERN.exec(remaining);
    if (sheetCell) {
      const sheetName = (sheetCell[1] ?? sheetCell[2] ?? "").replaceAll("''", "'");
      tokens.push({
        type: "cell",
        value: `${sheetName}!${normalizeCellReference(sheetCell[3])}`,
      });
      offset += sheetCell[0].length;
      continue;
    }
    const number = NUMBER_PATTERN.exec(remaining)?.[0];
    if (number) {
      tokens.push({ type: "number", value: number });
      offset += number.length;
      continue;
    }
    const word = WORD_PATTERN.exec(remaining)?.[0];
    if (word) {
      if (CELL_PATTERN.test(word)) {
        tokens.push({ type: "cell", value: normalizeCellReference(word) });
      } else if (IDENTIFIER_PATTERN.test(word)) {
        tokens.push({ type: "identifier", value: word.toUpperCase() });
      } else {
        return null;
      }
      offset += word.length;
      continue;
    }
    const operator = OPERATOR_PATTERN.exec(remaining)?.[0];
    if (operator) {
      tokens.push({ type: "operator", value: operator });
      offset += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

function numericValues(value: FormulaValue) {
  const values = Array.isArray(value) ? value : [value];
  return values.filter(
    (candidate): candidate is number => isRuntimeNumber(candidate) && Number.isFinite(candidate)
  );
}

class FormulaParser {
  private cursor = 0;
  private readonly resolver: SpreadsheetFormulaResolver;
  private readonly tokens: Token[];

  constructor(tokens: Token[], resolver: SpreadsheetFormulaResolver) {
    this.tokens = tokens;
    this.resolver = resolver;
  }

  parse() {
    const value = this.expression();
    if (this.cursor !== this.tokens.length || Array.isArray(value) || !Number.isFinite(value)) {
      throw new Error("Unsupported formula");
    }
    return value;
  }

  private expression(): FormulaValue {
    let value = this.term();
    while (this.peekOperator("+") || this.peekOperator("-")) {
      const operator = this.take().value;
      const right = this.term();
      value = this.arithmetic(value, right, operator);
    }
    return value;
  }

  private term(): FormulaValue {
    let value = this.factor();
    while (this.peekOperator("*") || this.peekOperator("/")) {
      const operator = this.take().value;
      const right = this.factor();
      value = this.arithmetic(value, right, operator);
    }
    return value;
  }

  private factor(): FormulaValue {
    if (this.peekOperator("+") || this.peekOperator("-")) {
      const operator = this.take().value;
      const value = this.scalar(this.factor());
      return operator === "-" ? -value : value;
    }
    if (this.peekOperator("(")) {
      this.take();
      const value = this.expression();
      this.expectOperator(")");
      return value;
    }
    return this.valueForToken(this.take());
  }

  private valueForToken(token: Token): FormulaValue {
    if (token.type === "number") {
      return Number(token.value);
    }
    if (token.type === "identifier") {
      return this.functionCall(token.value);
    }
    if (token.type !== "cell") {
      throw new Error("Unsupported formula token");
    }
    return this.cellValue(token.value);
  }

  private cellValue(startReference: string): FormulaValue {
    if (!this.peekOperator(":")) {
      const value = this.resolver.resolveCell(startReference);
      return isRuntimeNumber(value) && Number.isFinite(value) ? value : 0;
    }
    this.take();
    const end = this.take();
    if (end.type !== "cell") {
      throw new Error("Invalid range");
    }
    const sheetName = startReference.includes("!")
      ? startReference.slice(0, startReference.lastIndexOf("!") + 1)
      : "";
    const endReference = end.value.includes("!") ? end.value : `${sheetName}${end.value}`;
    return this.resolver.resolveRange(startReference, endReference);
  }

  private functionCall(name: string): FormulaValue {
    if (!SAFE_FUNCTIONS.has(name)) {
      throw new Error("Unsupported function");
    }
    this.expectOperator("(");
    const values: SpreadsheetScalar[] = [];
    if (!this.peekOperator(")")) {
      let hasNextArgument = true;
      while (hasNextArgument) {
        const argument = this.expression();
        values.push(...(Array.isArray(argument) ? argument : [argument]));
        hasNextArgument = this.peekOperator(",");
        if (hasNextArgument) {
          this.take();
        }
      }
    }
    this.expectOperator(")");
    const numbers = values.filter(
      (value): value is number => isRuntimeNumber(value) && Number.isFinite(value)
    );
    if (name === "COUNT") {
      return numbers.length;
    }
    if (name === "COUNTA") {
      return values.filter((value) => value !== null && value !== "").length;
    }
    if (name === "SUM") {
      return numbers.reduce((sum, value) => sum + value, 0);
    }
    if (numbers.length === 0) {
      throw new Error("Aggregate has no numeric values");
    }
    if (name === "AVERAGE") {
      return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }
    return name === "MIN" ? Math.min(...numbers) : Math.max(...numbers);
  }

  private arithmetic(left: FormulaValue, right: FormulaValue, operator: string) {
    const leftValue = this.scalar(left);
    const rightValue = this.scalar(right);
    if (operator === "+") {
      return leftValue + rightValue;
    }
    if (operator === "-") {
      return leftValue - rightValue;
    }
    if (operator === "*") {
      return leftValue * rightValue;
    }
    if (rightValue === 0) {
      throw new Error("Division by zero");
    }
    return leftValue / rightValue;
  }

  private scalar(value: FormulaValue) {
    const numbers = numericValues(value);
    if (numbers.length !== 1) {
      throw new Error("Range cannot be used as a scalar");
    }
    return numbers[0];
  }

  private peekOperator(value: string) {
    const token = this.tokens[this.cursor];
    return token?.type === "operator" && token.value === value;
  }

  private expectOperator(value: string) {
    if (!this.peekOperator(value)) {
      throw new Error(`Expected ${value}`);
    }
    this.take();
  }

  private take() {
    const token = this.tokens[this.cursor];
    if (!token) {
      throw new Error("Unexpected end of formula");
    }
    this.cursor += 1;
    return token;
  }
}

export function evaluateSafeSpreadsheetFormula(
  formula: string,
  resolver: SpreadsheetFormulaResolver
): SpreadsheetFormulaResult {
  const tokens = tokenize(formula);
  if (!tokens) {
    return { status: "unsupported" };
  }
  try {
    return { status: "calculated", value: new FormulaParser(tokens, resolver).parse() };
  } catch {
    return { status: "unsupported" };
  }
}
