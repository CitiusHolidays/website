import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings",
});

let createRoot;
let EntityModalStaffFields;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  ({ createRoot } = await import("react-dom/client"));
  ({ EntityModalStaffFields } = await import("./EntityModalStaffFields"));
});

afterAll(() => dom.window.close());

describe("Staff modal fields", () => {
  test("groups every staff field into four labelled sections without dropping any", async () => {
    const updates = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <EntityModalStaffFields
          form={{
            confirmationDate: "2026-04-01",
            department: "Sales",
            emailAlertRoles: [],
            leaveHeadApproverId: "",
            leavePolicyGroup: "",
            location: "Mumbai",
            marriageLeaveUsed: false,
            maternityEventsUsed: "0",
            mobile: "",
            paternityEventsUsed: "0",
            reportingManagerStaffId: "",
            staffActive: true,
            staffEmail: "nina@citiusholidays.com",
            staffFunction: "Sales leadership",
            staffId: "staff-1",
            staffName: "Nina Sales",
            staffRoles: ["Sales"],
          }}
          leaveHeadApproverOptions={[{ label: "From leave matrix", value: "" }]}
          modal="staff"
          team={[{ id: "staff-head", name: "Bhavesh Mehta" }]}
          updateForm={(...args) => updates.push(args)}
        />
      )
    );

    const legends = [...container.querySelectorAll("fieldset > legend")].map(
      (legend) => legend.textContent
    );
    expect(legends).toEqual([
      "Person",
      "Work and reporting",
      "Leave approval and entitlements",
      "Access and email alerts",
    ]);
    for (const label of [
      "Name",
      "Email",
      "Mobile",
      "Location",
      "Department",
      "Function",
      "Reporting manager",
      "Confirmation date",
      "Leave head approver",
      "Leave policy group",
      "Maternity leave taken (times)",
      "Paternity leave taken (times)",
      "Marriage leave taken",
      "Active",
      "Roles",
      "Additional email alert roles",
    ]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).toContain("HR always gives the second approval");

    const name = container.querySelector('input[value="Nina Sales"]');
    await act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setValue.call(name, "Nina S.");
      name.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    expect(updates.at(-1)).toEqual(["staffName", "Nina S."]);

    await act(async () => root.unmount());
    container.remove();
  });

  test("renders nothing for other modals", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <EntityModalStaffFields
          form={{}}
          leaveHeadApproverOptions={[]}
          modal="expense"
          team={[]}
          updateForm={() => undefined}
        />
      )
    );
    expect(container.innerHTML).toBe("");
    await act(async () => root.unmount());
    container.remove();
  });
});
