"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PortalTabs } from "@/components/portal/PortalTabs";
import { resolveTabId } from "@/lib/portal/portalTabs";
import { HOTEL_ROOMING_TABS } from "../portalOperationsHelpers";
import type { HotelRoomingViewProps } from "../portalViewTypes";
import { Panel } from "../portalWorkspaceListUi";
import { HotelsView } from "./HotelsView";
import { JobCardFilterPanel } from "./JobCardFilterPanel";
import { RoomCountView } from "./RoomCountView";
import { RoomingListView } from "./RoomingListView";

export function HotelRoomingView({
  hotels,
  roomingRows,
  roomCountSummary,
  roomCountPagination,
  filtersActive,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeHotel,
  removeManyHotels,
  removeTraveller,
  removeManyTravellers,
  jobCards,
  jobCardFilter,
  setJobCardFilter,
}: HotelRoomingViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabIds = HOTEL_ROOMING_TABS.map((item: any) => item.id);
  const tab = resolveTabId(tabIds, searchParams.get("tab"), "room-count");

  const setTab = (nextTab: any) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <section>
      <PortalTabs
        ariaLabel="Hotel and rooming tabs"
        items={HOTEL_ROOMING_TABS}
        onValueChange={setTab}
        value={tab}
      >
        {tab === "hotels" ? (
          <Panel
            subtitle="Manual hotel records for ground planning and check-in/out dates."
            title="Hotel Properties"
          >
            <HotelsView
              deleteItem={deleteItem}
              deleteSelected={deleteSelected}
              filtersActive={filtersActive}
              has={has}
              openModal={openModal}
              removeHotel={removeHotel}
              removeManyHotels={removeManyHotels}
              rows={hotels}
            />
          </Panel>
        ) : null}

        {tab === "rooming" ? (
          <Panel
            subtitle="Passenger room types and allocations from traveller master or rooming import."
            title="Rooming Assignments"
          >
            <JobCardFilterPanel
              ariaLabel="Filter rooming by job card"
              jobCardFilter={jobCardFilter}
              jobCards={jobCards}
              setJobCardFilter={setJobCardFilter}
            />
            <RoomingListView
              deleteItem={deleteItem}
              deleteSelected={deleteSelected}
              filtersActive={filtersActive}
              has={has}
              removeManyTravellers={removeManyTravellers}
              removeTraveller={removeTraveller}
              rows={roomingRows}
            />
          </Panel>
        ) : null}

        {tab === "room-count" ? (
          <RoomCountView
            jobCardFilter={jobCardFilter}
            jobCards={jobCards}
            pagination={roomCountPagination}
            setJobCardFilter={setJobCardFilter}
            summary={roomCountSummary}
          />
        ) : null}
      </PortalTabs>
    </section>
  );
}
