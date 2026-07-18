import { describe, expect, test } from "bun:test";
import { firstSelectableOptionLabel, selectOptionByMatchingLabel } from "./select";

function mockSelect(options: string[]) {
  return {
    locator: () => ({
      allTextContents: async () => options,
    }),
    selectOption: async ({ label }: { label: string }) => {
      if (!options.includes(label)) {
        throw new Error(`missing option ${label}`);
      }
    },
  };
}

describe("selectOptionByMatchingLabel", () => {
  test("selects the exact option text when label match is partial", async () => {
    const select = mockSelect(["Select job card...", "JC-0001-NS · Client"]);
    await selectOptionByMatchingLabel(select as never, "JC-0001-NS");
  });

  test("firstSelectableOptionLabel skips placeholders", async () => {
    const select = mockSelect(["Select job card...", "JC-0002-AB · Client"]);
    await expect(firstSelectableOptionLabel(select as never)).resolves.toBe("JC-0002-AB · Client");
  });
});
