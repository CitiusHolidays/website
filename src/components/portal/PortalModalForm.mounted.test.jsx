import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

let Input;
let MultiSelect;
let QueryFilePicker;
let Select;
let Textarea;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  ({ Input, MultiSelect, QueryFilePicker, Select, Textarea } = await import("./PortalModalForm"));
});

afterAll(() => dom.window.close());

describe("mounted portal modal form contracts", () => {
  test("keeps exact required copy and attributes on Staff text fields", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <Input
          id="traveller-name"
          label="Traveller name"
          onChange={() => undefined}
          placeholder="Enter traveller name"
          required
          value=""
        />
      )
    );

    const input = container.querySelector('input[placeholder="Enter traveller name"]');
    const label = container.querySelector("label");
    expect(input?.getAttribute("placeholder")).toBe("Enter traveller name");
    expect(input?.hasAttribute("required")).toBe(true);
    expect(label?.getAttribute("for")).toBe(input?.id);
    expect(container.textContent).toContain("Traveller name * required");

    await act(async () => root.unmount());
  });

  test("associates adjacent validation messages with text, date, and select controls", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <>
          <Input
            error="Enter a Client / Company."
            fieldKey="clientName"
            label="Client / Company"
            onChange={() => undefined}
            value=""
          />
          <Input
            error="Travel Date From must be on or before Travel Date To."
            fieldKey="travelEndDate"
            label="Travel Date To"
            onChange={() => undefined}
            type="date"
            value="2026-08-01"
          />
          <Select
            error="Select Category."
            fieldKey="category"
            label="Category"
            onChange={() => undefined}
            options={[{ label: "Select category…", value: "" }]}
            value=""
          />
        </>
      )
    );

    const invalidControls = [...container.querySelectorAll('[aria-invalid="true"]')];
    expect(invalidControls).toHaveLength(3);
    for (const control of invalidControls) {
      const descriptionId = control.getAttribute("aria-describedby");
      expect(descriptionId).not.toBeNull();
      expect(container.querySelector(`#${descriptionId}`)?.textContent).not.toBe("");
    }

    await act(async () => root.unmount());
    container.remove();
  });

  test("keeps DD/MM/YYYY editing plus the native calendar input", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <Input
          id="travel-date"
          label="Travel date"
          onChange={() => undefined}
          required
          type="date"
          value="2026-08-06"
        />
      )
    );

    const visibleInput = container.querySelector('#travel-date[type="text"]');
    const nativePicker = container.querySelector('input[type="date"]');
    const label = container.querySelector('label[for="travel-date"]');
    expect(label).not.toBeNull();
    expect(visibleInput?.value).toBe("06/08/2026");
    expect(visibleInput?.getAttribute("placeholder")).toBe("DD/MM/YYYY");
    expect(nativePicker?.value).toBe("2026-08-06");

    await act(async () => root.unmount());
  });

  test("keeps textarea word limits and native multi-file attachment attributes", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <>
          <Textarea label="Notes" maxWords={3} onChange={() => undefined} value="" />
          <QueryFilePicker files={[]} inputId="query-files" onChange={() => undefined} />
        </>
      )
    );

    expect(container.querySelector("textarea")?.getAttribute("rows")).toBe("4");
    expect(container.textContent).toContain("0/3 words");

    const fileInput = container.querySelector('#query-files[type="file"]');
    expect(fileInput?.hasAttribute("multiple")).toBe(true);
    expect(fileInput?.getAttribute("accept")).toContain(".pdf");
    expect(fileInput?.getAttribute("accept")).toContain(".xlsx");

    await act(async () => root.unmount());
  });

  test("keeps Select and MultiSelect public string and array callbacks controlled", async () => {
    const selectChanges = [];
    const multiChanges = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <>
          <Select
            label="Role"
            onChange={(value) => selectChanges.push(value)}
            options={[
              { label: "All roles (2)", value: "" },
              { label: "Sales (1)", value: "sales" },
            ]}
            required
            value=""
          />
          <MultiSelect
            label="Teams"
            onChange={(value) => multiChanges.push(value)}
            options={["Sales", "Contracting"]}
            value={["Sales"]}
          />
        </>
      )
    );

    const select = container.querySelector('[role="combobox"]');
    expect(select?.textContent).toContain("All roles (2)");
    expect(select?.closest("label")).toBeNull();
    expect(select?.getAttribute("aria-required")).toBe("true");
    expect(
      container.querySelector('input[aria-hidden="true"]:not([type="checkbox"])')?.required
    ).toBe(true);
    await act(async () => {
      select.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
      select.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "s" }));
    });
    expect(selectChanges).toEqual(["sales"]);

    const contracting = container.querySelector('[role="checkbox"][aria-label="Contracting"]');
    await act(async () => contracting.click());
    expect(multiChanges).toEqual([["Sales", "Contracting"]]);

    await act(async () => root.unmount());
    container.remove();
  });
});
