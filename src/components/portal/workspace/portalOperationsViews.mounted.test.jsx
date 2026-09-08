import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

let PortalConfirmProvider;
let PortalToastProvider;
let RoomingListView;
let TourManagersView;
let TravellersView;
let VisaTrackingView;

const noop = () => undefined;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal/job-cards",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.ResizeObserver = class {
    observe() {
      // JSDOM has no layout; mounted tests exercise semantic state only.
    }
    disconnect() {
      // The observer test double owns no resources.
    }
  };
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  dom.window.HTMLElement.prototype.scrollIntoView = () => undefined;
  ({ PortalConfirmProvider } = await import("@/components/portal/PortalConfirmDialog"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ RoomingListView } = await import("./operations/RoomingListView"));
  ({ TourManagersView } = await import("./operations/TourManagersView"));
  ({ TravellersView } = await import("./operations/TravellersView"));
  ({ VisaTrackingView } = await import("./operations/VisaTrackingView"));
});

afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalToastProvider>
        <PortalConfirmProvider>{element}</PortalConfirmProvider>
      </PortalToastProvider>
    )
  );
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
}

const noopMutation = async () => undefined;
const noopDelete = async () => undefined;
const noopBulkDelete = async () => true;
const noopHas = () => false;
const manageTravellers = (permission) => permission === P.MANAGE_TRAVELLERS;
const manageTourManagers = (permission) => permission === P.MANAGE_TOUR_MANAGERS;
const manageVisa = (permission) => permission === P.MANAGE_VISA;

