"use client";

import { api } from "@convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import {
  useTrackedPaginatedQuery as usePaginatedQuery,
  useTrackedQuery as useQuery,
} from "@/lib/portal/trackedConvexSubscriptions";
import { EventPhotoBoothEditor } from "./EventPhotoBoothEditor";

// The server caps a page at 100. Loading the whole page up front lets "Has access" list
// assigned staff without paging through the directory first.
const STAFF_PAGE_SIZE = 100;

export function EventPhotoBoothView({
  allowed,
  canFetch,
}: {
  allowed: boolean;
  canFetch: boolean;
}) {
  const state = useQuery(api.eventPhotoBooth.getManagementState, allowed && canFetch ? {} : "skip");
  const staff = usePaginatedQuery(
    api.eventPhotoBooth.listAssignableStaff,
    allowed && canFetch && state?.canManageAssignments ? {} : "skip",
    { initialNumItems: STAFF_PAGE_SIZE }
  );
  const saveDraftScenes = useMutation(api.eventPhotoBooth.saveDraftScenes);
  const publishScenes = useMutation(api.eventPhotoBooth.publishScenes);
  const setAvailability = useMutation(api.eventPhotoBooth.setAvailability);
  const setStaffAssignment = useMutation(api.eventPhotoBooth.setStaffAssignment);
  const uploadArtwork = useAction(api.eventPhotoBoothArtwork.uploadArtwork);
  const loadMoreStaff = () => staff.loadMore(STAFF_PAGE_SIZE);

  if (!(allowed && canFetch)) {
    return <p role="status">Event management access is unavailable.</p>;
  }
  if (!state) {
    return <p role="status">Loading event controls…</p>;
  }
  return (
    <EventPhotoBoothEditor
      loadMoreStaff={loadMoreStaff}
      publishScenes={publishScenes}
      saveDraftScenes={saveDraftScenes}
      setAvailability={setAvailability}
      setStaffAssignment={setStaffAssignment}
      staff={staff.results}
      staffStatus={staff.status}
      state={state}
      uploadArtwork={uploadArtwork}
    />
  );
}
