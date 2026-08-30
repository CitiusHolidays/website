// biome-ignore-all lint/performance/noJsxPropsBind: modal handlers intentionally close over the active row and filter state.

"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { FileText, History, Paperclip, RotateCcw, Trash2, X } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useReducer, useRef, useState } from "react";
import { useDocumentPreviewActive } from "@/components/portal/document-preview/DocumentPreviewHost";
import { usePortalConfirm, usePortalConfirmActive } from "@/components/portal/PortalConfirmDialog";
import { formatDate, formatFileSize } from "@/components/portal/PortalModalForm";
import { PortalSearchField } from "@/components/portal/PortalSearchField";
import { usePortalToast } from "@/components/portal/PortalToast";
import { Button } from "@/components/ui/application-button";
import { Checkbox } from "@/components/ui/application-checkbox";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { Input as StaffInput } from "@/components/ui/application-field";
import { Select } from "@/components/ui/application-select";
import { requestDocumentPreview } from "@/lib/portal/documentPreview";
import { portalOverlayMotion } from "@/lib/portal/portalMotion";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { isRuntimeObject, isRuntimeString } from "../../../../lib/runtimeValues";
import { CommercialFileUploadEditor } from "./CommercialFileUploadEditor";
import {
  type CommercialFileCategory,
  type CommercialFileFilters,
  type CommercialFileSourceOption,
  type CommercialFileSourceType,
  type CommercialFileTeamArea,
  commercialFileFilterSignature,
  commercialFileRowsForPage,
  commercialFileSourceKey,
  createCommercialFileViewReducer,
  createCommercialFileViewState,
  resolveCommercialFileUploadSelection,
} from "./commercialFilesModalState";

const EMPTY_FORM = {};
const CAMEL_CASE_BOUNDARY_PATTERN = /([A-Z])/g;
const FIRST_CHARACTER_PATTERN = /^./;
const TEAM_AREA_OPTIONS: Array<{ label: string; value: CommercialFileTeamArea }> = [
  { label: "Sales", value: "sales" },
  { label: "Contracting", value: "contracting" },
  { label: "Ticketing", value: "ticketing" },
  { label: "Accounts", value: "accounts" },
  { label: "Operations", value: "operations" },
  { label: "Tour Manager", value: "tourManager" },
];

interface FormState {
  entityId?: string;
  entryPoint?: CommercialFileSourceType;
  jobCardId?: string;
  proposalId?: string;
  queryId?: string;
}

interface CommercialFileRow {
  attachmentId: string;
  canDelete: boolean;
  canEditNote: boolean;
  canRestore: boolean;
  canRestoreHistory: boolean;
  category: CommercialFileCategory;
  createdAt: number;
  createdBy: string;
  deletedAt?: number;
  fileKind: "attachment" | "proposalDoc";
  fileName: string;
  fileSize: number;
  id: string;
  lifecycle: "active" | "history" | "deleted";
  mimeType: string;
  note?: string;
  readOnly: boolean;
  sourceCode: string;
  sourceId: string;
  sourceLabel: string;
  sourceType: CommercialFileSourceType;
  teamArea: CommercialFileTeamArea;
  teamLabel: string;
  uploaderTeam: string;
}

function sourceIdForForm(form: FormState) {
  return String(form.entityId || form.queryId || form.proposalId || form.jobCardId || "");
}

function nestedOverlayActive(confirmActive: boolean, documentPreviewActive: boolean) {
  return confirmActive || documentPreviewActive;
}

function sourceTypeForForm(form: FormState): CommercialFileSourceType {
  if (form.entryPoint === "proposal" || form.proposalId) {
    return "proposal";
  }
  if (form.entryPoint === "jobCard" || form.jobCardId) {
    return "jobCard";
  }
  return "query";
}

function formatLifecycle(row: CommercialFileRow) {
  if (row.lifecycle === "deleted") {
    return row.deletedAt ? `Deleted ${formatDate(row.deletedAt)}` : "Recoverable deletion";
  }
  if (row.lifecycle === "history") {
    return "Proposal Doc history";
  }
  return `Uploaded ${formatDate(row.createdAt)}`;
}

function commercialFileRowClassName(lifecycle: CommercialFileRow["lifecycle"]) {
  if (lifecycle === "deleted") {
    return "border-amber-200 bg-amber-50/40";
  }
  if (lifecycle === "history") {
    return "border-blue-200 bg-blue-50/40";
  }
  return "border-brand-border bg-white";
}