describe("Mounted portal operations views", () => {
  test("Travellers do not assert an empty list or zero counts before the first page loads", async () => {
    const view = await mount(
      <TravellersView
        countRows={[]}
        has={noopHas}
        jobCardFilter=""
        jobCards={[]}
        loading
        rows={[]}
      />
    );
    expect(view.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(view.container.textContent).not.toContain("No travellers");
    expect(view.container.textContent).not.toContain("0 loaded");
    await view.unmount();
    const empty = await mount(
      <TravellersView countRows={[]} has={noopHas} jobCardFilter="" jobCards={[]} rows={[]} />
    );
    expect(empty.container.textContent).toContain("No travellers yet.");
    expect(empty.container.textContent).toContain("Traveller counts · 0 loaded");
    await empty.unmount();
  });

  test("Job Cards preserves job code identity and status presentation", async () => {
    mock.module("convex/react", () => ({
      usePaginatedQuery: () => ({ results: [], status: "LoadingFirstPage" }),
      useQuery: () => undefined,
    }));
    const { JobCardsView } = await import("./operations/JobCardsView");
    const view = await mount(
      <JobCardsView
        access={{ roles: ["Operations"] }}
        deleteItem={noopDelete}
        has={noopHas}
        openModal={noop}
        removeJobCard={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            contractingOwnerName: "Cora Contracting",
            id: "jc-1",
            jobCode: "JC-0001-NS",
            lastEditedAt: "2026-07-15",
            lastEditedByName: "Omar Ops",
            operationsOwnerName: "Omar Ops",
            status: "Active",
          },
        ]}
        updateJobStatus={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("JC-0001-NS");
    expect(view.container.textContent).toContain("Acme Group");
    expect(view.container.textContent).toContain("Active");
    const mobileCard = view.container.querySelector(".md\\:hidden");
    expect(mobileCard.textContent).toContain("Cora Contracting");
    expect(mobileCard.textContent).toContain("Last edit");
    const toggleColumn = async (label) => {
      let toggle = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((button) =>
        button.textContent.includes(label)
      );
      if (!toggle) {
        const columnsTrigger = [...view.container.querySelectorAll("button")].find(
          (button) => button.textContent.trim() === "Table options"
        );
        await act(() => {
          columnsTrigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
          columnsTrigger.click();
        });
        await settle();
        toggle = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((button) =>
          button.textContent.includes(label)
        );
      }
      expect(toggle).not.toBeUndefined();
      await act(async () => toggle.click());
      await settle();
    };
    await toggleColumn("Owners");
    await toggleColumn("Last Edit");
    expect(mobileCard.textContent).not.toContain("Cora Contracting");
    expect(mobileCard.textContent).not.toContain("Last edit");

    await view.unmount();
    mock.restore();
  });

  test("Job Cards shows durable deletion progress for running, complete, and failed operations", async () => {
    const { JobCardsView } = await import("./operations/JobCardsView");
    const view = await mount(
      <JobCardsView
        access={{ roles: ["Operations"] }}
        deleteItem={noopDelete}
        has={noopHas}
        jobCardDeletionOperations={[
          {
            deletedCount: 18,
            id: "op-running",
            jobCardId: "jc-1",
            jobCode: "JC-0001-NS",
            lastProgressAt: 1,
            stage: "travellers",
            stageCounts: [{ count: 18, stage: "travellers" }],
            stalled: false,
            startedAt: 1,
            status: "running",
          },
          {
            completedAt: 2,
            deletedCount: 42,
            id: "op-complete",
            jobCardId: "jc-2",
            jobCode: "JC-0002-AB",
            lastProgressAt: 2,
            stage: "complete",
            stageCounts: [],
            stalled: false,
            startedAt: 1,
            status: "complete",
          },
          {
            deletedCount: 7,
            failedAt: 3,
            failureSummary: "Cleanup worker failed",
            id: "op-failed",
            jobCardId: "jc-3",
            jobCode: "JC-0003-CD",
            lastProgressAt: 3,
            stage: "tickets",
            stageCounts: [],
            stalled: false,
            startedAt: 1,
            status: "failed",
          },
          {
            deletedCount: 1,
            id: "op-hidden",
            jobCardId: "jc-4",
            jobCode: "JC-0004-EF",
            lastProgressAt: 4,
            stage: "hotels",
            stageCounts: [],
            stalled: false,
            startedAt: 1,
            status: "running",
          },
        ]}
        openModal={noop}
        removeJobCard={noopMutation}
        rows={[]}
        updateJobStatus={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("continues safely in the background");
    expect(view.container.textContent).toContain("Currently cleaning travellers");
    expect(view.container.textContent).toContain("18 records removed");
    expect(view.container.textContent).toContain("Cleanup for JC-0002-AB finished");
    expect(view.container.textContent).toContain("Cleanup for JC-0003-CD stopped");
    expect(view.container.textContent).toContain("Cleanup worker failed");
    expect(view.container.textContent).toContain("Contact an admin");
    expect(view.container.textContent).not.toContain("JC-0004-EF");

    await view.unmount();
  });

  test("Traveller Master preserves gender, room type, and passport expiry badges", async () => {
    const view = await mount(
      <TravellersView
        countRows={[
          {
            fullName: "Asha Patel",
            gender: "Female",
            id: "trav-1",
            jobCode: "JC-0001-NS",
            roomType: "Twin",
          },
        ]}
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={noopHas}
        jobCardFilter=""
        jobCards={[{ id: "jc-1", jobCode: "JC-0001-NS" }]}
        openModal={noop}
        removeManyTravellers={noopMutation}
        removeTraveller={noopMutation}
        rows={[
          {
            fullName: "Asha Patel",
            gender: "Female",
            id: "trav-1",
            jobCode: "JC-0001-NS",
            passportExpiryDate: "2026-01-01",
            roomType: "Twin",
            travelStartDate: "2026-08-01",
            visaStatus: "Pending",
          },
        ]}
        setJobCardFilter={noop}
      />
    );

    expect(view.container.textContent).toContain("Asha Patel");
    expect(view.container.textContent).toContain("Female");
    expect(view.container.textContent).toContain("Twin");
    expect(view.container.textContent).toContain("Passport expiry");
    const counts = view.container.querySelector("details");
    expect(counts.open).toBe(false);
    expect(counts.querySelector("summary").textContent).toContain("1 loaded");
    expect(view.container.querySelector("table").textContent).toContain("Asha Patel");
    expect(
      view.container.querySelector('[aria-label="Filter passenger count by job card"]')
    ).toBeNull();
    const mobileCard = [...view.container.querySelectorAll(".md\\:hidden")].find(
      (section) => section.textContent.includes("Gender") && section.textContent.includes("Room")
    );
    expect(mobileCard.textContent).toContain("Gender");
    expect(mobileCard.textContent).toContain("Room");
    const toggleColumn = async (label) => {
      let toggle = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((button) =>
        button.textContent.includes(label)
      );
      if (!toggle) {
        const columnsTrigger = [...view.container.querySelectorAll("button")].find(
          (button) => button.textContent.trim() === "Table options"
        );
        await act(() => {
          columnsTrigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
          columnsTrigger.click();
        });
        await settle();
        toggle = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((button) =>
          button.textContent.includes(label)
        );
      }
      expect(toggle).not.toBeUndefined();
      await act(async () => toggle.click());
      await settle();
    };
    await toggleColumn("Gender");
    await toggleColumn("Room");
    expect(mobileCard.textContent).not.toContain("Gender");
    expect(mobileCard.textContent).not.toContain("Room");

    await view.unmount();
  });

  test("Visa tracking preserves travel batch labels", async () => {
    const view = await mount(
      <VisaTrackingView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={noopHas}
        openModal={noop}
        removeManyVisas={noopMutation}
        removeVisa={noopMutation}
        rows={[
          {
            id: "visa-1",
            jobCode: "JC-0001-NS",
            status: "Pending",
            travelBatchReference: "Batch A",
            travellerName: "Asha Patel",
          },
        ]}
      />
    );

    expect(view.container.textContent).toContain("Batch A");
    expect(view.container.textContent).toContain("Asha Patel");

    await view.unmount();
  });

  test("Rooming list preserves portal room type labels", async () => {
    const view = await mount(
      <RoomingListView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={manageTravellers}
        removeManyTravellers={noopMutation}
        removeTraveller={noopMutation}
        rows={[
          {
            foodPreference: "Veg",
            fullName: "Asha Patel",
            hotelAllocation: "Tower A",
            id: "trav-1",
            jobCode: "JC-0001-NS",
            roomType: "Double",
          },
        ]}
      />
    );

    expect(view.container.textContent).toContain("Double");
    expect(view.container.textContent).not.toContain("DBL");

    await view.unmount();
  });

  test("Tour Managers preserves calling board travel batch and status actions", async () => {
    const updateCallingStatus = mock(noopMutation);
    const loadMore = mock(noop);
    const view = await mount(
      <TourManagersView
        assignments={[{ jobCardId: "jc-1", name: "Ravi Tour", travelBatchId: "batch-1" }]}
        canAssign
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={manageTourManagers}
        openModal={noop}
        removeManyTourManagers={noopMutation}
        removeTourManager={noopMutation}
        rows={[
          {
            id: "tm-1",
            jobCode: "JC-0001-NS",
            name: "Ravi Tour",
            status: "Assigned",
          },
        ]}
        travellerPagination={{ canLoadMore: true, loadMore }}
        travellers={[
          {
            callingStatus: "Awaiting",
            fullName: "Asha Patel",
            id: "trav-1",
            jobCardId: "jc-1",
            jobCode: "JC-0001-NS",
            travelBatchReference: "Batch A",
          },
        ]}
        updateCallingStatus={updateCallingStatus}
      />
    );

    expect(view.container.textContent).toContain("Calling status board");
    expect(view.container.textContent).toContain("Batch A");
    expect(view.container.textContent).toContain("Awaiting");
    expect(view.container.querySelector("h2").textContent).toBe("Calling status board");
    expect(view.container.textContent).toContain("1 loaded travellers");
    const doneButton = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Done"
    );
    await act(async () => doneButton.click());
    expect(updateCallingStatus).toHaveBeenCalledWith({
      callingStatus: "Done",
      travellerId: "trav-1",
    });
    const loadMoreButton = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load more records"
    );
    await act(async () => loadMoreButton.click());
    expect(loadMore).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  test("Passport documents preserves scan status and upload action", async () => {
    const { PassportDocumentsView } = await import("./operations/PassportDocumentsView");
    const view = await mount(
      <PassportDocumentsView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        getPassportDocument={noopMutation}
        has={manageVisa}
        removeManyTravellers={noopMutation}
        removePassport={noopMutation}
        removeTraveller={noopMutation}
        travellers={[
          {
            fullName: "Asha Patel",
            hasPassportScan: false,
            id: "trav-1",
            jobCode: "JC-0001-NS",
            passportStatus: "Pending",
          },
        ]}
      />
    );

    expect(view.container.textContent).toContain("Passport Scan Status");
    expect(view.container.textContent).toContain("Pending");
    expect(
      [...view.container.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("Upload")
      )
    ).toBe(true);

    await view.unmount();
  });

  test("Hotel rooming tabs honor URL tab state", async () => {
    const replaceMock = mock(() => undefined);
    const searchParams = new URLSearchParams("tab=rooming");

    mock.module("next/navigation", () => ({
      useRouter: () => ({ replace: replaceMock }),
      useSearchParams: () => searchParams,
    }));

    const { HotelRoomingView } = await import("./operations/HotelRoomingView");
    const element = (
      <HotelRoomingView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={noopHas}
        hotels={[]}
        jobCardFilter=""
        jobCards={[]}
        openModal={noop}
        removeHotel={noopMutation}
        removeManyHotels={noopMutation}
        removeManyTravellers={noopMutation}
        removeTraveller={noopMutation}
        roomingRows={[
          {
            fullName: "Asha Patel",
            id: "trav-1",
            jobCode: "JC-0001-NS",
            roomType: "Single",
          },
        ]}
        setJobCardFilter={noop}
      />
    );
    const view = await mount(element);

    expect(view.container.textContent).toContain("Rooming Assignments");
    expect(view.container.textContent).toContain("Single");
    expect(view.container.querySelectorAll('[role="combobox"]')).toHaveLength(1);

    const hotelsTab = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Hotels"
    );
    expect(hotelsTab).toBeDefined();
    await act(async () => hotelsTab?.click());
    expect(replaceMock).toHaveBeenCalled();

    await view.unmount();
    searchParams.set("tab", "hotels");
    const hotelsView = await mount(element);
    expect(hotelsView.container.textContent).toContain("Hotel Properties");
    expect(hotelsView.container.querySelectorAll('[role="combobox"]')).toHaveLength(1);
    await hotelsView.unmount();
    searchParams.delete("tab");
    const defaultView = await mount(element);
    expect(defaultView.container.textContent).toContain("Rooming Assignments");
    await defaultView.unmount();
    mock.restore();
  });

  test("Tour Manager loading does not assert empty calling work or zero counts", async () => {
    const view = await mount(
      <TourManagersView
        assignments={[]}
        canAssign={false}
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={noopHas}
        openModal={noop}
        removeManyTourManagers={noopMutation}
        removeTourManager={noopMutation}
        rows={[]}
        updateCallingStatus={noopMutation}
      />
    );
    expect(view.container.textContent).toContain("Loading travellers");
    expect(view.container.textContent).not.toContain("No travellers to call");
    expect(view.container.textContent).not.toContain("Onboarded");
    expect(view.container.querySelectorAll("dd")).toHaveLength(0);
    await view.unmount();
    const readOnly = await mount(
      <TourManagersView
        assignments={[]}
        canAssign={false}
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={noopHas}
        openModal={noop}
        removeManyTourManagers={noopMutation}
        removeTourManager={noopMutation}
        rows={[]}
        travellers={[
          { callingStatus: "Awaiting", fullName: "Asha Patel", id: "trav-1", jobCardId: "jc-1" },
        ]}
        updateCallingStatus={noopMutation}
      />
    );
    expect(readOnly.container.textContent).toContain("Asha Patel");
    expect(readOnly.container.textContent).toContain("No loaded assignment");
    expect(
      [...readOnly.container.querySelectorAll("button")].some(
        (button) => button.textContent === "Done"
      )
    ).toBe(false);
    expect(readOnly.container.querySelector('button[aria-label^="Delete"]')).toBeNull();
    await readOnly.unmount();
  });

  test("Room Count distinguishes preparing aggregates from scoped complete counts", async () => {
    const { RoomCountView } = await import("./operations/RoomCountView");
    const preparing = await mount(
      <>
        <RoomCountView jobCardFilter="" jobCards={[]} />
        <RoomCountView
          jobCardFilter=""
          jobCards={[]}
          summary={{ complete: false, roomTypes: [], totalAssignments: 0 }}
        />
      </>
    );
    expect(preparing.container.querySelectorAll('[role="status"]')).toHaveLength(2);
    expect(preparing.container.textContent).toContain("Room counts are preparing");
    expect(preparing.container.textContent).not.toContain("No rooming rows");
    expect(preparing.container.querySelectorAll("dd")).toHaveLength(0);
    await preparing.unmount();
    const loadMore = mock(noop);
    const view = await mount(
      <RoomCountView
        jobCardFilter=""
        jobCards={[]}
        pagination={{ canLoadMore: true, loadMore }}
        summary={{
          breakdownComplete: false,
          complete: true,
          roomTypes: [{ assignments: 4, roomType: "Twin" }],
          scope: "visible-job-page",
          totalAssignments: 4,
        }}
      />
    );
    expect(view.container.textContent).toContain("Loaded Job Card rooming rows");
    expect([...view.container.querySelectorAll("dd")].map((node) => node.textContent)).toEqual([
      "4",
      "2",
    ]);
    await act(async () =>
      [...view.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Load more Job Cards")
        .click()
    );
    expect(loadMore).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  test("Team mobile cards keep identity visible and contact roles in a native disclosure", async () => {
    const { TeamView } = await import("./admin/TeamView");
    const view = await mount(
      <TeamView
        rows={[
          {
            department: "Operations",
            email: "ravi@example.com",
            id: "staff-1",
            mobile: "555-0100",
            name: "Ravi Tour",
            roles: ["Tour Manager"],
          },
        ]}
      />
    );
    const card = view.container.querySelector(".md\\:hidden");
    expect(card.textContent).toContain("Ravi Tour");
    expect(card.textContent).toContain("ravi@example.com");
    const details = card.querySelector("details");
    expect(details.open).toBe(false);
    expect(details.textContent).toContain("Tour Manager");
    await act(async () => details.querySelector("summary").click());
    expect(details.open).toBe(true);
    expect(details.textContent).toContain("555-0100");
    expect(card.querySelector("button")).toBeNull();
    await view.unmount();
  });
});

describe("Job Card tasks and Accounts creation", () => {
  const operationsOwner = { kind: "staff", label: "Omar Ops", staffId: "staff-ops" };
  const financeOwner = { kind: "role", label: "Finance", staffId: null };
  const commandCenterPayload = {
    actions: [
      {
        href: "/portal/tickets?jc=jc-1",
        id: "tickets",
        label: "Continue ticketing",
        owner: operationsOwner,
        sectionKey: "tickets",
        status: "available",
      },
      {
        href: null,
        id: "finance",
        label: "Review payment readiness",
        owner: financeOwner,
        sectionKey: "finance",
        status: "owned_elsewhere",
      },
      {
        href: "/portal/job-cards/jc-1#checklist-tasks",
        id: "checklist",
        label: "Review checklist tasks",
        owner: operationsOwner,
        sectionKey: "checklist",
        status: "available",
      },
    ],
    blockers: [
      { key: "tickets", label: "Ticket issuance incomplete", severity: "critical" },
      { key: "tickets", label: "The ticket snapshot is incomplete", severity: "warning" },
      { key: "finance", label: "Finance/payment incomplete", severity: "critical" },
      { key: "checklist", label: "Checklist tasks incomplete", severity: "warning" },
    ],
    checklistTasks: [
      {
        _id: "task-1",
        category: "Handover",
        completed: false,
        dueDate: "2026-09-10",
        ownerRole: "Operations",
        title: "Confirm traveller briefing",
      },
    ],
    commercialFiles: [
      {
        attachmentId: "query-file",
        fileKind: "attachment",
        fileName: "travel-notes.txt",
        fileSize: 128,
        mimeType: "text/plain",
        sourceId: "query-1",
        sourceLabel: "Sales",
        sourceType: "query",
      },
      {
        attachmentId: "proposal-file",
        fileKind: "attachment",
        fileName: "itinerary.txt",
        fileSize: 256,
        mimeType: "text/plain",
        sourceId: "proposal-1",
        sourceLabel: "Contracting",
        sourceType: "proposal",
      },
      {
        attachmentId: "proposal-doc",
        fileKind: "proposalDoc",
        fileName: "confirmed-offer.pdf",
        fileSize: 512,
        mimeType: "application/pdf",
        sourceId: "proposal-1",
        sourceLabel: "Contracting",
        sourceType: "proposal",
      },
    ],
    jobCard: {
      clientName: "Acme Group",
      confirmedPax: 2,
      contractingOwnerName: "Cora Contracting",
      destination: "Ladakh",
      jobCode: "JC-0001-NS",
      roomCount: 1,
      status: "In Operations",
      travelEndDate: "2026-09-15",
      travelStartDate: "2026-09-12",
    },
    money: { exact: null, readiness: "review_required" },
    openingEvidence: {
      authority: { proposalRevision: 3 },
      commercial: null,
      current: { variances: [{ currentValue: "2", field: "confirmedPax", openingValue: "3" }] },
      effective: { confirmedPax: 3, destination: "Ladakh" },
      openedAt: 1_788_800_000_000,
      status: "recorded",
      variances: [
        {
          field: "confirmedPax",
          fromValue: "4",
          reason: "One traveller cancelled before opening",
          toValue: "3",
        },
      ],
      version: 1,
    },
    proposal: {
      itinerarySummary: "Leh and Nubra itinerary",
      proposalCode: "P-0001",
      status: "With Sales",
    },
    query: { queryCode: "Q-0001", salesStatus: "Order Confirmed" },
    readiness: [
      {
        complete: true,
        coverage: "complete",
        done: 2,
        key: "travellers",
        label: "Traveller master",
        owner: operationsOwner,
        percent: 100,
        total: 2,
      },
      {
        complete: false,
        coverage: "partial",
        done: 1,
        key: "tickets",
        label: "Tickets",
        owner: operationsOwner,
        percent: 0,
        total: 2,
      },
      {
        complete: false,
        coverage: "complete",
        done: 0,
        key: "finance",
        label: "Finance/payment",
        owner: financeOwner,
        percent: 0,
        total: 1,
      },
      {
        complete: false,
        coverage: "complete",
        done: 0,
        key: "checklist",
        label: "Checklist tasks",
        owner: operationsOwner,
        percent: 0,
        total: 1,
      },
    ],
  };

  async function mountCommandCenter(payload = commandCenterPayload) {
    mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
      useTrackedQuery: () => payload,
    }));
    const { default: Page } = await import("@/app/portal/job-cards/[jobCardId]/page");
    const page = Page({ params: Promise.resolve({ jobCardId: "jc-1" }) });
    const content = page.props.children.props.children;
    return mount(await content.type(content.props));
  }

  test("Keeps one identity and task surface with distinct blockers, counts, owners and authorized actions", async () => {
    window.history.replaceState(null, "", "/portal/job-cards/jc-1#checklist-tasks");
    const view = await mountCommandCenter();
    expect(
      [...view.container.querySelectorAll("h1")].map((heading) => heading.textContent)
    ).toEqual(["JC-0001-NS"]);
    const tasks = view.container.querySelector('section[aria-labelledby="job-card-tasks-heading"]');
    const labels = [...tasks.querySelectorAll("h3")].map((heading) => heading.textContent);
    expect(labels).toEqual(["Tickets", "Finance/payment", "Checklist tasks", "Traveller master"]);
    for (const blocker of commandCenterPayload.blockers) {
      expect(tasks.textContent.split(blocker.label)).toHaveLength(2);
    }
    expect(tasks.textContent).toContain("1 / 2 · Partial snapshot");
    expect(tasks.textContent).toContain("Complete · 2 / 2");
    expect(tasks.textContent).toContain("Owner: Omar Ops");
    expect(tasks.textContent).toContain("Payment needs Finance review");
    expect(tasks.querySelector('a[href="/portal/tickets?jc=jc-1"]')?.textContent).toBe(
      "Continue ticketing"
    );
    expect(tasks.querySelector('a[href^="/portal/finance"]')).toBeNull();
    expect(view.container.textContent).not.toContain("Finance opening values");
    expect(
      [...view.container.querySelectorAll("summary")].some(
        (summary) => summary.textContent === "Finance detail"
      )
    ).toBe(false);
    const checklist = view.container.querySelector("#checklist-tasks");
    expect(checklist.open).toBe(true);
    expect(checklist.textContent).toContain("Confirm traveller briefing");
    expect(checklist.textContent).toContain("Pending · Handover · Due");
    expect(checklist.textContent).toContain("Owner: Operations");
    const evidence = [...view.container.querySelectorAll("details")].find((details) =>
      details.firstElementChild.textContent.startsWith("Opening evidence")
    );
    expect(evidence.open).toBe(false);
    await act(async () => evidence.querySelector("summary").click());
    expect(evidence.open).toBe(true);
    expect(evidence.textContent).toContain("Immutable snapshot v1 · Proposal revision 3");
    expect(evidence.textContent).toContain("4 → 3 · One traveller cancelled before opening");
    expect(evidence.textContent).toContain("3 → 2");
    await view.unmount();
  });

  test("Direct Job Card View opens the shared preview and restores the exact originating control", async () => {
    window.history.replaceState(null, "", "/portal/job-cards/jc-1?panel=files");
    const requestedUrls = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (url) => {
      requestedUrls.push(url);
      return Promise.resolve(
        new Response("Day 1: Leh", { headers: { "Content-Type": "text/plain" }, status: 200 })
      );
    };
    const view = await mountCommandCenter();
    const files = [...view.container.querySelectorAll("details")].find(
      (details) => details.firstElementChild.textContent === "Commercial context and files"
    );
    expect(files.open).toBe(false);
    await act(async () => files.querySelector("summary").click());
    const opener = files.querySelector('button[aria-label="View travel-notes.txt"]');
    opener.focus();
    await act(async () => opener.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(requestedUrls).toEqual(["/api/portal/files/query/query-file?mode=preview"]);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    const preview = document.querySelector('[role="dialog"]');
    expect(preview.textContent).toContain("Day 1: Leh");
    await act(async () => preview.querySelector('button[aria-label="View next file"]').click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(requestedUrls).toEqual([
      "/api/portal/files/query/query-file?mode=preview",
      "/api/portal/files/proposal/proposal-file?mode=preview",
    ]);
    expect(preview.querySelector('a[download="itinerary.txt"]').getAttribute("href")).toBe(
      "/api/portal/files/proposal/proposal-file"
    );
    await act(async () =>
      preview.querySelector('button[aria-label="Close document preview"]').click()
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(files.open).toBe(true);
    expect(window.location.pathname + window.location.search).toBe(
      "/portal/job-cards/jc-1?panel=files"
    );
    expect(files.querySelector('a[download="confirmed-offer.pdf"]').getAttribute("href")).toBe(
      "/api/portal/files/proposal-finalized/proposal-1"
    );
    expect(files.querySelector('a[download="itinerary.txt"]').getAttribute("href")).toBe(
      "/api/portal/files/proposal/proposal-file"
    );
    const download = files.querySelector('a[download="travel-notes.txt"]');
    download.addEventListener("click", (event) => event.preventDefault());
    await act(async () => download.click());
    expect(requestedUrls).toEqual([
      "/api/portal/files/query/query-file?mode=preview",
      "/api/portal/files/proposal/proposal-file?mode=preview",
    ]);
    await view.unmount();
    globalThis.fetch = previousFetch;
  });

  test("Older command payloads retain truthful owner fallback and authorized Finance detail", async () => {
    const view = await mountCommandCenter({
      ...commandCenterPayload,
      actions: [
        { ...commandCenterPayload.actions[0], href: null, status: "owned_elsewhere" },
        {
          ...commandCenterPayload.actions[1],
          href: "/portal/finance?jc=jc-1",
          status: "available",
        },
        commandCenterPayload.actions[2],
      ],
      money: {
        exact: {
          invoices: [
            {
              balanceAmount: 25,
              expectedAmount: 100,
              id: "invoice-1",
              invoiceNumber: "INV-001",
              receivedAmount: 75,
              status: "Part Paid",
            },
          ],
          truncated: true,
        },
        readiness: "partially_outstanding",
      },
      readiness: commandCenterPayload.readiness.map(({ owner: _owner, ...section }) => section),
    });
    expect(view.container.textContent).toContain("Owner: Not recorded");
    expect(view.container.textContent).toContain("Owner: Omar Ops");
    expect(view.container.querySelector('a[href^="/portal/tickets"]')).toBeNull();
    expect(view.container.querySelector('a[href="/portal/finance?jc=jc-1"]')?.textContent).toBe(
      "Review payment readiness"
    );
    const finance = [...view.container.querySelectorAll("details")].find(
      (details) => details.firstElementChild.textContent === "Finance detail"
    );
    expect(finance.open).toBe(false);
    await act(async () => finance.querySelector("summary").click());
    expect(finance.textContent).toContain("INV-001 · Part Paid");
    expect(finance.textContent).toContain("Expected 100 · received 75 · balance 25");
    expect(finance.textContent).toContain("More rows exist");
    await view.unmount();
  });

  test("Accounts creation precedes administration and retains creation permission and query identity", async () => {
    const { AccountsJobCardView } = await import("./accounts/AccountsJobCardView");
    const openModal = mock(noop);
    const props = {
      creators: [],
      jobCards: [],
      openModal,
      rows: [
        {
          clientName: "Acme Group",
          destination: "Ladakh",
          id: "query-1",
          paxCount: 2,
          queryCode: "Q-0001",
          queryType: "MICE",
          salesStatus: "Order Confirmed",
          travelEndDate: "2026-09-15",
          travelStartDate: "2026-09-12",
        },
      ],
      setJobCardCreatorAccess: noopMutation,
    };
    const loading = await mount(
      <AccountsJobCardView {...props} access={{ roles: ["Accounts"] }} creatorsLoading loading />
    );
    expect(loading.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(loading.container.textContent).not.toContain("No confirmed orders");
    expect(loading.container.textContent).not.toContain("Open JC");
    expect(loading.container.textContent).not.toContain("No Accounts staff");
    await loading.unmount();
    const view = await mount(<AccountsJobCardView {...props} access={{ roles: ["Accounts"] }} />);
    const content = view.container.textContent;
    expect(content.indexOf("Q-0001")).toBeLessThan(content.indexOf("Job Card creators"));
    expect(content.indexOf("Q-0001")).toBeLessThan(content.indexOf("Payment terms reference"));
    const create = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Open JC"
    );
    await act(async () => create.click());
    expect(openModal).toHaveBeenCalledWith(
      "jobCard",
      expect.objectContaining({ confirmedPax: "2", queryId: "query-1" })
    );
    await view.unmount();
    const readOnly = await mount(
      <AccountsJobCardView {...props} access={{ roles: ["Finance"] }} />
    );
    expect(readOnly.container.textContent).toContain("View only");
    expect(
      [...readOnly.container.querySelectorAll("button")].some(
        (button) => button.textContent === "Open JC"
      )
    ).toBe(false);
    await readOnly.unmount();
  });
});
