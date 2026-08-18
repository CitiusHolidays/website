export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject | undefined;

export interface JsonObject {
  [key: string]: JsonValue;
}
