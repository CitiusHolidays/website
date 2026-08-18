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

interface ExportedValidator {
  tableName?: string;
  type: string;
  value?: unknown;
}

function isPlainObject(value: RuntimeValue): value is RuntimeObject {
  return isRuntimeObject(value) && value !== null && !Array.isArray(value);
}

function formatValidatorKind(validator: GenericValidator) {
  return validator.kind ?? "unknown";
}

function assertValueMatchesValidator(
  validator: GenericValidator,
  value: RuntimeValue,
  path: string
): void {
  if (value === undefined) {
    throw new Error(`${path}: undefined is not a valid Convex return value`);
  }

  if (validator.isOptional === "optional" && value === undefined) {
    return;
  }

  switch (validator.kind) {
    case "null":
      if (value !== null) {
        throw new Error(`${path}: expected null`);
      }
      return;
    case "string":
      if (!isRuntimeString(value)) {
        throw new Error(`${path}: expected string`);
      }
      return;
    case "float64":
      if (!isRuntimeNumber(value)) {
        throw new Error(`${path}: expected number`);
      }
      return;
    case "int64":
      if (!isRuntimeBigInt(value)) {
        throw new Error(`${path}: expected bigint`);
      }
      return;
    case "boolean":
      if (!isRuntimeBoolean(value)) {
        throw new Error(`${path}: expected boolean`);
      }
      return;
    case "bytes":
      if (!(value instanceof ArrayBuffer)) {
        throw new Error(`${path}: expected ArrayBuffer`);
      }
      return;
    case "id":
      if (!isRuntimeString(value)) {
        throw new Error(`${path}: expected Convex id string`);
      }
      return;
    case "literal":
      if (value !== validator.value) {
        throw new Error(`${path}: expected literal ${String(validator.value)}`);
      }
      return;
    case "array": {
      if (!Array.isArray(value)) {
        throw new Error(`${path}: expected array`);
      }
      const element = validator.element;
      for (let index = 0; index < value.length; index += 1) {
        assertValueMatchesValidator(element, value[index], `${path}[${index}]`);
      }
      return;
    }
    case "object": {
      if (!isPlainObject(value)) {
        throw new Error(`${path}: expected object`);
      }
      const fields = validator.fields;
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
      return;
    }
    case "union": {
      const members = validator.members;
      const errors: string[] = [];
      for (const member of members) {
        try {
          assertValueMatchesValidator(member, value, path);
          return;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      throw new Error(
        `${path}: value did not match any union member (${formatValidatorKind(validator)}):\n${errors.join("\n")}`
      );
    }
    case "record": {
      if (!isPlainObject(value)) {
        throw new Error(`${path}: expected record object`);
      }
      const recordValidator = validator;
      for (const [recordKey, recordValue] of Object.entries(value)) {
        assertValueMatchesValidator(recordValidator.key, recordKey, `${path}[key:${recordKey}]`);
        assertValueMatchesValidator(recordValidator.value, recordValue, `${path}[${recordKey}]`);
      }
      return;
    }
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
  switch (validator.type) {
    case "any":
      return;
    case "null":
      if (value !== null) {
        throw new Error(`${path}: expected null`);
      }
      return;
    case "string":
    case "id":
      if (!isRuntimeString(value)) {
        throw new Error(`${path}: expected string`);
      }
      return;
    case "number":
      if (!isRuntimeNumber(value)) {
        throw new Error(`${path}: expected number`);
      }
      return;
    case "bigint":
      if (!isRuntimeBigInt(value)) {
        throw new Error(`${path}: expected bigint`);
      }
      return;
    case "boolean":
      if (!isRuntimeBoolean(value)) {
        throw new Error(`${path}: expected boolean`);
      }
      return;
    case "bytes":
      if (!(value instanceof ArrayBuffer)) {
        throw new Error(`${path}: expected ArrayBuffer`);
      }
      return;
    case "literal":
      if (value !== validator.value) {
        throw new Error(`${path}: expected literal ${String(validator.value)}`);
      }
      return;
    case "array": {
      if (!Array.isArray(value)) {
        throw new Error(`${path}: expected array`);
      }
      // SAFETY: the Array validator kind stores exactly one nested ExportedValidator in value.
      const element = validator.value as ExportedValidator;
      for (let index = 0; index < value.length; index += 1) {
        assertValueMatchesExportedValidator(element, value[index], `${path}[${index}]`);
      }
      return;
    }
    case "object": {
      if (!isPlainObject(value)) {
        throw new Error(`${path}: expected object`);
      }
      // SAFETY: the Object validator kind stores a field-name dictionary in value.
      const fields = validator.value as Record<
        string,
        { fieldType: ExportedValidator; optional: boolean }
      >;
      for (const fieldName of Object.keys(value)) {
        if (!(fieldName in fields)) {
          throw new Error(`${path}.${fieldName}: unexpected field`);
        }
      }
      for (const [fieldName, field] of Object.entries(fields)) {
        if (value[fieldName] === undefined) {
          if (field.optional) {
            continue;
          }
          throw new Error(`${path}.${fieldName}: required field is missing`);
        }
        assertValueMatchesExportedValidator(
          field.fieldType,
          value[fieldName],
          `${path}.${fieldName}`
        );
      }
      return;
    }
    case "union": {
      const failures: string[] = [];
      // SAFETY: the Union validator kind stores an array of ExportedValidator members in value.
      for (const member of validator.value as ExportedValidator[]) {
        try {
          assertValueMatchesExportedValidator(member, value, path);
          return;
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      throw new Error(`${path}: value did not match any union member:\n${failures.join("\n")}`);
    }
    default:
      throw new Error(`${path}: unsupported exported validator type ${validator.type}`);
  }
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
