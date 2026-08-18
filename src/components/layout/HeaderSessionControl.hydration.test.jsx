import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { HeaderSessionControl } from "./HeaderSessionControl";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterAll(() => dom.window.close());

const authenticatedUser = {
  email: "traveller@example.com",
  name: "Test Traveller",
};

function getControlProps(overrides = {}) {
  return {
    canAccessPortal: true,
    isPending: true,
    isScrolled: false,
    onLogout: () => undefined,
    setUserMenuOpen: () => undefined,
    user: null,
    userMenuOpen: false,
    userMenuRef: createRef(),
    ...overrides,
  };
}

function renderControl(props) {
  return renderToString(<HeaderSessionControl {...props} />);
}

async function expectSettledHydration(props, expectedText) {
  const container = document.createElement("div");
  container.innerHTML = renderControl(getControlProps());
  document.body.append(container);
  const reservedSlot = container.querySelector("[data-header-session-control]");
  const recoverableErrors = [];
  let root;

  await act(() => {
    root = hydrateRoot(container, <HeaderSessionControl {...props} />, {
      onRecoverableError: (error) => recoverableErrors.push(error),
    });
  });

  expect(container.querySelector("[data-header-session-control]")).toBe(reservedSlot);
  expect(container.textContent).toContain(expectedText);
  expect(recoverableErrors).toEqual([]);

  await act(() => root.unmount());
  container.remove();
}

describe("HeaderSessionControl hydration", () => {
  test("Reserves identical server and first-client structure for every session state", () => {
    const pendingMarkup = renderControl(getControlProps());
    const anonymousMarkup = renderControl(getControlProps({ isPending: false }));
    const authenticatedMarkup = renderControl(
      getControlProps({ isPending: false, user: authenticatedUser })
    );

    expect(anonymousMarkup).toBe(pendingMarkup);
    expect(authenticatedMarkup).toBe(pendingMarkup);
    expect(pendingMarkup).toContain('data-header-session-control=""');
    expect(pendingMarkup).toContain("h-11 w-[7.5rem]");
    expect(pendingMarkup).toContain("md:w-[11.5rem]");
    expect(pendingMarkup).toContain('data-header-session-placeholder=""');
    expect(pendingMarkup).not.toContain("Sign In");
  });

  test("Hydrates pending server markup against settled anonymous and authenticated clients", async () => {
    await expectSettledHydration(getControlProps({ isPending: false }), "Sign In");
    await expectSettledHydration(
      getControlProps({ isPending: false, user: authenticatedUser }),
      "Test"
    );
  });

  test("Hydrates without recovery and reveals pending, anonymous, and authenticated states in place", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderControl(getControlProps());
    document.body.append(container);
    const recoverableErrors = [];
    let root;

    await act(() => {
      root = hydrateRoot(container, <HeaderSessionControl {...getControlProps()} />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    const reservedSlot = container.querySelector("[data-header-session-control]");
    expect(reservedSlot.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("[data-header-session-placeholder]")).not.toBeNull();
    expect(recoverableErrors).toEqual([]);

    await act(() => {
      root.render(<HeaderSessionControl {...getControlProps({ isPending: false })} />);
    });

    expect(container.querySelector("[data-header-session-control]")).toBe(reservedSlot);
    expect(reservedSlot.hasAttribute("aria-busy")).toBe(false);
    expect(container.textContent).toContain("Sign In");
    expect(container.querySelector("[data-header-session-placeholder]")).toBeNull();

    await act(() => {
      root.render(
        <HeaderSessionControl {...getControlProps({ isPending: false, user: authenticatedUser })} />
      );
    });

    expect(container.querySelector("[data-header-session-control]")).toBe(reservedSlot);
    expect(container.textContent).toContain("Test");
    expect(container.textContent).not.toContain("Sign In");
    expect(recoverableErrors).toEqual([]);

    await act(() => root.unmount());
    container.remove();
  });
});
