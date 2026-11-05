import {
  buildModalInitial,
  getDeepLinkQueryId,
  isDeepLinkDataReady,
  resolveDeepLink,
} from "@/lib/portal/notificationTargets";
import { serializeUrlFilterState } from "@/lib/portal/urlFilterState";

function focusedQueryRows(targetId, detail) {
  if (
    detail.id !== targetId ||
    detail.row === undefined ||
    (detail.row && String(detail.row.id) !== targetId)
  ) {
    return;
  }
  return detail.row ? [detail.row] : [];
}

/** Applies `?open=` / `?id=` notification deep links once required record data is ready. */
export function syncNotificationDeepLink({
  searchParams,
  allowed,
  canFetch,
  queries,
  queryDeepLinkDetail,
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

  // The inbound-leads workspace owns this deep link and loads its own
  // staff-scoped record. Do not route it through the generic entity-modal
  // resolver, which has no public-lead collection and would report a false
  // "record not found" error.
  if (open === "inboundIntent") {
    return;
  }

  const focusedQueryId = getDeepLinkQueryId({ id, open, queryId });
  const queryRows =
    focusedQueryId && queryDeepLinkDetail
      ? focusedQueryRows(focusedQueryId, queryDeepLinkDetail)
      : queries;

  const deepLinkCollections = {
    approvals,
    expenses,
    jobCards,
    leaves,
    proposals,
    queries: queryRows,
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
