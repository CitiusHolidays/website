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
