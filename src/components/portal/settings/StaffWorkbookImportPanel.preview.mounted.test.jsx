import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings?tab=workbook",
});
const skippedByReader = Array.from({ length: 14 }, (_, index) => ({
  message: `Missing email ${index + 1}`,
  sourceRowNumber: index + 2,
  sourceSheet: "Staff",
}));
const previewRows = [
  {
    action: "created",
    after: { name: "Synthetic One" },
    changes: [],
    emailNormalized: "one@citius.test",
    sourceRowNumber: 2,
    sourceSheet: "Staff",
  },
  { action: "skipped", message: "", sourceRowNumber: 3, sourceSheet: "Staff" },
  { action: "skipped", message: "Duplicate email", sourceRowNumber: 4, sourceSheet: "Leave" },
];

mock.module("@/lib/portal/staffWorkbookImport", () => ({
  parseStaffWorkbookFile: async () => ({
    rows: [{ email: "one@citius.test" }, { email: "two@citius.test" }],
    skipped: skippedByReader,
  }),
}));
mock.module("convex/react", () => ({
  useConvex: () => ({
    query: async () => ({
      rows: previewRows,
      summary: { created: 1, skipped: 2, unchanged: 0, updated: 0 },
    }),
  }),
  useMutation: () => async () => undefined,
}));

let createRoot;
let PortalToastProvider;
let StaffWorkbookImportPanel;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ StaffWorkbookImportPanel } = await import("./StaffWorkbookImportPanel"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

describe("Staff workbook import preview", () => {
  test("summarises the preview, the selection and the first twelve unreadable rows", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalToastProvider>
          <StaffWorkbookImportPanel onClose={() => undefined} />
        </PortalToastProvider>
      )
    );
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new dom.window.File(["synthetic"], "staff.xlsx")],
    });
    await act(async () => input.dispatchEvent(new dom.window.Event("change", { bubbles: true })));

    expect(container.textContent).toContain("Preview skipped 2 rows. 1 row selected to apply.");
    const issueRows = (title) =>
      [...container.querySelectorAll("div")].find(
        (node) => node.firstElementChild?.textContent === title
      )?.lastElementChild.children.length;
    expect(issueRows("Rows the workbook reader couldn't read")).toBe(12);
    expect(issueRows("Rows the preview skipped")).toBe(2);
    expect(container.textContent).toContain("Rows the workbook reader couldn't read");
    expect(container.textContent).toContain("Missing email 12");
    expect(container.textContent).not.toContain("Missing email 13");
    expect(container.textContent).toContain("Rows the preview skipped");
    expect(container.textContent).toContain("Staff row 3: Skipped");
    expect(container.textContent).toContain("Leave row 4: Duplicate email");

    const acceptAll = container.querySelector('[aria-label="Accept all created/updated rows (1)"]');
    await act(async () => acceptAll.click());
    expect(container.textContent).toContain("Preview skipped 2 rows. No rows selected to apply.");

    await act(async () => root.unmount());
    container.remove();
  });
});
