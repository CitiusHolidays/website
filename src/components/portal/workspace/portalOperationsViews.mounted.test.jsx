import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalConfirmProvider } from "@/components/portal/PortalConfirmDialog";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { RoomingListView } from "./operations/RoomingListView";
import { TourManagersView } from "./operations/TourManagersView";
import { TravellersView } from "./operations/TravellersView";
import { VisaTrackingView } from "./operations/VisaTrackingView";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/job-cards",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
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

const noopMutation = async () => undefined;
const noopDelete = async () => undefined;
const noopBulkDelete = async () => true;
const noopHas = () => false;

describe("mounted portal operations views", () => {
  test("Job Cards preserves job code identity and status presentation", async () => {
    mock.module("convex/react", () => ({
      usePaginatedQuery: () => ({ results: [], status: "LoadingFirstPage" }),
    }));
    const { JobCardsView } = await import("./operations/JobCardsView");
    const view = await mount(
      <JobCardsView
        access={{ roles: ["Operations"] }}
        deleteItem={noopDelete}
        has={noopHas}
        openModal={() => undefined}
        removeJobCard={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            id: "jc-1",
            jobCode: "JC-0001-NS",
            status: "Active",
          },
        ]}
        updateJobStatus={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("JC-0001-NS");
    expect(view.container.textContent).toContain("Acme Group");
    expect(view.container.textContent).toContain("Active");

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
        openModal={() => undefined}
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
        openModal={() => undefined}
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
        setJobCardFilter={() => undefined}
      />
    );

    expect(view.container.textContent).toContain("Asha Patel");
    expect(view.container.textContent).toContain("Female");
    expect(view.container.textContent).toContain("Twin");
    expect(view.container.textContent).toContain("Passport expiry");

    await view.unmount();
  });

  test("Visa tracking preserves travel batch labels", async () => {
    const view = await mount(
      <VisaTrackingView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={noopHas}
        openModal={() => undefined}
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
        has={(permission) => permission === P.MANAGE_TRAVELLERS}
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
    const view = await mount(
      <TourManagersView
        assignments={[{ jobCardId: "jc-1", name: "Ravi Tour", travelBatchId: "batch-1" }]}
        canAssign
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={(permission) => permission === P.MANAGE_TOUR_MANAGERS}
        openModal={() => undefined}
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
        updateCallingStatus={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("Calling status board");
    expect(view.container.textContent).toContain("Batch A");
    expect(view.container.textContent).toContain("Awaiting");
    expect(
      [...view.container.querySelectorAll("button")].some((button) => button.textContent === "Done")
    ).toBe(true);

    await view.unmount();
  });

  test("Passport documents preserves scan status and upload action", async () => {
    const { PassportDocumentsView } = await import("./operations/PassportDocumentsView");
    const view = await mount(
      <PassportDocumentsView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        encryptAndStorePassport={noopMutation}
        generateUploadUrl={async () => "https://example.com/upload"}
        getPassportDocument={noopMutation}
        has={(permission) => permission === P.MANAGE_VISA}
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
    const view = await mount(
      <HotelRoomingView
        deleteItem={noopDelete}
        deleteSelected={noopBulkDelete}
        has={noopHas}
        hotels={[]}
        jobCardFilter=""
        jobCards={[]}
        openModal={() => undefined}
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
        setJobCardFilter={() => undefined}
      />
    );

    expect(view.container.textContent).toContain("Rooming Assignments");
    expect(view.container.textContent).toContain("Single");

    const hotelsTab = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Hotels"
    );
    expect(hotelsTab).toBeDefined();
    await act(async () => hotelsTab?.click());
    expect(replaceMock).toHaveBeenCalled();

    await view.unmount();
    mock.restore();
  });
});
