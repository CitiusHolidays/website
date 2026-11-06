import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { ConvexError } from "convex/values";
import { JSDOM } from "jsdom";
import { act } from "react";

const REFERENCE_DATE = "2026-11-05";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/travel-schedule",
});
type MutationArgs = Readonly<Record<string, string>>;
interface TripFixture {
  canManage: boolean;
  createdAt: number;
  destination: string;
  endDate: string;
  id: string;
  isCurrent: boolean;
  jobCardId: string | null;
  jobCode: string;
  personName: string;
  staffId: string;
  startDate: string;
  status: string;
  updatedAt: number;
}
const mutationCalls: { args: MutationArgs; reference: string }[] = [];
const mutationHandlers = new Map<string, (args: MutationArgs) => Promise<string | null>>();
let access: { canManageOthers: boolean; staffId: string } | undefined;

function trip(
  id: string,
  personName: string,
  startDate: string,
  endDate: string,
  extra: Partial<TripFixture> = {}
): TripFixture {
  return {
    canManage: true,
    createdAt: 1,
    destination: `${personName} destination`,
    endDate,
    id,
    isCurrent: startDate <= REFERENCE_DATE && endDate >= REFERENCE_DATE,
    jobCardId: null,
    jobCode: "",
    personName,
    staffId: `staff-${id}`,
    startDate,
    status: "planned",
    updatedAt: 1,
    ...extra,
  };
}

const teamTrips = [
  trip("later", "Farhan Qureshi", "2026-11-22", "2026-11-24"),
  trip("now", "Nikhil Joshi", "2026-11-03", "2026-11-09"),
  trip("soon", "Esha Banerjee", "2026-11-08", "2026-11-10"),
  trip("edge", "Bhavesh Mehta", "2026-11-12", "2026-11-13", { canManage: false }),
];
const paginated = new Map<string, readonly (TripFixture | { id: string; name: string })[]>([
  ["list", teamTrips],
  [
    "listPeople",
    [
      { id: "staff-asha", name: "Asha Rao" },
      { id: "staff-bina", name: "Bina Shah" },
    ],
  ],
]);

mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      staffTravel: {
        cancel: "cancel",
        create: "create",
        getAccess: "getAccess",
        list: "list",
        listJobOptions: "listJobOptions",
        listMine: "listMine",
        listPeople: "listPeople",
        update: "update",
      },
    },
  },
}));
mock.module("convex/react", () => ({
  useMutation: (reference: string) => (args: MutationArgs) => {
    mutationCalls.push({ args, reference });
    return mutationHandlers.get(reference)?.(args) ?? Promise.resolve(null);
  },
  usePaginatedQuery: (reference: string) => ({
    loadMore: () => undefined,
    results: paginated.get(reference) ?? [],
    status: "Exhausted",
  }),
  useQuery: (reference: string) => (reference === "getAccess" ? access : undefined),
}));
mock.module("../workspace/usePortalReferenceClock", () => ({
  useActiveLocalReferenceDate: () => REFERENCE_DATE,
}));

let StaffTravelWorkspace: typeof import("./StaffTravelWorkspace").default;
let createRoot: typeof import("react-dom/client").createRoot;

beforeAll(async () => {
  Object.assign(globalThis, {
    document: dom.window.document,
    Element: dom.window.Element,
    Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    MouseEvent: dom.window.MouseEvent,
    Node: dom.window.Node,
    window: dom.window,
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ default: StaffTravelWorkspace } = await import("./StaffTravelWorkspace"));
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});
afterEach(() => {
  mutationCalls.length = 0;
  mutationHandlers.clear();
  document.body.replaceChildren();
});

async function mount(nextAccess = { canManageOthers: true, staffId: "staff-hr" }) {
  access = nextAccess;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<StaffTravelWorkspace />));
  const button = (name: string) => {
    const match = [...container.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === name || item.getAttribute("aria-label") === name
    );
    if (!match) {
      throw new Error(`Missing button: ${name}`);
    }
    return match;
  };
  return {
    button,
    click: (name: string) => act(async () => button(name).click()),
    container,
    unmount: () => act(async () => root.unmount()),
  };
}

async function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof dom.window.HTMLSelectElement
      ? dom.window.HTMLSelectElement.prototype
      : dom.window.HTMLInputElement.prototype;
  await act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(
      new dom.window.Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true })
    );
  });
}

function labelled(container: HTMLElement, label: string) {
  const match = [...container.querySelectorAll("label")].find((item) =>
    item.textContent?.trim().startsWith(label)
  );
  if (!match) {
    throw new Error(`Missing field: ${label}`);
  }
  return match;
}

function selectField(container: HTMLElement, label: string) {
  const select = labelled(container, label).querySelector<HTMLSelectElement>("select");
  if (!select) {
    throw new Error(`Missing select: ${label}`);
  }
  return select;
}