function commercialFileUrl(fileId: string) {
  let url = `/api/portal/files/commercial/${encodeURIComponent(fileId)}`;
  if (fileId.startsWith("legacy-query:")) {
    url = `/api/portal/files/query/${encodeURIComponent(fileId.slice("legacy-query:".length))}`;
  } else if (fileId.startsWith("legacy-proposal:")) {
    url = `/api/portal/files/proposal/${encodeURIComponent(fileId.slice("legacy-proposal:".length))}`;
  } else if (fileId.startsWith("legacy-proposal-doc:")) {
    url = `/api/portal/files/proposal-finalized/${encodeURIComponent(fileId.slice("legacy-proposal-doc:".length))}`;
  }
  return url;
}

function openFile(row: CommercialFileRow, navigationRows: CommercialFileRow[]) {
  const currentIndex = navigationRows.findIndex((candidate) => candidate.id === row.id);
  requestDocumentPreview({
    fileName: row.fileName,
    mimeType: row.mimeType,
    navigation: {
      currentIndex,
      items: navigationRows.map((candidate) => ({
        fileName: candidate.fileName,
        mimeType: candidate.mimeType,
        sourceUrl: commercialFileUrl(candidate.id),
      })),
    },
    sourceUrl: commercialFileUrl(row.id),
  });
}

function errorMessage(cause: unknown, fallback: string) {
  if (cause && isRuntimeObject(cause)) {
    const data = "data" in cause ? cause.data : undefined;
    const message = "message" in cause ? cause.message : undefined;
    if (isRuntimeString(data)) {
      return data;
    }
    if (isRuntimeString(message)) {
      return message;
    }
  }
  return fallback;
}

function CommercialFileUploadPanel({
  entityId,
  entryPoint,
  sourceOptions,
}: {
  entityId: string;
  entryPoint: CommercialFileSourceType;
  sourceOptions: CommercialFileSourceOption[];
}) {
  const [requestedSourceKey, setRequestedSourceKey] = useState("");
  const [requestedTeamArea, setRequestedTeamArea] = useState<CommercialFileTeamArea | "">("");
  const selection = resolveCommercialFileUploadSelection({
    entityId,
    entryPoint,
    requestedSourceKey,
    requestedTeamArea,
    sourceOptions,
  });

  return (
    <div className="mt-4 rounded-xl border border-citius-blue/20 bg-citius-blue/[0.03] p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Select
          aria-label="Upload source"
          className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
          onValueChange={setRequestedSourceKey}
          options={sourceOptions.map((source) => ({
            label: source.label,
            value: commercialFileSourceKey(source),
          }))}
          value={selection.sourceKey}
        />
        <Select
          aria-label="Upload team area"
          className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
          onValueChange={(value) => {
            const teamArea = selection.source.teamAreas.find((area) => area === value);
            if (teamArea) {
              setRequestedTeamArea(teamArea);
            }
          }}
          options={selection.source.teamAreas.map((area) => ({
            label: area
              .replace(CAMEL_CASE_BOUNDARY_PATTERN, " $1")
              .replace(FIRST_CHARACTER_PATTERN, (letter) => letter.toUpperCase()),
            value: area,
          }))}
          value={selection.teamArea}
        />
      </div>
      <div className="mt-3 border-brand-border border-t pt-3">
        <CommercialFileUploadEditor
          key={`${selection.sourceKey}:${selection.teamArea}`}
          proposalDocAllowed={selection.proposalDocAllowed}
          selectedSource={selection.source}
          selectedTeamArea={selection.teamArea}
        />
      </div>
    </div>
  );
}

