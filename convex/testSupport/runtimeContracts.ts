import type { RuntimeValue } from "../lib/runtimeValues";

/** Minimal index-builder contract used by in-memory Convex test contexts. */
export interface TestIndexQuery {
  eq: (field: string, value: RuntimeValue) => TestIndexQuery;
}
