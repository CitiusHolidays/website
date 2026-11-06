import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/external-tour-managers",
});

interface AppAccess {
  onboarding: "not_started" | "pending" | "ready";
  status: "none" | "enabled" | "disabled";
}
interface SetAppAccessArgs {
  enabled: boolean;
  profileId: string;
}
interface CreateAssignmentArgs {
  externalProfileId: string;
  jobCardId: string;
  name: string;
  travelBatchId?: string;
}
const mutationCalls: { args: SetAppAccessArgs | CreateAssignmentArgs; reference: string }[] = [];
const JOBS = [
  {
    canCompose: false,
    clientName: "Synthetic group",
    destination: "Bali",
    jobCardId: "jc-1",
    jobCode: "JC-1",
  },
];
const SERIES = [
  { batchCode: "B01", batchReference: "JC-1 / B01", id: "batch-a", travelStartDate: "" },
  { batchCode: "B02", batchReference: "JC-1 / B02", id: "batch-b", travelStartDate: "" },
];
let canManage = true;
let appAccess: AppAccess = { onboarding: "not_started", status: "none" };
let email = "meera.external@example.test";

function profile() {
  return {
    active: true,
    appAccess,
    canManage,
    createdAt: 1,
    destinations: ["Bali"],
    email,
    experienceSummary: "",
    experienceYears: null,
    id: "profile-meera",
    name: "Meera Iyer",
    phone: "",
    reportedPastTours: null,
    reportedPastToursNote: "",
    reportedPastToursSource: "staff_recorded",
    updatedAt: 1,
  };
}

mock.module("@convex/_generated/api", () => ({
  api: {
    crm: {
      externalTourManagerProfiles: {
        create: "create",
        get: "get",
        getAccess: "getAccess",
        list: "list",
        listAssignments: "listAssignments",
        setAppAccess: "setAppAccess",
        update: "update",
      },
      jobCards: { listTravelBatches: "listTravelBatches" },
      ops: { createTourManager: "createTourManager", listTourManagers: "listTourManagers" },
      postTourFeedback: { listJobs: "listJobs" },
    },
  },
}));
mock.module("convex/react", () => ({
  useMutation: (reference: string) => (args: SetAppAccessArgs | CreateAssignmentArgs) => {
    mutationCalls.push({ args, reference });
    return Promise.resolve(null);
  },
  usePaginatedQuery: (
    reference: string,
    args: { includeInactive?: boolean; jobCardId?: string; profileId?: string } | "skip"
  ) => {
    let results: readonly object[] = [];
    if (reference === "list") {
      results = [profile()];
    } else if (reference === "listJobs") {
      results = JOBS;
    } else if (reference === "listTravelBatches" && args !== "skip") {
      results = SERIES;
    }
    return { loadMore: () => undefined, results, status: "Exhausted" };
  },
  useQuery: (reference: string) => {
    if (reference === "getAccess") {
      return { canManage };
    }
    return reference === "get" ? profile() : undefined;
  },
}));

let Workspace: typeof import("./ExternalTourManagersWorkspace").default;
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
  ({ default: Workspace } = await import("./ExternalTourManagersWorkspace"));
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});
afterEach(() => {
  mutationCalls.length = 0;
  canManage = true;
  appAccess = { onboarding: "not_started", status: "none" };
  email = "meera.external@example.test";
  document.body.replaceChildren();
});

async function setValue(element: HTMLSelectElement, value: string) {
  await act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value")?.set?.call(
      element,
      value
    );
    element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
}

async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Workspace />));
  const accessSwitch = () => container.querySelector<HTMLButtonElement>('[role="switch"]');
  const button = (name: string) => {
    const match = [...container.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === name
    );
    if (!match) {
      throw new Error(`Missing button: ${name}`);
    }
    return match;
  };
  return {
    accessSwitch,
    button,
    click: (target: HTMLButtonElement) => act(async () => target.click()),
    container,
    unmount: () => act(async () => root.unmount()),
  };
}

describe("App and CRM access on an external tour manager profile", () => {
  test("is off by default and turning it on grants access from the profile", async () => {
    const view = await mount();
    try {
      const toggle = view.accessSwitch();
      expect(toggle?.getAttribute("aria-checked")).toBe("false");
      expect(view.container.textContent).toContain("cannot sign in to the app or the CRM");
      if (!toggle) {
        throw new Error("Missing access switch");
      }
      await view.click(toggle);
      expect(mutationCalls).toEqual([
        { args: { enabled: true, profileId: "profile-meera" }, reference: "setAppAccess" },
      ]);
    } finally {
      await view.unmount();
    }
  });

  test("turning it off asks first, then switches it off", async () => {
    appAccess = { onboarding: "ready", status: "enabled" };
    const view = await mount();
    try {
      const toggle = view.accessSwitch();
      expect(toggle?.getAttribute("aria-checked")).toBe("true");
      expect(view.container.textContent).toContain("see only the Job Cards they are assigned to");
      if (!toggle) {
        throw new Error("Missing access switch");
      }
      await view.click(toggle);
      expect(mutationCalls).toEqual([]);
      await view.click(view.button("Keep access"));
      expect(mutationCalls).toEqual([]);
      await view.click(toggle);
      await view.click(view.button("Turn off access"));
      expect(mutationCalls).toEqual([
        { args: { enabled: false, profileId: "profile-meera" }, reference: "setAppAccess" },
      ]);
    } finally {
      await view.unmount();
    }
  });

  test("offers a resend while setup is pending and needs an email to start", async () => {
    appAccess = { onboarding: "pending", status: "enabled" };
    const pending = await mount();
    try {
      await pending.click(pending.button("Resend setup email"));
      expect(mutationCalls.at(-1)?.args).toEqual({ enabled: true, profileId: "profile-meera" });
    } finally {
      await pending.unmount();
    }
    appAccess = { onboarding: "not_started", status: "none" };
    email = "";
    const noEmail = await mount();
    try {
      expect(noEmail.accessSwitch()?.disabled).toBe(true);
      expect(noEmail.container.textContent).toContain("Add an email to the profile first");
    } finally {
      await noEmail.unmount();
    }
  });

  test("assigning to a Job Card in series requires choosing the series", async () => {
    const view = await mount();
    try {
      const selects = () => [...view.container.querySelectorAll("select")];
      const jobSelect = selects().find((item) => item.textContent?.includes("Choose a Job Card"));
      if (!jobSelect) {
        throw new Error("Missing Job Card select");
      }
      await setValue(jobSelect, "jc-1");
      const seriesSelect = selects().find((item) =>
        item.textContent?.includes("Choose the series they lead")
      );
      expect(seriesSelect?.required).toBe(true);
      if (!seriesSelect) {
        throw new Error("Missing series select");
      }
      await setValue(seriesSelect, "batch-b");
      const form = jobSelect.closest("form");
      await act(() => {
        form?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      });
      expect(mutationCalls).toEqual([
        {
          args: {
            externalProfileId: "profile-meera",
            jobCardId: "jc-1",
            name: "Meera Iyer",
            travelBatchId: "batch-b",
          },
          reference: "createTourManager",
        },
      ]);
    } finally {
      await view.unmount();
    }
  });

  test("is hidden from people who can only read profiles", async () => {
    canManage = false;
    const view = await mount();
    try {
      expect(view.accessSwitch()).toBeNull();
      expect(view.container.textContent).not.toContain("App and CRM access");
    } finally {
      await view.unmount();
    }
  });
});