function CommercialFileRowCard({
  onDelete,
  onRestore,
  navigationRows,
  row,
}: {
  onDelete: (row: CommercialFileRow) => Promise<boolean>;
  onRestore: (row: CommercialFileRow) => Promise<void>;
  navigationRows: CommercialFileRow[];
  row: CommercialFileRow;
}) {
  const toast = usePortalToast();
  const updateNote = useMutation(api.crm.commercialFiles.updateNote);
  const [editing, setEditing] = useState(false);
  const [editingNote, setEditingNote] = useState(row.note || "");

  const handleNote = async () => {
    try {
      await updateNote({ fileId: row.id, note: editingNote });
      toast.success("File note updated.");
      setEditing(false);
    } catch (noteError) {
      toast.error(errorMessage(noteError, "Unable to update note."));
    }
  };
  const handleDeleteClick = () => onDelete(row);
  const handleRestoreClick = () => onRestore(row);

  return (
    <div className={`rounded-xl border px-4 py-3 ${commercialFileRowClassName(row.lifecycle)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {row.fileKind === "proposalDoc" ? (
            <FileText className="mt-0.5 shrink-0 text-citius-blue" size={16} />
          ) : (
            <Paperclip className="mt-0.5 shrink-0 text-citius-blue" size={16} />
          )}
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-dark">{row.fileName}</div>
            <div className="mt-1 text-brand-muted text-xs">
              {row.category === "proposalDoc" ? "Proposal Doc" : "Working File"} · {row.teamLabel}
              {" · "}
              {formatFileSize(row.fileSize)} · {formatLifecycle(row)}
            </div>
            {editing ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <StaffInput
                  aria-label={`Edit note for ${row.fileName}`}
                  className="h-9 min-w-56 flex-1 rounded-lg border border-brand-border bg-white px-2 text-xs outline-none focus:border-citius-blue"
                  onChange={(event) => setEditingNote(event.target.value)}
                  value={editingNote}
                />
                <Button className="portal-small-btn" onClick={handleNote} type="button">
                  Save note
                </Button>
                <Button
                  className="portal-outline-btn"
                  onClick={() => setEditing(false)}
                  type="button"
                >
                  Cancel
                </Button>
              </div>
            ) : null}
            {!editing && row.note ? (
              <div className="mt-2 whitespace-pre-wrap text-brand-muted text-xs">{row.note}</div>
            ) : null}
            <div className="mt-1 text-brand-muted text-xs">
              Uploaded by {row.uploaderTeam} - {row.createdBy}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {row.lifecycle === "deleted" ? null : (
            <Button
              className="portal-small-btn"
              onClick={() => openFile(row, navigationRows)}
              type="button"
            >
              View
            </Button>
          )}
          {row.canEditNote && !editing ? (
            <Button
              aria-label={`Edit note for ${row.fileName}`}
              className="portal-small-btn"
              onClick={() => {
                setEditingNote(row.note || "");
                setEditing(true);
              }}
              type="button"
            >
              Note
            </Button>
          ) : null}
          {row.canDelete ? (
            <Button
              aria-label={`Delete ${row.fileName}`}
              className="portal-danger-btn"
              onClick={handleDeleteClick}
              type="button"
            >
              <Trash2 size={14} /> Delete
            </Button>
          ) : null}
          {row.canRestore || row.canRestoreHistory ? (
            <Button className="portal-small-btn" onClick={handleRestoreClick} type="button">
              {row.lifecycle === "history" ? (
                <>
                  <History size={14} /> Restore version
                </>
              ) : (
                <>
                  <RotateCcw size={14} /> Restore
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface CommercialFilesModalProps {
  close: () => void;
  form?: FormState;
  modal: string | null;
}

interface CommercialFileGroup {
  items: CommercialFileRow[];
  key: string;
  label: string;
}

function CommercialFileFiltersBar({
  allSourceOptions,
  filters,
  onFilterChange,
}: {
  allSourceOptions: CommercialFileSourceOption[];
  filters: CommercialFileFilters;
  onFilterChange: (
    name: keyof CommercialFileFilters,
    value: CommercialFileFilters[keyof CommercialFileFilters]
  ) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-brand-border bg-brand-light/40 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
      <PortalSearchField
        id="commercial-files-search"
        label="Search Commercial Files"
        onChange={(event) => onFilterChange("search", event.target.value)}
        placeholder="Search files, notes, teams, or sources"
        value={filters.search}
      />
      <Select
        aria-label="File category"
        className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
        onValueChange={(value) => onFilterChange("category", value)}
        options={[
          { label: "All categories", value: "" },
          { label: "Working File", value: "workingFile" },
          { label: "Proposal Doc", value: "proposalDoc" },
        ]}
        value={filters.category}
      />
      <Select
        aria-label="Team area"
        className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
        onValueChange={(value) => onFilterChange("teamArea", value)}
        options={[{ label: "All teams", value: "" }, ...TEAM_AREA_OPTIONS]}
        value={filters.teamArea}
      />
      <Select
        aria-label="File source"
        className="h-11 rounded-xl border border-brand-border bg-white px-3 text-sm"
        onValueChange={(value) => onFilterChange("sourceFilter", value)}
        options={[
          { label: "All sources", value: "" },
          ...allSourceOptions.map((source) => ({
            label: source.label,
            value: commercialFileSourceKey(source),
          })),
        ]}
        value={filters.sourceFilter}
      />
      <Checkbox
        aria-label="Recoverable deletions"
        checked={filters.showDeleted}
        className="flex h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-brand-muted text-xs"
        onCheckedChange={(value) => onFilterChange("showDeleted", value)}
      >
        Recoverable deletions
      </Checkbox>
    </div>
  );
}

function CommercialFileResults({
  groups,
  loaded,
  nextCursor,
  onDelete,
  onLoadMore,
  onRestore,
  rows,
}: {
  groups: CommercialFileGroup[];
  loaded: boolean;
  nextCursor?: string | null;
  onDelete: (row: CommercialFileRow) => Promise<boolean>;
  onLoadMore: () => void;
  onRestore: (row: CommercialFileRow) => Promise<void>;
  rows: CommercialFileRow[];
}) {
  if (!loaded) {
    return <div className="mt-6 text-brand-muted text-sm">Loading Commercial Files…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-brand-border border-dashed px-4 py-8 text-center text-brand-muted text-sm">
        No Commercial Files match this view yet.
      </div>
    );
  }
  const navigationRows = rows.filter((candidate) => candidate.lifecycle !== "deleted");
  return (
    <>
      <div className="mt-6 space-y-5">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="mb-2 font-heading font-semibold text-brand-dark text-sm">
              {group.label}
            </h3>
            <div className="space-y-2">
              {group.items.map((row) => (
                <CommercialFileRowCard
                  key={row.id}
                  navigationRows={navigationRows}
                  onDelete={onDelete}
                  onRestore={onRestore}
                  row={row}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      {nextCursor ? (
        <Button className="portal-outline-btn mt-5 w-full" onClick={onLoadMore} type="button">
          Load more files
        </Button>
      ) : null}
    </>
  );
}

function CommercialFilesModalInstance({
  close,
  form = EMPTY_FORM,
  modal,
}: CommercialFilesModalProps) {
  const open = modal === "commercialFiles";
  const shouldReduceMotion = !!useReducedMotion();
  const backdropMotion = portalOverlayMotion(shouldReduceMotion, "static", 0.15, "snap");
  const panelMotion = portalOverlayMotion(shouldReduceMotion, "center", 0.2, "snap");
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const confirmActive = usePortalConfirmActive();
  const documentPreviewActive = useDocumentPreviewActive();
  const hasNestedOverlay = nestedOverlayActive(confirmActive, documentPreviewActive);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const entryPoint = sourceTypeForForm(form);
  const entityId = sourceIdForForm(form);
  const [view, dispatchView] = useReducer(
    createCommercialFileViewReducer<CommercialFileRow>(entryPoint, entityId),
    createCommercialFileViewState<CommercialFileRow>(entryPoint, entityId)
  );
  const { filters, pager } = view;
  const { category, search, showDeleted, sourceFilter, teamArea } = filters;
  const [rawSourceFilterType, rawSourceFilterId] = sourceFilter.split(":", 2);
  const sourceFilterType: CommercialFileSourceType | undefined =
    rawSourceFilterType === "query" ||
    rawSourceFilterType === "proposal" ||
    rawSourceFilterType === "jobCard"
      ? rawSourceFilterType
      : undefined;
  const sourceFilterId = sourceFilterType ? rawSourceFilterId : undefined;

  const queryArgs =
    open && entityId
      ? {
          category: category || undefined,
          cursor: pager.cursor,
          entityId,
          entryPoint,
          includeDeleted: showDeleted,
          includeHistory: true,
          limit: 25,
          search: search.trim() || undefined,
          sourceId: sourceFilterId || undefined,
          sourceType: sourceFilterType,
          teamArea: teamArea || undefined,
        }
      : "skip";
  const result = useQuery(api.crm.commercialFiles.listForEntryPoint, queryArgs);
  const deleteFile = useMutation(api.crm.commercialFiles.deleteFile);
  const restoreFile = useMutation(api.crm.commercialFiles.restoreFile);
  const restoreProposalHistory = useMutation(api.crm.commercialFiles.restoreProposalHistory);

  const filterSignature = commercialFileFilterSignature(filters, entryPoint, entityId);
  const rows = commercialFileRowsForPage(pager, filterSignature, result?.items ?? []);
  const sourceOptions = result?.writableSources ?? [];
  const allSourceOptions = result?.sourceOptions ?? [];

  const groups = new Map<string, CommercialFileRow[]>();
  for (const row of rows) {
    const key = `${row.teamArea}:${row.sourceType}:${row.sourceId}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const groupedRows = Array.from(groups.entries()).map(([key, items]) => ({
    items,
    key,
    label: `${items[0].teamLabel} · ${items[0].sourceLabel}`,
  }));
  const handleFilterChange = (
    name: keyof CommercialFileFilters,
    value: CommercialFileFilters[keyof CommercialFileFilters]
  ) => dispatchView({ name, type: "setFilter", value });
  const handleLoadMore = () => {
    if (!result?.nextCursor) {
      return;
    }
    dispatchView({
      cursor: result.nextCursor,
      rows,
      signature: filterSignature,
      type: "loadMore",
    });
  };

  const handleDelete = (row: CommercialFileRow) =>
    confirm({
      confirmLabel: "Delete",
      danger: true,
      message: `${row.fileName} will be hidden and recoverable for 14 days.`,
      onConfirm: async () => {
        await deleteFile({ fileId: row.id });
        if (!showDeleted) {
          dispatchView({ id: row.id, type: "hideRow" });
        }
        toast.success("File moved to Recoverable Deletion.");
      },
      title: "Delete commercial file",
    });

  const handleRestore = async (row: CommercialFileRow) => {
    try {
      if (row.lifecycle === "history") {
        await restoreProposalHistory({ fileId: row.id });
      } else {
        await restoreFile({ fileId: row.id });
      }
      toast.success("File restored.");
    } catch (restoreError) {
      toast.error(errorMessage(restoreError, "Unable to restore file."));
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      close();
    }
  };

  return (
    <ControlledDialog
      backdropClassName="absolute inset-0 bg-slate-950/65"
      backdropRender={(props, state) => {
        // SAFETY: Base UI supplies div-compatible backdrop props; its render-prop type omits Motion's ref variance.
        const motionProps = props as React.ComponentProps<typeof m.div>;
        return (
          <m.div
            {...motionProps}
            animate={state.open ? backdropMotion.visible : backdropMotion.hidden}
            initial={backdropMotion.hidden}
            transition={backdropMotion.transition}
          />
        );
      }}
      closeDisabled={hasNestedOverlay}
      escapeDisabled
      initialFocus={closeButtonRef}
      modal={!hasNestedOverlay}
      onOpenChange={handleOpenChange}
      open={open}
      popupClassName="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-2xl max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:!transform-none"
      popupRender={(props, state) => {
        // SAFETY: Base UI supplies div-compatible popup props; its render-prop type omits Motion's ref variance.
        const motionProps = props as React.ComponentProps<typeof m.div>;
        return (
          <m.div
            {...motionProps}
            animate={state.open ? panelMotion.visible : panelMotion.hidden}
            inert={documentPreviewActive ? true : undefined}
            initial={panelMotion.hidden}
            transition={panelMotion.transition}
          />
        );
      }}
      triggerless
      viewportClassName={`fixed inset-0 ${PORTAL_Z.entityModal} grid place-items-center p-4`}
    >
      {open ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-4 border-brand-border border-b px-5 py-4 max-sm:px-4">
            <div>
              <ControlledDialogTitle className="font-heading font-semibold text-citius-blue text-xl">
                Commercial Files
              </ControlledDialogTitle>
              <p className="mt-1 text-brand-muted text-sm">
                Shared working files across this Query, Proposal, and Job Card chain.
              </p>
            </div>
            <Button
              aria-label="Close Commercial Files"
              className="portal-small-btn"
              onClick={close}
              ref={closeButtonRef}
              type="button"
            >
              <X size={15} /> Close
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 max-sm:px-4">
            <CommercialFileFiltersBar
              allSourceOptions={allSourceOptions}
              filters={filters}
              onFilterChange={handleFilterChange}
            />

            {sourceOptions.length > 0 ? (
              <CommercialFileUploadPanel
                entityId={entityId}
                entryPoint={entryPoint}
                key={`${entryPoint}:${entityId}`}
                sourceOptions={sourceOptions}
              />
            ) : (
              <div className="mt-4 rounded-xl border border-brand-border bg-brand-light/40 px-4 py-3 text-brand-muted text-sm">
                You have read-only access to the linked sources. Files can still be viewed or
                downloaded below.
              </div>
            )}

            <CommercialFileResults
              groups={groupedRows}
              loaded={result !== undefined}
              nextCursor={result?.nextCursor}
              onDelete={handleDelete}
              onLoadMore={handleLoadMore}
              onRestore={handleRestore}
              rows={rows}
            />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-brand-border border-t bg-white px-5 py-3 text-brand-muted text-xs max-sm:px-4">
            <span>
              {result?.total ?? 0} file{result?.total === 1 ? "" : "s"} in this view
            </span>
            <Button className="portal-outline-btn" onClick={close} type="button">
              Done
            </Button>
          </div>
        </>
      ) : null}
    </ControlledDialog>
  );
}

export function CommercialFilesModal(props: CommercialFilesModalProps) {
  const form = props.form ?? EMPTY_FORM;
  return (
    <CommercialFilesModalInstance
      {...props}
      key={`${sourceTypeForForm(form)}:${sourceIdForForm(form)}`}
    />
  );
}
