import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import {
  firstSelectableOptionLabel,
  selectedOptionLabel,
  selectFirstSelectableOption,
  selectOptionByMatchingLabel,
} from "./select";

function mockSelect(options: string[]) {
  let selected: string | null = null;
  return {
    evaluate: async () => true,
    inputValue: async () => selected ?? "",
    locator: (selector: string) => ({
      allTextContents: async () => options,
      textContent: async () => (selector === "option:checked" ? selected : null),
    }),
    selectOption: ({ label }: { label: string }) => {
      if (!options.includes(label)) {
        throw new Error(`missing option ${label}`);
      }
      selected = label;
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
    textContent: async () => selected,
  };
}

describe("SelectOptionByMatchingLabel", () => {
  test("Selects the exact option text when label match is partial", async () => {
    const select = mockSelect(["Select job card...", "JC-0001-NS · Client"]);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await selectOptionByMatchingLabel(fromAny<never, unknown>(select), "JC-0001-NS");
  });

  test("FirstSelectableOptionLabel skips placeholders", async () => {
    const select = mockSelect(["Select job card...", "JC-0002-AB · Client"]);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(firstSelectableOptionLabel(fromAny<never, unknown>(select))).resolves.toBe(
      "JC-0002-AB · Client"
    );
  });

  test("Selects a Base UI option by accessible name", async () => {
    const select = mockBaseUiSelect(["E2E Contracting", "E2E Ticketing"]);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await selectOptionByMatchingLabel(fromAny<never, unknown>(select), "Contracting");
    expect(select.selected()).toBe("E2E Contracting");
  });

  test("Selects the first available Base UI option", async () => {
    const select = mockBaseUiSelect(["Proposal One", "Proposal Two"]);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await selectFirstSelectableOption(fromAny<never, unknown>(select));
    expect(select.selected()).toBe("Proposal One");
  });

  test("Reads selected labels from native and Base UI selects", async () => {
    const native = mockSelect(["Select proposal...", "P-0001 - Sent"]);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await selectOptionByMatchingLabel(fromAny<never, unknown>(native), "P-0001");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(selectedOptionLabel(fromAny<never, unknown>(native))).resolves.toBe(
      "P-0001 - Sent"
    );

    const baseUi = mockBaseUiSelect(["P-0002 - Sent"]);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await selectFirstSelectableOption(fromAny<never, unknown>(baseUi));
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(selectedOptionLabel(fromAny<never, unknown>(baseUi))).resolves.toBe(
      "P-0002 - Sent"
    );
  });
});
