// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local to the harness.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";

let Checkbox;
let Radio;
let RadioGroup;
let Select;
let Switch;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  ({ Checkbox } = await import("./application-checkbox"));
  ({ Radio, RadioGroup } = await import("./application-radio"));
  ({ Select } = await import("./application-select"));
  ({ Switch } = await import("./application-switch"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    unmount: async () => act(async () => root.unmount()),
  };
}

describe("controlled application primitives", () => {
  test("Select preserves controlled values, option copy, and selection callbacks", async () => {
    const changes = [];
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <Select
          aria-label="Role"
          defaultOpen
          onValueChange={(next) => {
            changes.push(next);
            setValue(next);
          }}
          options={[
            { label: "All roles (2)", value: "" },
            { label: "Sales (1)", value: "sales" },
          ]}
          value={value}
        />
      );
    }
    const view = await mount(<Harness />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    const trigger = view.container.querySelector('[role="combobox"][aria-label="Role"]');
    expect(trigger?.textContent).toContain("All roles (2)");

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain("Sales (1)");
    const sales = [...document.body.querySelectorAll('[role="option"]')].find((option) =>
      option.textContent.includes("Sales (1)")
    );
    await act(async () => sales.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(changes).toEqual(["sales"]);
    expect(trigger.textContent).toContain("Sales (1)");
    expect(document.activeElement).toBe(trigger);
    expect(document.body.querySelector('[data-slot="select-popup"]')?.className).toContain(
      "data-[closed]:hidden"
    );
    await view.unmount();
  });

  test("Select preserves disabled trigger and native form semantics", async () => {
    const view = await mount(
      <Select
        aria-label="Disabled role"
        disabled
        name="role"
        onValueChange={() => undefined}
        options={[{ label: "Sales", value: "sales" }]}
        required
        value="sales"
      />
    );
    const trigger = view.container.querySelector('[role="combobox"]');
    const input = view.container.querySelector('input[aria-hidden="true"]');
    expect(trigger?.hasAttribute("disabled")).toBe(true);
    expect(input?.disabled).toBe(true);
    expect(input?.name).toBe("role");
    expect(input?.required).toBe(true);
    await view.unmount();
  });

  test("Select opens from a complete primary-pointer click sequence", async () => {
    const view = await mount(
      <Select
        aria-label="Query Type"
        onValueChange={() => undefined}
        options={[
          { label: "MICE", value: "MICE" },
          { label: "MICE Bidding", value: "MICE Bidding" },
        ]}
        value="MICE"
      />
    );
    const trigger = view.container.querySelector('[role="combobox"]');
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull();
    await view.unmount();
  });

  test("Checkbox preserves controlled, disabled, and native indeterminate state", async () => {
    const changes = [];
    const inputRef = { current: null };
    const view = await mount(
      <Checkbox
        aria-label="Select all visible rows"
        checked={false}
        indeterminate
        inputRef={inputRef}
        onCheckedChange={(checked) => changes.push(checked)}
      />
    );
    const checkbox = view.container.querySelector('[role="checkbox"]');
    expect(checkbox?.getAttribute("aria-checked")).toBe("mixed");
    expect(inputRef.current?.indeterminate).toBe(true);
    await act(async () => checkbox.click());
    expect(changes).toEqual([true]);
    await view.unmount();
  });

  test("RadioGroup and Switch keep their controlled ownership", async () => {
    const radioChanges = [];
    const switchChanges = [];
    function Harness() {
      const [mode, setMode] = useState("sales");
      const [enabled, setEnabled] = useState(true);
      return (
        <>
          <RadioGroup
            aria-label="Pipeline perspective"
            onValueChange={(value) => {
              radioChanges.push(value);
              setMode(value);
            }}
            value={mode}
          >
            <Radio aria-label="Sales Pipeline" value="sales" />
            <Radio aria-label="Contracting Pipeline" value="contracting" />
          </RadioGroup>
          <Switch
            aria-label="Email notifications"
            checked={enabled}
            onCheckedChange={(checked) => {
              switchChanges.push(checked);
              setEnabled(checked);
            }}
          />
        </>
      );
    }
    const view = await mount(<Harness />);
    const contracting = view.container.querySelector(
      '[role="radio"][aria-label="Contracting Pipeline"]'
    );
    await act(async () => contracting.click());
    expect(radioChanges).toEqual(["contracting"]);
    expect(contracting.getAttribute("aria-checked")).toBe("true");

    const toggle = view.container.querySelector('[role="switch"]');
    await act(async () => toggle.click());
    expect(switchChanges).toEqual([false]);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await view.unmount();
  });
});
