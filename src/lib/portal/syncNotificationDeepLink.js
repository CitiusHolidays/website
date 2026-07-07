import {
  buildModalInitial,
  isDeepLinkDataReady,
  resolveDeepLink,
} from "@/lib/portal/notificationTargets";
import { serializeUrlFilterState } from "@/lib/portal/urlFilterState";

/** Applies `?open=` / `?id=` notification deep links once CRM list data is ready. */
export function syncNotificationDeepLink({
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
  const open = searchParams.get("open");
  const id = searchParams.get("id");
  const queryId = searchParams.get("queryId");
  if (!open) {
    deepLinkHandledRef.current = "";
    return;
  }
  if (!(allowed && canFetch)) {
    return;
  }

  const deepLinkCollections = {
    approvals,
    expenses,
    jobCards,
    leaves,
    proposals,
    queries,
    tickets,
  };

  const signature = `${open}:${id || ""}:${queryId || ""}`;
  if (deepLinkHandledRef.current === signature) {
    return;
  }

  const resolved = resolveDeepLink({ id, open, queryId }, deepLinkCollections);
  if (resolved.status === "none" || resolved.status === "loading") {
    return;
  }

  if (resolved.status === "missing") {
    deepLinkHandledRef.current = signature;
    toast.error("Record not found or you may not have access.");
    const params = serializeUrlFilterState(
      { dateRange, jobCardFilter, listFilters, search },
      listFilterConfig
    );
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", qs ? `${pathname}?${qs}` : pathname);
    return;
  }

  if (!isDeepLinkDataReady(resolved.modal, deepLinkCollections)) {
    return;
  }

  const initial = buildModalInitial(
    resolved.modal,
    { entityId: resolved.entityId, queryId: resolved.queryId },
    deepLinkCollections
  );
  if (!initial) {
    deepLinkHandledRef.current = signature;
    toast.error("Record not found or you may not have access.");
    const params = serializeUrlFilterState(
      { dateRange, jobCardFilter, listFilters, search },
      listFilterConfig
    );
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", qs ? `${pathname}?${qs}` : pathname);
    return;
  }

  deepLinkHandledRef.current = signature;
  openModal(resolved.modal, initial);
}
