import { describe, expect, test } from "bun:test";
import {
  firstSelectableOptionLabel,
  selectFirstSelectableOption,
  selectOptionByMatchingLabel,
} from "./select";

function mockSelect(options: string[]) {
  return {
    evaluate: async () => true,
    locator: () => ({
      allTextContents: async () => options,
    }),
    selectOption: ({ label }: { label: string }) => {
      if (!options.includes(label)) {
        throw new Error(`missing option ${label}`);
      }
    },
  };
}

function mockBaseUiSelect(options: string[]) {
  let expanded = false;
  let selected: string | null = null;
  const optionLocator = {
    allTextContents: async () => options,
    click: () => {
      selected = options[0] ?? null;
      expanded = false;
    },
  };

  return {
    click: () => {
      expanded = true;
    },
    evaluate: async () => false,
    getAttribute: async () => (expanded ? "true" : "false"),
    page: () => ({
      getByRole: (_role: string, query?: { name?: string }) => {
        if (query?.name) {
          return {
            click: () => {
              selected = query.name ?? null;
              expanded = false;
            },
          };
        }
        return optionLocator;
      },
    }),
    selected: () => selected,
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

  test("selects a Base UI option by accessible name", async () => {
    const select = mockBaseUiSelect(["E2E Contracting", "E2E Ticketing"]);
    await selectOptionByMatchingLabel(select as never, "Contracting");
    expect(select.selected()).toBe("E2E Contracting");
  });

  test("selects the first available Base UI option", async () => {
    const select = mockBaseUiSelect(["Proposal One", "Proposal Two"]);
    await selectFirstSelectableOption(select as never);
    expect(select.selected()).toBe("Proposal One");
  });
});
