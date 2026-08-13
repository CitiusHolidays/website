// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local to the harness.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Button, buttonVariants, IconButton } from "./application-button";
import { Field, Input, Textarea } from "./application-field";
import { Badge, Status } from "./application-status";
import { Skeleton } from "./skeleton";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
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

describe("application UI primitives", () => {
  test("keeps Staff and Account button recipes visually separate", async () => {
    const view = await mount(
      <div>
        <Button surface="staff" variant="primary">
          Save
        </Button>
        <Button surface="account">Continue</Button>
        <IconButton aria-label="Open actions" surface="staff">
          ···
        </IconButton>
      </div>
    );

    const [staff, account, icon] = view.container.querySelectorAll("button");
    expect(staff.className).toContain("portal-primary-btn");
    expect(account.className).toContain("account-focus");
    expect(account.className).not.toContain("portal-primary-btn");
    expect(icon.getAttribute("aria-label")).toBe("Open actions");
    expect(icon.className).toContain("min-w-11");
    expect(buttonVariants({ surface: "staff", variant: "danger" })).toContain("portal-danger-btn");

    await view.unmount();
  });

  test("disables loading actions without replacing their stable content", async () => {
    const view = await mount(
      <Button loading surface="staff" variant="outline">
        Saving
      </Button>
    );
    const button = view.container.querySelector("button");
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute("aria-busy")).toBe("true");
    expect(button?.textContent).toBe("Saving");
    expect(button?.className).toContain("portal-outline-btn");
    await view.unmount();
  });

  test("composes labels, descriptions, errors, focus, and native input types", async () => {
    const view = await mount(
      <div>
        <Field
          description="Use the traveller's legal name."
          error="Name is required."
          label="Traveller name"
          required
          surface="staff"
        >
          <Input aria-label="Traveller name" surface="staff" />
        </Field>
        <Input aria-label="Departure date" surface="staff" type="date" />
        <Input aria-label="Passport file" surface="staff" type="file" />
        <Field label="Account name" surface="account">
          <Input aria-label="Account name" surface="account" />
        </Field>
        <Textarea aria-label="Profile note" surface="account" />
      </div>
    );

    const [name, date, file] = view.container.querySelectorAll("input");
    await act(() => name.focus());
    expect(document.activeElement).toBe(name);
    expect(name.className).toContain("bg-brand-light");
    expect(date.type).toBe("date");
    expect(file.type).toBe("file");
    expect(view.container.textContent).toContain("Traveller name");
    expect(view.container.textContent).toContain("required");
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Name is required.");
    const accountLabel = [...view.container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Account name")
    );
    expect(accountLabel?.className).toContain("text-xs");
    expect(view.container.querySelector("textarea")?.className).toContain("account-focus");

    await view.unmount();
  });

  test("keeps feedback and loading recipes surface-specific", async () => {
    const view = await mount(
      <div>
        <Badge surface="staff">Assigned</Badge>
        <Status surface="account" tone="success">
          Confirmed
        </Status>
        <Skeleton aria-label="Staff loading" surface="staff" />
        <Skeleton aria-label="Account loading" surface="account" />
      </div>
    );

    const [staffSkeleton, accountSkeleton] =
      view.container.querySelectorAll('[data-slot="skeleton"]');
    expect(view.container.textContent).toContain("Assigned");
    expect(view.container.textContent).toContain("Confirmed");
    expect(view.container.querySelector('[data-surface="account"]')?.className).toContain(
      "account"
    );
    expect(staffSkeleton.className).toContain("bg-brand-border");
    expect(accountSkeleton.className).toContain("account");

    await view.unmount();
  });
});
