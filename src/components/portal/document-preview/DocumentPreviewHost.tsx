// biome-ignore-all lint/performance/noJsxPropsBind: viewer controls intentionally close over the active private document.

"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { Input } from "@/components/ui/application-field";
import {
  classifyDocumentPreview,
  DOCUMENT_PREVIEW_EVENT,
  type DocumentPreviewRequest,
  fileNameFromContentDisposition,
  isSensitivePortalFileUrl,
  portalFileDownloadUrl,
  portalFilePreviewUrl,
  requestDocumentPreview,
} from "@/lib/portal/documentPreview";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import {
  isRuntimeBoolean,
  isRuntimeFunction,
  isRuntimeObject,
  isRuntimeString,
} from "@/lib/runtimeValues";
import { DocumentPreviewRenderer, type PreviewViewerController } from "./DocumentPreviewRenderers";

type PreviewLoadState = "closed" | "loading" | "preparing" | "ready" | "unavailable";

interface LoadedDocument {
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

const PREPARING_POLL_MS = 1500;
const PREVIEW_HISTORY_PARAM = "preview";

interface PreviewPayloadJsonObject {
  [key: string]: PreviewPayloadJson;
}

type PreviewPayloadJson =
  | boolean
  | null
  | number
  | PreviewPayloadJsonObject
  | PreviewPayloadJson[]
  | string;

interface PreviewErrorPayload {
  canRetry?: boolean;
  error?: string;
  errorCode?: string;
  status?: string;
}

function previewWarningMessage(code: string) {
  switch (code) {
    case "embedded_content_omitted":
      return "Embedded interactive content was omitted from this preview.";
    case "external_content_omitted":
      return "External content and remote links were not loaded.";
    case "formula_not_recalculated":
      return "Some workbook formulas use their stored results.";
    case "unsupported_content_omitted":
      return "Some unsupported content was omitted from this preview.";
    default:
      return "";
  }
}

function parsePreviewErrorPayload(value: PreviewPayloadJson): PreviewErrorPayload {
  if (!(isRuntimeObject(value) && !Array.isArray(value))) {
    return {};
  }
  return {
    canRetry: isRuntimeBoolean(value.canRetry) ? value.canRetry : undefined,
    error: isRuntimeString(value.error) ? value.error : undefined,
    errorCode: isRuntimeString(value.errorCode) ? value.errorCode : undefined,
    status: isRuntimeString(value.status) ? value.status : undefined,
  };
}

function previewError(status: number, payload?: { error?: string; errorCode?: string }) {
  if (status === 401 || status === 403) {
    return "You no longer have access to preview this file. Close the viewer and refresh your workspace.";
  }
  if (payload?.errorCode === "encrypted") {
    return "This file is encrypted. Preview is unavailable; use Download to open it securely in its original application.";
  }
  if (payload?.errorCode === "corrupt") {
    return "This file appears corrupt, so it cannot be previewed. Download remains available.";
  }
  return payload?.error || "Preview is unavailable for this file. Download remains available.";
}

function clickCanOpenInViewer(event: MouseEvent, anchor: HTMLAnchorElement) {
  return (
    event.button === 0 &&
    !(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) &&
    !anchor.hasAttribute("download") &&
    anchor.pathname.startsWith("/api/portal/files/")
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the host coordinates one explicit viewer state machine and keeps it visible in one place.
export function DocumentPreviewHost() {
  const [request, setRequest] = useState<DocumentPreviewRequest | null>(null);
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);
  const [loadState, setLoadState] = useState<PreviewLoadState>("closed");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [position, setPosition] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [selectionDetail, setSelectionDetail] = useState("");
  const [controller, setController] = useState<PreviewViewerController | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<number | null>(null);

  const close = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setRequest(null);
    setLoaded(null);
    setLoadState("closed");
    setMessage("");
    setWarning("");
    setPosition("");
    setSearchQuery("");
    setActiveSearchQuery("");
    setSearchResult("");
    setSelectionDetail("");
    setController(null);
    setCanRetry(false);
    setRetryNonce(0);
    const location = new URL(window.location.href);
    if (location.searchParams.has(PREVIEW_HISTORY_PARAM)) {
      location.searchParams.delete(PREVIEW_HISTORY_PARAM);
      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}${location.search}${location.hash}`
      );
    }
  }, []);
  const handleRendererError = useCallback((nextMessage: string) => {
    setLoadState("unavailable");
    setMessage(nextMessage);
  }, []);
  const handleWarning = useCallback((nextWarning: string) => {
    if (!nextWarning) {
      return;
    }
    setWarning((current) => {
      if (!current) {
        return nextWarning;
      }
      return current.includes(nextWarning) ? current : `${current} ${nextWarning}`;
    });
  }, []);

  useEffect(() => {
    if (loadState === "unavailable") {
      errorSummaryRef.current?.focus();
    }
  }, [loadState]);

  useEffect(() => {
    const handleRequest = (event: CustomEvent<DocumentPreviewRequest>) => {
      const { detail } = event;
      let sourceUrl: string;
      try {
        sourceUrl = portalFileDownloadUrl(detail.sourceUrl);
      } catch {
        return;
      }
      const historyMode = detail.historyMode ?? "push";
      if (historyMode !== "none") {
        const location = new URL(window.location.href);
        location.searchParams.set(PREVIEW_HISTORY_PARAM, sourceUrl);
        window.history[historyMode === "replace" ? "replaceState" : "pushState"](
          window.history.state,
          "",
          `${location.pathname}${location.search}${location.hash}`
        );
      }
      setLoaded(null);
      setMessage("");
      setWarning("");
      setPosition("");
      setSearchQuery("");
      setActiveSearchQuery("");
      setSearchResult("");
      setSelectionDetail("");
      setController(null);
      setCanRetry(false);
      setRetryNonce(0);
      setRequest({ ...detail, sourceUrl });
      setLoadState("loading");
    };
    const handlePopState = () => {
      const sourceUrl = new URL(window.location.href).searchParams.get(PREVIEW_HISTORY_PARAM);
      if (!sourceUrl) {
        close();
        return;
      }
      try {
        requestDocumentPreview({ historyMode: "none", sourceUrl });
      } catch {
        close();
      }
    };
    const interceptPortalFileLink = (event: MouseEvent) => {
      const { target } = event;
      const anchor = target instanceof Element ? target.closest("a") : null;
      if (!(anchor instanceof window.HTMLAnchorElement && clickCanOpenInViewer(event, anchor))) {
        return;
      }
      event.preventDefault();
      requestDocumentPreview({
        fileName: anchor.getAttribute("download") || anchor.textContent?.trim() || undefined,
        sourceUrl: `${anchor.pathname}${anchor.search}`,
      });
    };
    window.addEventListener(DOCUMENT_PREVIEW_EVENT, handleRequest);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", interceptPortalFileLink, true);
    const linkedSource = new URL(window.location.href).searchParams.get(PREVIEW_HISTORY_PARAM);
    if (linkedSource) {
      try {
        requestDocumentPreview({ historyMode: "none", sourceUrl: linkedSource });
      } catch {
        close();
      }
    }
    return () => {
      window.removeEventListener(DOCUMENT_PREVIEW_EVENT, handleRequest);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", interceptPortalFileLink, true);
    };
  }, [close]);

  useEffect(() => {
    if (!request) {
      return;
    }
    const abortController = new AbortController();
    let disposed = false;
    let shouldRetry = retryNonce > 0;
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: response-state handling is intentionally colocated with the authenticated fetch lifecycle.
    const load = async () => {
      setLoadState((current) => (current === "preparing" ? current : "loading"));
      try {
        const previewUrl = new URL(portalFilePreviewUrl(request.sourceUrl), window.location.origin);
        if (shouldRetry) {
          previewUrl.searchParams.set("retry", "1");
          shouldRetry = false;
        }
        const response = await fetch(`${previewUrl.pathname}${previewUrl.search}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: abortController.signal,
        });
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const payloadJson: PreviewPayloadJson = await response.json();
          const payload = parsePreviewErrorPayload(payloadJson);
          if (!disposed && (response.status === 202 || payload.status === "preparing")) {
            setLoadState("preparing");
            setMessage("Preparing a secure preview…");
            pollTimerRef.current = window.setTimeout(() => {
              pollTimerRef.current = null;
              load().catch(() => undefined);
            }, PREPARING_POLL_MS);
            return;
          }
          if (!disposed) {
            setCanRetry(Boolean(payload.canRetry));
          }
          throw new Error(previewError(response.status, payload));
        }
        if (!response.ok) {
          throw new Error(previewError(response.status));
        }
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 1) {
          throw new Error("The file is empty, so there is nothing to preview.");
        }
        if (!disposed) {
          const responseWarnings = (response.headers.get("X-Document-Preview-Warnings") || "")
            .split(",")
            .map(previewWarningMessage)
            .filter(Boolean)
            .join(" ");
          handleWarning(responseWarnings);
          setLoaded({
            bytes,
            fileName:
              fileNameFromContentDisposition(response.headers.get("Content-Disposition")) ||
              request.fileName ||
              "Document",
            mimeType:
              contentType.split(";", 1)[0] || request.mimeType || "application/octet-stream",
          });
          setLoadState("ready");
          setMessage("Document ready");
          setCanRetry(false);
        }
      } catch (error) {
        if (!(disposed || abortController.signal.aborted)) {
          setLoadState("unavailable");
          setMessage(error instanceof Error ? error.message : previewError(500));
        }
      }
    };
    load().catch(() => undefined);
    return () => {
      disposed = true;
      abortController.abort();
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [handleWarning, request, retryNonce]);

  const kind = loaded ? classifyDocumentPreview(loaded) : "unsupported";
  const objectUrl = useObjectUrl(kind === "image" ? loaded : null);
  const fileName = loaded?.fileName || request?.fileName || "Document";
  const sensitive = request ? isSensitivePortalFileUrl(request.sourceUrl) : false;
  const canSearch = kind === "text" || controller?.supportsSearch;
  const navigation = sensitive ? null : request?.navigation;
  const canGoToPreviousFile = Boolean(navigation && navigation.currentIndex > 0);
  const canGoToNextFile = Boolean(
    navigation && navigation.currentIndex < navigation.items.length - 1
  );

  const navigateFile = (offset: -1 | 1) => {
    if (!navigation) {
      return;
    }
    const currentIndex = navigation.currentIndex + offset;
    const target = navigation.items[currentIndex];
    if (!target) {
      return;
    }
    requestDocumentPreview({
      ...target,
      historyMode: "replace",
      navigation: { ...navigation, currentIndex },
    });
  };

  const runSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      controller?.clearSearch();
      setActiveSearchQuery("");
      setSearchResult("");
      return;
    }
    if (kind === "text" && loaded) {
      setActiveSearchQuery(query);
      const text = new TextDecoder().decode(loaded.bytes).toLocaleLowerCase();
      const needle = query.toLocaleLowerCase();
      let count = 0;
      let offset = text.indexOf(needle);
      while (offset >= 0) {
        count += 1;
        offset = text.indexOf(needle, offset + needle.length);
      }
      setSearchResult(`${count} match${count === 1 ? "" : "es"}`);
      return;
    }
    if (controller) {
      const count = await controller.find(query);
      setSearchResult(`${count} match${count === 1 ? "" : "es"}`);
    }
  };

  return (
    <ControlledDialog
      backdropClassName="absolute inset-0 bg-slate-950/75"
      initialFocus={closeButtonRef}
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      open={request !== null}
      popupClassName="relative flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-950 shadow-2xl max-sm:h-[100dvh] max-sm:w-full max-sm:rounded-none"
      triggerless
      viewportClassName={`fixed inset-0 ${PORTAL_Z.nestedModal} grid place-items-center p-4 max-sm:p-0`}
    >
      {request ? (
        <>
          <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-slate-700 border-b bg-slate-950 px-4 py-3 text-white">
            <div className="min-w-0 flex-1">
              <ControlledDialogTitle className="truncate font-heading font-semibold text-base text-white">
                {fileName}
              </ControlledDialogTitle>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-300 text-xs">
                <span aria-live="polite">{message || "Loading document…"}</span>
                {position ? <span>· {position}</span> : null}
                {sensitive ? <span>· Sensitive document</span> : null}
              </div>
            </div>
            {canSearch ? (
              <form
                className="flex min-w-64 items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  runSearch().catch(() => undefined);
                }}
              >
                <label className="relative min-w-0 flex-1" htmlFor="document-preview-search">
                  <span className="sr-only">Search this document</span>
                  <Search
                    className="pointer-events-none absolute top-3 left-3 text-slate-400"
                    size={16}
                  />
                  <Input
                    className="h-11 w-full rounded-lg border border-slate-600 bg-slate-900 pr-3 pl-9 text-sm text-white placeholder:text-slate-400"
                    id="document-preview-search"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search this document"
                    value={searchQuery}
                  />
                </label>
                <Button
                  className="h-11 min-w-11 bg-white/10 px-3 text-white hover:bg-white/15"
                  type="submit"
                >
                  Find
                </Button>
              </form>
            ) : null}
            {controller ? (
              <fieldset className="flex items-center gap-1">
                <legend className="sr-only">Preview zoom controls</legend>
                <ToolbarButton label="Zoom out" onClick={controller.zoomOut}>
                  <Minus size={17} />
                </ToolbarButton>
                <ToolbarButton label="Fit width" onClick={controller.fitWidth}>
                  <Maximize2 size={17} />
                </ToolbarButton>
                <ToolbarButton label="Zoom in" onClick={controller.zoomIn}>
                  <Plus size={17} />
                </ToolbarButton>
                {controller.rotateClockwise ? (
                  <ToolbarButton label="Rotate clockwise" onClick={controller.rotateClockwise}>
                    <RotateCw size={17} />
                  </ToolbarButton>
                ) : null}
              </fieldset>
            ) : null}
            {navigation && navigation.items.length > 1 ? (
              <fieldset className="flex items-center gap-1">
                <legend className="sr-only">File navigation</legend>
                <Button
                  aria-label="View previous file"
                  className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40"
                  disabled={!canGoToPreviousFile}
                  onClick={() => navigateFile(-1)}
                  type="button"
                >
                  <ChevronLeft size={18} />
                </Button>
                <span className="px-1 text-slate-300 text-xs">
                  {navigation.currentIndex + 1} / {navigation.items.length}
                </span>
                <Button
                  aria-label="View next file"
                  className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40"
                  disabled={!canGoToNextFile}
                  onClick={() => navigateFile(1)}
                  type="button"
                >
                  <ChevronRight size={18} />
                </Button>
              </fieldset>
            ) : null}
            <a
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-600 px-3 font-semibold text-sm text-white hover:bg-white/10"
              download={fileName}
              href={portalFileDownloadUrl(request.sourceUrl)}
            >
              <Download size={16} /> Download
            </a>
            <Button
              aria-label="Close document preview"
              className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"
              onClick={close}
              ref={closeButtonRef}
              type="button"
            >
              <X size={20} />
            </Button>
          </div>
          {warning || searchResult ? (
            <div className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2 border-amber-200 border-b bg-amber-50 px-4 py-2 text-amber-950 text-xs">
              <span>{warning}</span>
              <span aria-live="polite">{searchResult}</span>
              {controller && searchResult ? (
                <span className="flex gap-1">
                  <Button
                    className="h-8 px-2 text-xs"
                    onClick={controller.findPrevious}
                    type="button"
                  >
                    Previous match
                  </Button>
                  <Button className="h-8 px-2 text-xs" onClick={controller.findNext} type="button">
                    Next match
                  </Button>
                </span>
              ) : null}
            </div>
          ) : null}
          {selectionDetail ? (
            <div
              aria-live="polite"
              className="min-h-10 shrink-0 border-slate-300 border-b bg-white px-4 py-2 text-slate-800 text-sm"
            >
              {selectionDetail}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto bg-slate-200">
            {loadState === "loading" || loadState === "preparing" ? (
              <div className="grid h-full min-h-80 place-items-center p-8 text-center">
                <div aria-live="polite" className="text-slate-700">
                  <Loader2 className="mx-auto animate-spin" size={28} />
                  <p className="mt-3 font-semibold">
                    {loadState === "preparing" ? "Preparing secure preview…" : "Loading document…"}
                  </p>
                  <p className="mt-1 text-sm">You can close this viewer and return later.</p>
                </div>
              </div>
            ) : null}
            {loadState === "unavailable" ? (
              <div className="grid h-full min-h-80 place-items-center p-8 text-center">
                <div
                  aria-label="Document preview error"
                  className="max-w-xl outline-none"
                  ref={errorSummaryRef}
                  role="alert"
                  tabIndex={-1}
                >
                  <p className="font-heading font-semibold text-slate-900 text-xl">
                    Preview unavailable
                  </p>
                  <p className="mt-2 text-slate-700 text-sm">{message}</p>
                  {canRetry ? (
                    <Button
                      className="mt-4 min-h-11 rounded-lg bg-citius-blue px-4 font-semibold text-sm text-white"
                      onClick={() => {
                        setCanRetry(false);
                        setLoadState("loading");
                        setMessage("Retrying secure preview…");
                        setRetryNonce((current) => current + 1);
                      }}
                      type="button"
                    >
                      Retry preview
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {loadState === "ready" && loaded ? (
              <DocumentPreviewRenderer
                bytes={loaded.bytes}
                fileName={loaded.fileName}
                kind={kind}
                mimeType={loaded.mimeType}
                objectUrl={objectUrl}
                onController={setController}
                onDetail={setSelectionDetail}
                onError={handleRendererError}
                onPosition={setPosition}
                onWarning={handleWarning}
                searchQuery={activeSearchQuery}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </ControlledDialog>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => Promise<void>;
}) {
  return (
    <Button
      aria-label={label}
      className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"
      onClick={onClick}
      type="button"
    >
      {children}
    </Button>
  );
}

function useObjectUrl(loaded: LoadedDocument | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!(loaded && isRuntimeFunction(URL.createObjectURL))) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([loaded.bytes], { type: loaded.mimeType }));
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [loaded]);
  return objectUrl;
}
