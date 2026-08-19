import { describe, expect, test } from "bun:test";
import { createLazyModuleLoader } from "./spreadsheetLazyRuntime";

describe("Spreadsheet lazy runtime", () => {
  test("Does not request workbook code until the user action and caches the first request", async () => {
    let requests = 0;
    const load = createLazyModuleLoader(() => {
      requests += 1;
      return Promise.resolve({ parse: () => "parsed" });
    });

    expect(requests).toBe(0);
    expect((await load()).parse()).toBe("parsed");
    expect(requests).toBe(1);
    await load();
    expect(requests).toBe(1);
  });
});
