import type { GenericValidator } from "convex/values";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import {
  isRuntimeBigInt,
  isRuntimeBoolean,
  isRuntimeNumber,
  isRuntimeObject,
  isRuntimeString,
} from "../lib/runtimeValues";

interface RegisteredFunctionWithReturns {
  exportReturns: () => string;
}

interface ExportedValidatorField {
  fieldType: ExportedValidator;
  optional: boolean;
}

interface ExportedValidatorFields {
  [fieldName: string]: ExportedValidatorField;
}

type ExportedValidatorValue =
  | ExportedValidator
  | ExportedValidator[]
  | ExportedValidatorFields
  | RuntimeValue;

interface ExportedValidator {
  tableName?: string;
  type: string;
  value?: ExportedValidatorValue;
}

interface RuntimeGenericValidator {
  element?: GenericValidator;
  fields?: Record<string, GenericValidator>;
  isOptional?: string;
  key?: GenericValidator;
  kind: string;
  members?: GenericValidator[];
  value?: GenericValidator | RuntimeValue;
}

function isPlainObject(value: RuntimeValue): value is RuntimeObject {
  return isRuntimeObject(value) && value !== null && !Array.isArray(value);
}

function formatValidatorKind(validator: GenericValidator) {
  return validator.kind ?? "unknown";
}

function assertExpected(condition: boolean, path: string, expected: string): void {
  if (!condition) {
    throw new Error(`${path}: expected ${expected}`);
  }
}

function assertGenericArray(
  element: GenericValidator | undefined,
  value: RuntimeValue,
  path: string
): void {
  assertExpected(Array.isArray(value), path, "array");
  if (!(element && Array.isArray(value))) {
    throw new Error(`${path}: array validator is missing its element contract`);
  }
  for (const [index, entry] of value.entries()) {
    assertValueMatchesValidator(element, entry, `${path}[${index}]`);
  }
}

function assertGenericObject(
  fields: Record<string, GenericValidator> | undefined,
  value: RuntimeValue,
  path: string
): void {
  assertExpected(isPlainObject(value), path, "object");
  if (!(fields && isPlainObject(value))) {
    throw new Error(`${path}: object validator is missing its field contracts`);
  }
  for (const fieldName of Object.keys(value)) {
    if (!(fieldName in fields)) {
      throw new Error(`${path}.${fieldName}: unexpected field`);
    }
  }
  for (const [fieldName, fieldValidator] of Object.entries(fields)) {
    const fieldValue = value[fieldName];
    if (fieldValue === undefined) {
      if (fieldValidator.isOptional === "optional") {
        continue;
      }
      throw new Error(`${path}.${fieldName}: required field is missing`);
    }
    assertValueMatchesValidator(fieldValidator, fieldValue, `${path}.${fieldName}`);
  }
}

