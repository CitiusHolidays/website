export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject | undefined;

export interface JsonObject {
  [key: string]: JsonValue;
}

export function isJsonObject<Value>(value: Value): value is Value & JsonObject {
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: Object() is an intentional primitive-boxing probe.
  return value !== null && value !== undefined && !Array.isArray(value) && Object(value) === value;
}
