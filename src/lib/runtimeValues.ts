const objectToString = Object.prototype.toString;

export function propertiesWhen<Condition, Properties extends object>(
  condition: Condition,
  createProperties: () => Properties
): Partial<Properties> {
  const selected: Partial<Properties> = {};
  if (condition) {
    Object.assign(selected, createProperties());
  }
  return selected;
}

function hasPrimitiveTag<Value>(value: Value, expectedTag: string): boolean {
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: Object() is an intentional primitive-boxing probe.
  return Object(value) !== value && objectToString.call(value) === expectedTag;
}

export function isRuntimeBigInt<Value>(value: Value): value is Value & bigint {
  return hasPrimitiveTag(value, "[object BigInt]");
}

export function isRuntimeBoolean<Value>(value: Value): value is Value & boolean {
  return hasPrimitiveTag(value, "[object Boolean]");
}

export function isRuntimeFunction<Value>(
  value: Value
): value is Value & ((...arguments_: never[]) => void) {
  return value instanceof Function;
}

export function isRuntimeNumber<Value>(value: Value): value is Value & number {
  return hasPrimitiveTag(value, "[object Number]");
}

export function isRuntimeObject<Value>(value: Value): value is Value & object {
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: Object() is an intentional primitive-boxing probe.
  return Object(value) === value && !isRuntimeFunction(value);
}

export function isRuntimeString<Value>(value: Value): value is Value & string {
  return hasPrimitiveTag(value, "[object String]");
}

export function isRuntimeSymbol<Value>(value: Value): value is Value & symbol {
  return hasPrimitiveTag(value, "[object Symbol]");
}

export function hasOwnKey<ObjectType extends object>(
  value: ObjectType,
  key: PropertyKey
): key is keyof ObjectType {
  return Object.hasOwn(value, key);
}
