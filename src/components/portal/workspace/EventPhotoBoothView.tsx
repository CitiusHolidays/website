"use client";

import { api } from "@convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import {
  useTrackedPaginatedQuery as usePaginatedQuery,
  useTrackedQuery as useQuery,
} from "@/lib/portal/trackedConvexSubscriptions";
import { EventPhotoBoothEditor } from "./EventPhotoBoothEditor";

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
    { initialNumItems: 25 }
  );
  const saveDraftScenes = useMutation(api.eventPhotoBooth.saveDraftScenes);
  const publishScenes = useMutation(api.eventPhotoBooth.publishScenes);
  const setAvailability = useMutation(api.eventPhotoBooth.setAvailability);
  const setStaffAssignment = useMutation(api.eventPhotoBooth.setStaffAssignment);
  const uploadArtwork = useAction(api.eventPhotoBoothArtwork.uploadArtwork);
  const loadMoreStaff = () => staff.loadMore(25);

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
