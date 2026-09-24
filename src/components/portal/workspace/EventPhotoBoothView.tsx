"use client";

import { useAction, useMutation } from "convex/react";
import { boothApi } from "@/lib/eventPhotoBooth/api";
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
  const state = useQuery(boothApi.getManagementState, allowed && canFetch ? {} : "skip");
  const staff = usePaginatedQuery(
    boothApi.listAssignableStaff,
    allowed && canFetch && state?.canManageAssignments ? {} : "skip",
    { initialNumItems: 25 }
  );
  const saveDraftScenes = useMutation(boothApi.saveDraftScenes);
  const publishScenes = useMutation(boothApi.publishScenes);
  const setAvailability = useMutation(boothApi.setAvailability);
  const setStaffAssignment = useMutation(boothApi.setStaffAssignment);
  const uploadArtwork = useAction(boothApi.uploadArtwork);
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
