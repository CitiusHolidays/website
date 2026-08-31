import { describe, expect, test } from "bun:test";
import { registrationsInSource } from "./convex-registration-inventory";

function identities(source: string, allowedFactories: ReadonlySet<string> = new Set()) {
  return registrationsInSource(source, "fixture.ts", allowedFactories).map(
    ({ kind, name }) => `${name}:${kind}`
  );
}

describe("Convex registration source inventory", () => {
  test("classifies direct and renamed generated-server constructor imports", () => {
    const source = `
      import { mutation, query as convexQuery } from "./_generated/server";
      export const read = convexQuery({ args: {}, returns: {}, handler() {} });
      export const write = mutation({ args: {}, returns: {}, handler() {} });
    `;

    expect(identities(source)).toEqual(["read:query", "write:mutation"]);
  });

  test("requires an exact allowlist entry for a wrapper around a renamed constructor", () => {
    const source = `
      import { mutation as convexMutation } from "./_generated/server";
      const wrappedMutation = (config: object) => convexMutation(config as never);
      export const write = wrappedMutation({ args: {}, returns: {}, handler() {} });
    `;

    expect(() => identities(source)).toThrow(
      "Unrecognized Convex registration factory fixture.ts:wrappedMutation"
    );
    expect(identities(source, new Set(["fixture.ts:wrappedMutation"]))).toEqual(["write:mutation"]);
  });

  test("fails when one local wrapper delegates to multiple constructor kinds", () => {
    const source = `
      import { mutation as convexMutation, query as convexQuery } from "./_generated/server";
      function ambiguous(config: object) {
        return Math.random() > 0.5
          ? convexMutation(config as never)
          : convexQuery(config as never);
      }
      export const capability = ambiguous({ args: {}, returns: {}, handler() {} });
    `;

    expect(() => identities(source)).toThrow(
      "Registration factory ambiguous delegates to multiple Convex constructors"
    );
  });

  test("does not classify deceptive local or foreign aliases", () => {
    const localSource = `
      const query = (config: object) => config;
      export const localHelper = query({ value: true });
    `;
    const foreignSource = `
      import { query as convexQuery } from "./not-convex";
      export const foreignHelper = convexQuery({ value: true });
    `;

    expect(identities(localSource)).toEqual([]);
    expect(identities(foreignSource)).toEqual([]);
  });

  test("fails closed on unknown and namespace generated-server bindings", () => {
    const unknownSource = `
      import { customQuery } from "./_generated/server";
      export const hidden = customQuery({ args: {}, returns: {}, handler() {} });
    `;
    const namespaceSource = `
      import * as server from "./_generated/server";
      export const hidden = server.query({ args: {}, returns: {}, handler() {} });
    `;

    expect(() => identities(unknownSource)).toThrow(
      "Unrecognized Convex server registration constructor fixture.ts:customQuery"
    );
    expect(() => identities(namespaceSource)).toThrow(
      "Unsupported Convex server import in fixture.ts"
    );
  });
});
