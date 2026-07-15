import type { GenericValidator } from "convex/values";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValidatorKind(validator: GenericValidator) {
  return validator.kind ?? "unknown";
}

function assertValueMatchesValidator(
  validator: GenericValidator,
  value: unknown,
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
      if (typeof value !== "string") {
        throw new Error(`${path}: expected string`);
      }
      return;
    case "float64":
      if (typeof value !== "number") {
        throw new Error(`${path}: expected number`);
      }
      return;
    case "int64":
      if (typeof value !== "bigint") {
        throw new Error(`${path}: expected bigint`);
      }
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`${path}: expected boolean`);
      }
      return;
    case "bytes":
      if (!(value instanceof ArrayBuffer)) {
        throw new Error(`${path}: expected ArrayBuffer`);
      }
      return;
    case "id":
      if (typeof value !== "string") {
        throw new Error(`${path}: expected Convex id string`);
      }
      return;
    case "literal":
      if (value !== (validator as { value: unknown }).value) {
        throw new Error(
          `${path}: expected literal ${String((validator as { value: unknown }).value)}`
        );
      }
      return;
    case "array": {
      if (!Array.isArray(value)) {
        throw new Error(`${path}: expected array`);
      }
      const element = (validator as { element: GenericValidator }).element;
      for (let index = 0; index < value.length; index += 1) {
        assertValueMatchesValidator(element, value[index], `${path}[${index}]`);
      }
      return;
    }
    case "object": {
      if (!isPlainObject(value)) {
        throw new Error(`${path}: expected object`);
      }
      const fields = (validator as { fields: Record<string, GenericValidator> }).fields;
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
      const members = (validator as { members: GenericValidator[] }).members;
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
      const recordValidator = validator as {
        key: GenericValidator;
        value: GenericValidator;
      };
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
  value: unknown,
  path = "return"
): void {
  assertValueMatchesValidator(validator, value, path);
}

export function expectReturnContractFailure(
  validator: GenericValidator,
  value: unknown,
  path = "return"
): string {
  try {
    assertMatchesReturnContract(validator, value, path);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected return contract validation to fail");
}