function inputField(container: HTMLElement, label: string) {
  const input = labelled(container, label).querySelector<HTMLInputElement>("input");
  if (!input) {
    throw new Error(`Missing input: ${label}`);
  }
  return input;
}

describe("Travel schedule", () => {
  test("groups team trips into now, next 7 days and later with one primary action", async () => {
    const view = await mount();
    try {
      const groups = [...view.container.querySelectorAll("h3")].map((heading) => ({
        names: [...(heading.parentElement?.querySelectorAll("li") ?? [])].map(
          (row) => row.querySelector("span")?.textContent
        ),
        title: heading.firstChild?.textContent,
      }));
      expect(groups).toEqual([
        { names: ["Nikhil Joshi"], title: "Travelling now" },
        { names: ["Esha Banerjee", "Bhavesh Mehta"], title: "Next 7 days" },
        { names: ["Farhan Qureshi"], title: "Later" },
      ]);
      const primaries = [...view.container.querySelectorAll(".portal-primary-btn")].map((item) =>
        item.textContent?.trim()
      );
      expect(primaries).toEqual(["Add travel"]);
      expect(view.button("Team travel").getAttribute("aria-pressed")).toBe("true");
      expect(view.container.querySelector("h2")?.textContent).toBe("Team travel");
      // Rows the viewer cannot manage stay read-only.
      expect(view.container.querySelector('[aria-label="Edit trip for Bhavesh Mehta"]')).toBeNull();

      await view.click("My trips");
      expect(view.button("My trips").getAttribute("aria-pressed")).toBe("true");
      expect(view.container.querySelector("h2")?.textContent).toBe("My trips");
      expect(view.container.textContent).toContain("You have no trips recorded.");
    } finally {
      await view.unmount();
    }
  });

  test("keeps the cancel-trip confirmation and makes no change until it is confirmed", async () => {
    const view = await mount();
    try {
      await view.click("Cancel trip for Esha Banerjee");
      expect(mutationCalls).toEqual([]);
      expect(view.container.textContent).toContain("Cancel this trip?");
      expect(document.activeElement?.textContent).toBe("Keep trip");
      await view.click("Keep trip");
      expect(mutationCalls).toEqual([]);
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Cancel trip for Esha Banerjee"
      );

      await view.click("Cancel trip for Esha Banerjee");
      const confirm = view.container.querySelector<HTMLButtonElement>(".portal-danger-btn");
      // Only one "Cancel trip" control is shown in the row being confirmed.
      expect(confirm?.closest("li")?.textContent?.match(/Cancel trip/g)?.length).toBe(1);
      await act(async () => confirm?.click());
      expect(mutationCalls).toEqual([{ args: { travelId: "soon" }, reference: "cancel" }]);
    } finally {
      await view.unmount();
    }
  });

  test("U11: keeps the chosen person fixed while saving and restores the draft after a failure", async () => {
    let rejectSave: (error: ConvexError<string>) => void = () => undefined;
    let attempts = 0;
    mutationHandlers.set("create", () => {
      attempts += 1;
      return attempts === 1
        ? new Promise((_resolve, reject) => {
            rejectSave = reject;
          })
        : Promise.resolve("travel-1");
    });
    const view = await mount();
    try {
      await view.click("Add travel");
      expect(view.container.querySelector(".portal-primary-btn")?.textContent).toBe("Save travel");
      expect(document.activeElement?.textContent).toBe("Add travel");
      expect(document.activeElement?.tagName).toBe("H2");
      expect(view.button("Close without saving")).toBeDefined();

      const person = selectField(view.container, "Person");
      await setValue(person, "staff-bina");
      await setValue(inputField(view.container, "Destination"), "Goa");
      await setValue(inputField(view.container, "From"), "2026-11-20");
      await setValue(inputField(view.container, "Through"), "2026-11-22");

      const form = view.container.querySelector("form");
      await act(async () => {
        form?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });
      expect(person.disabled).toBe(true);
      expect(view.button("Close without saving").disabled).toBe(true);

      await act(async () => {
        rejectSave(new ConvexError("Travel overlaps another trip."));
        await Promise.resolve();
      });
      expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(
        "Travel overlaps another trip."
      );
      expect(person.disabled).toBe(false);
      expect(person.value).toBe("staff-bina");
      expect(inputField(view.container, "Destination").value).toBe("Goa");

      await act(async () => {
        form?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });
      expect(mutationCalls.at(-1)).toEqual({
        args: {
          destination: "Goa",
          endDate: "2026-11-22",
          jobCardId: "",
          staffId: "staff-bina",
          startDate: "2026-11-20",
        },
        reference: "create",
      });
      expect(view.container.querySelector("form")).toBeNull();
      expect(view.container.textContent).toContain("Travel saved.");
      expect(document.activeElement?.textContent).toBe("Add travel");
    } finally {
      await view.unmount();
    }
  });
});
