"use client";

import { useEffect } from "react";
import { syncNotificationDeepLink } from "@/lib/portal/syncNotificationDeepLink";

/** Runs notification `?open=` deep links after portal workspace data is available. */
export function usePortalNotificationDeepLink({
  searchParams,
  allowed,
  canFetch,
  queries,
  proposals,
  jobCards,
  tickets,
  leaves,
  expenses,
  approvals,
  deepLinkHandledRef,
  openModal,
  toast,
  pathname,
  search,
  dateRange,
  jobCardFilter,
  listFilters,
  listFilterConfig,
}) {
  useEffect(() => {
    syncNotificationDeepLink({
      allowed,
      approvals,
      canFetch,
      dateRange,
      deepLinkHandledRef,
      expenses,
      jobCardFilter,
      jobCards,
      leaves,
      listFilterConfig,
      listFilters,
      openModal,
      pathname,
      proposals,
      queries,
      search,
      searchParams,
      tickets,
      toast,
    });
  }, [
    searchParams,
    allowed,
    canFetch,
    queries,
    proposals,
    jobCards,
    tickets,
    leaves,
    expenses,
    approvals,
    deepLinkHandledRef,
    openModal,
    toast,
    pathname,
    search,
    dateRange,
    jobCardFilter,
    listFilters,
    listFilterConfig,
  ]);
}