function assertGenericUnion(
  members: GenericValidator[] | undefined,
  value: RuntimeValue,
  path: string,
  kind: string
): void {
  if (!members) {
    throw new Error(`${path}: union validator is missing its member contracts`);
  }
  const errors: string[] = [];
  for (const member of members) {
    try {
      assertValueMatchesValidator(member, value, path);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`${path}: value did not match any union member (${kind}):\n${errors.join("\n")}`);
}

function assertGenericRecord(
  key: GenericValidator | undefined,
  memberValue: GenericValidator | RuntimeValue | undefined,
  value: RuntimeValue,
  path: string
): void {
  assertExpected(isPlainObject(value), path, "record object");
  if (!(key && memberValue && isPlainObject(value))) {
    throw new Error(`${path}: record validator is missing its key or value contract`);
  }
  // SAFETY: Convex record validators store a GenericValidator in the record value slot.
  const valueValidator = memberValue as GenericValidator;
  for (const [recordKey, recordValue] of Object.entries(value)) {
    assertValueMatchesValidator(key, recordKey, `${path}[key:${recordKey}]`);
    assertValueMatchesValidator(valueValidator, recordValue, `${path}[${recordKey}]`);
  }
}

function assertValueMatchesValidator(
  validator: GenericValidator,
  value: RuntimeValue,
  path: string
): void {
  if (value === undefined) {
    throw new Error(`${path}: undefined is not a valid Convex return value`);
  }

  // SAFETY: GenericValidator runtime instances expose these stable Convex validator fields.
  const runtimeValidator = validator as RuntimeGenericValidator;
  const { element, fields, key, kind, members, value: validatorValue } = runtimeValidator;
  switch (kind) {
    case "null":
      assertExpected(value === null, path, "null");
      return;
    case "string":
      assertExpected(isRuntimeString(value), path, "string");
      return;
    case "float64":
      assertExpected(isRuntimeNumber(value), path, "number");
      return;
    case "int64":
      assertExpected(isRuntimeBigInt(value), path, "bigint");
      return;
    case "boolean":
      assertExpected(isRuntimeBoolean(value), path, "boolean");
      return;
    case "bytes":
      assertExpected(value instanceof ArrayBuffer, path, "ArrayBuffer");
      return;
    case "id":
      assertExpected(isRuntimeString(value), path, "Convex id string");
      return;
    case "literal":
      assertExpected(value === validatorValue, path, `literal ${String(validatorValue)}`);
      return;
    case "array":
      assertGenericArray(element, value, path);
      return;
    case "object":
      assertGenericObject(fields, value, path);
      return;
    case "union":
      assertGenericUnion(members, value, path, formatValidatorKind(validator));
      return;
    case "record":
      assertGenericRecord(key, validatorValue, value, path);
      return;
    case "any":
      return;
    default:
      throw new Error(`${path}: unsupported validator kind ${formatValidatorKind(validator)}`);
  }
}

export function assertMatchesReturnContract(
  validator: GenericValidator,
  value: RuntimeValue,
  path = "return"
): void {
  assertValueMatchesValidator(validator, value, path);
}

export function expectReturnContractFailure(
  validator: GenericValidator,
  value: RuntimeValue,
  path = "return"
): string {
  try {
    assertMatchesReturnContract(validator, value, path);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected return contract validation to fail");
}

function assertValueMatchesExportedValidator(
  validator: ExportedValidator,
  value: RuntimeValue,
  path: string
): void {
  const { type, value: validatorValue } = validator;
  switch (type) {
    case "any":
      return;
    case "null":
      assertExpected(value === null, path, "null");
      return;
    case "string":
    case "id":
      assertExpected(isRuntimeString(value), path, "string");
      return;
    case "number":
      assertExpected(isRuntimeNumber(value), path, "number");
      return;
    case "bigint":
      assertExpected(isRuntimeBigInt(value), path, "bigint");
      return;
    case "boolean":
      assertExpected(isRuntimeBoolean(value), path, "boolean");
      return;
    case "bytes":
      assertExpected(value instanceof ArrayBuffer, path, "ArrayBuffer");
      return;
    case "literal":
      assertExpected(value === validatorValue, path, `literal ${String(validatorValue)}`);
      return;
    case "array":
      assertExportedArray(validatorValue, value, path);
      return;
    case "object":
      assertExportedObject(validatorValue, value, path);
      return;
    case "union":
      assertExportedUnion(validatorValue, value, path);
      return;
    default:
      throw new Error(`${path}: unsupported exported validator type ${type}`);
  }
}

function assertExportedArray(
  validatorValue: ExportedValidatorValue | undefined,
  value: RuntimeValue,
  path: string
): void {
  assertExpected(Array.isArray(value), path, "array");
  if (!Array.isArray(value)) {
    return;
  }
  // SAFETY: the Array validator kind stores exactly one nested ExportedValidator in value.
  const element = validatorValue as ExportedValidator;
  for (const [index, entry] of value.entries()) {
    assertValueMatchesExportedValidator(element, entry, `${path}[${index}]`);
  }
}

function assertExportedObject(
  validatorValue: ExportedValidatorValue | undefined,
  value: RuntimeValue,
  path: string
): void {
  assertExpected(isPlainObject(value), path, "object");
  if (!isPlainObject(value)) {
    return;
  }
  // SAFETY: the Object validator kind stores a field-name dictionary in value.
  const exportedFields = validatorValue as ExportedValidatorFields;
  for (const fieldName of Object.keys(value)) {
    if (!(fieldName in exportedFields)) {
      throw new Error(`${path}.${fieldName}: unexpected field`);
    }
  }
  for (const [fieldName, field] of Object.entries(exportedFields)) {
    const fieldValue = value[fieldName];
    if (fieldValue === undefined) {
      if (field.optional) {
        continue;
      }
      throw new Error(`${path}.${fieldName}: required field is missing`);
    }
    assertValueMatchesExportedValidator(field.fieldType, fieldValue, `${path}.${fieldName}`);
  }
}

function assertExportedUnion(
  validatorValue: ExportedValidatorValue | undefined,
  value: RuntimeValue,
  path: string
): void {
  const failures: string[] = [];
  // SAFETY: the Union validator kind stores an array of ExportedValidator members in value.
  const members = validatorValue as ExportedValidator[];
  for (const member of members) {
    try {
      assertValueMatchesExportedValidator(member, value, path);
      return;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`${path}: value did not match any union member:\n${failures.join("\n")}`);
}

/**
 * Exercises the contract attached to the registered Convex function rather
 * than a separately imported validator, preventing handler-only tests from
 * overlooking production return-validation failures.
 */
export function assertMatchesRegisteredReturnContract(
  registeredFunction: RegisteredFunctionWithReturns,
  value: RuntimeValue,
  path = "return"
): void {
  // SAFETY: exportReturns is Convex's serialized ExportedValidator representation.
  const exported = JSON.parse(registeredFunction.exportReturns()) as ExportedValidator | null;
  if (!exported) {
    throw new Error(`${path}: registered function has no return validator`);
  }
  assertValueMatchesExportedValidator(exported, value, path);
}
