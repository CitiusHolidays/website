// biome-ignore-all lint/performance/noJsxPropsBind: document controls intentionally close over the active renderer instance.

"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { DocumentPreviewKind } from "@/lib/portal/documentPreview";
import { assertSafePdfPreviewInWorker } from "@/lib/portal/pdfPreviewSafetyWorkerClient";
import {
  findPdfSearchMatches,
  type PdfSearchMatch,
  type PdfSearchTextItem,
  stepPdfSearchMatch,
} from "@/lib/portal/pdfSearch";
import type { SpreadsheetFormulaStatus } from "@/lib/portal/spreadsheetPreview";
import { prepareSpreadsheetPreviewInWorker } from "@/lib/portal/spreadsheetPreviewWorkerClient";

export interface PreviewViewerController {
  clearSearch: () => void;
  find: (query: string) => Promise<PreviewSearchResult>;
  findNext: () => Promise<PreviewSearchResult>;
  findPrevious: () => Promise<PreviewSearchResult>;
  fitPage: () => Promise<void>;
  fitWidth: () => Promise<void>;
  rotateClockwise?: () => Promise<void>;
  supportsSearch: boolean;
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
}

export interface PreviewSearchResult {
  current: number;
  total: number;
}

interface DocumentPreviewRendererProps {
  bytes: ArrayBuffer;
  fileName: string;
  kind: DocumentPreviewKind;
  mimeType: string;
  objectUrl: string | null;
  onController: (controller: PreviewViewerController | null) => void;
  onDetail: (message: string) => void;
  onError: (message: string) => void;
  onPosition: (label: string) => void;
  onWarning: (message: string) => void;
}

const RESOURCE_LIMITS = {
  maxArchiveEntries: 4096,
  maxArchiveEntryBytes: 64 * 1024 * 1024,
  maxTotalInflatedBytes: 192 * 1024 * 1024,
};
const MAX_PDF_CSS_PIXELS = 8 * 1024 * 1024;
const MAX_PDF_BITMAP_PIXELS = 16 * 1024 * 1024;
const MAX_PDF_SEARCH_PAGES = 500;
const MAX_ACCESSIBLE_TEXT_CHARACTERS = 100_000;
const OOXML_WORKER_TIMEOUT_MS = 15_000;
const PDF_OPERATION_TIMEOUT_MS = 15_000;
const CORRUPT_ERROR_PATTERN = /corrupt|invalid|parse|format/i;
const ENCRYPTED_ERROR_PATTERN = /encrypted|password/i;
const RESOURCE_ERROR_PATTERN = /resource|archive|limit|too large/i;
const MARKDOWN_LEADING_PIPE_PATTERN = /^\s*\|/;
const MARKDOWN_TRAILING_PIPE_PATTERN = /\|\s*$/;
const MARKDOWN_SEPARATOR_ROW_PATTERN = /^\s*\|?\s*:?-+/;

function errorMessage(error: Error | null) {
  if (error) {
    if (ENCRYPTED_ERROR_PATTERN.test(error.message)) {
      return "This file is encrypted. Preview is unavailable; use Download to open it securely in its original application.";
    }
    if (RESOURCE_ERROR_PATTERN.test(error.message)) {
      return "This file exceeds the safe preview processing limits. Download remains available.";
    }
    if (CORRUPT_ERROR_PATTERN.test(error.message)) {
      return "This file appears corrupt or uses an unsupported document variant. Download remains available.";
    }
  }
  return "Preview could not be prepared for this file. Download remains available.";
}

function withPreviewTimeout<Result>(
  task: Promise<Result>,
  timeoutMessage: string,
  onTimeout: () => void
) {
  return new Promise<Result>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      onTimeout();
      reject(new Error(timeoutMessage));
    }, PDF_OPERATION_TIMEOUT_MS);
    task.then(
      (result) => {
        window.clearTimeout(timeout);
        resolve(result);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function controllerForViewer(viewer: {
  clearFind: () => void;
  findNext: () => Promise<object | null>;
  findPrev: () => Promise<object | null>;
  findText: (query: string) => Promise<object[]>;
  fitPage: () => void | Promise<void>;
  fitWidth: () => void | Promise<void>;
  zoomIn: () => void | Promise<void>;
  zoomOut: () => void | Promise<void>;
}): PreviewViewerController {
  let activeMatch = -1;
  let matchTotal = 0;
  const result = (): PreviewSearchResult => ({
    current: matchTotal > 0 ? activeMatch + 1 : 0,
    total: matchTotal,
  });
  return {
    clearSearch: () => {
      viewer.clearFind();
      activeMatch = -1;
      matchTotal = 0;
    },
    find: async (query) => {
      matchTotal = (await viewer.findText(query)).length;
      activeMatch = matchTotal > 0 ? 0 : -1;
      return result();
    },
    findNext: async () => {
      if (matchTotal > 0) {
        await viewer.findNext();
        activeMatch = stepPdfSearchMatch(activeMatch, matchTotal, 1);
      }
      return result();
    },
    findPrevious: async () => {
      if (matchTotal > 0) {
        await viewer.findPrev();
        activeMatch = stepPdfSearchMatch(activeMatch, matchTotal, -1);
      }
      return result();
    },
    fitPage: async () => {
      await viewer.fitPage();
    },
    fitWidth: async () => {
      await viewer.fitWidth();
    },
    supportsSearch: true,
    zoomIn: async () => {
      await viewer.zoomIn();
    },
    zoomOut: async () => {
      await viewer.zoomOut();
    },
  };
}

interface OoxmlViewerLoadResult {
  accessibleText: string;
  controller: PreviewViewerController;
  destroy: () => void;
  formulaStatuses?: SpreadsheetFormulaStatus[];
  position: string;
}

interface AccessibleSpreadsheetSheet {
  name: string;
  rows: string[][];
}

const MAX_ACCESSIBLE_SHEET_ROWS = 200;
const MAX_ACCESSIBLE_SHEET_COLUMNS = 50;

function markdownCells(line: string) {
  return line
    .replace(MARKDOWN_LEADING_PIPE_PATTERN, "")
    .replace(MARKDOWN_TRAILING_PIPE_PATTERN, "")
    .split("|")
    .slice(0, MAX_ACCESSIBLE_SHEET_COLUMNS)
    .map((cell) => cell.trim());
}

function accessibleSpreadsheetSheets(markdown: string) {
  const sheets: AccessibleSpreadsheetSheet[] = [];
  let active: AccessibleSpreadsheetSheet | null = null;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      active = { name: line.slice(3).trim() || "Sheet", rows: [] };
      sheets.push(active);
      continue;
    }
    if (!(active && line.includes("|")) || MARKDOWN_SEPARATOR_ROW_PATTERN.test(line)) {
      continue;
    }
    if (active.rows.length < MAX_ACCESSIBLE_SHEET_ROWS) {
      active.rows.push(markdownCells(line));
    }
  }
  return sheets;
}

function formulaStatusText(status: SpreadsheetFormulaStatus["status"]) {
  return status === "unsupported"
    ? "Formula not recalculated in preview; the stored workbook result is shown."
    : "Formula recalculated in preview.";
}

function AccessibleSpreadsheetDocument({
  formulaStatuses,
  markdown,
}: {
  formulaStatuses: SpreadsheetFormulaStatus[];
  markdown: string;
}) {
  const sheets = accessibleSpreadsheetSheets(markdown);
  const statusesByCell = new Map(
    formulaStatuses.map((entry) => [`${entry.sheetName}!${entry.cell.toUpperCase()}`, entry.status])
  );
  if (sheets.length === 0) {
    return <p>Spreadsheet structure is preparing.</p>;
  }
  const unsupportedStatuses = formulaStatuses.filter((entry) => entry.status === "unsupported");
  return (
    <>
      {unsupportedStatuses.length > 0 ? (
        <section aria-label="Formula calculation status">
          <h2>Formula calculation status</h2>
          <ul>
            {unsupportedStatuses.slice(0, 1000).map((entry) => (
              <li key={`${entry.sheetName}-${entry.cell}`}>
                {entry.sheetName} {entry.cell}. {formulaStatusText(entry.status)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {sheets.map((sheet) => (
        <section aria-label={sheet.name} key={sheet.name}>
          <h2>{sheet.name}</h2>
          <table>
            <caption>{sheet.name} values</caption>
            <tbody>
              {sheet.rows.map((row, rowIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the parsed row index is the stable spreadsheet row coordinate.
                <tr key={`${sheet.name}-${rowIndex}`}>
                  {row.map((cell, columnIndex) => {
                    const Cell = rowIndex === 0 || columnIndex === 0 ? "th" : "td";
                    let scope: "col" | "row" | undefined;
                    if (Cell === "th") {
                      scope = rowIndex === 0 ? "col" : "row";
                    }
                    const reference = cellReference(rowIndex + 1, columnIndex + 1);
                    const formulaStatus = statusesByCell.get(`${sheet.name}!${reference}`);
                    return (
                      <Cell
                        // biome-ignore lint/suspicious/noArrayIndexKey: the parsed column index is the stable spreadsheet column coordinate.
                        key={`${sheet.name}-${rowIndex}-${columnIndex}`}
                        scope={scope}
                      >
                        {cell || "Empty"}
                        {formulaStatus ? `. ${formulaStatusText(formulaStatus)}` : null}
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}

function cellReference(row: number, column: number) {
  let remaining = column;
  let letters = "";
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    letters = `${String.fromCharCode(65 + remainder)}${letters}`;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return `${letters || "A"}${Math.max(1, row)}`;
}

interface PdfSearchOccurrence extends PdfSearchMatch {
  pageNumber: number;
}

function firstTextNode(element: HTMLElement) {
  return document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode();
}

function pdfSearchRects(match: PdfSearchMatch, textDivs: HTMLElement[]) {
  const rects: DOMRect[] = [];
  const { begin, end } = match;
  const { itemIndex: beginItemIndex, offset: beginOffset } = begin;
  const { itemIndex: endItemIndex, offset: endOffset } = end;
  for (let itemIndex = beginItemIndex; itemIndex <= endItemIndex; itemIndex += 1) {
    const textDiv = textDivs[itemIndex];
    if (!textDiv) {
      continue;
    }
    const textNode = firstTextNode(textDiv);
    if (!textNode) {
      continue;
    }
    const textLength = textNode.textContent?.length ?? 0;
    const from = itemIndex === beginItemIndex ? beginOffset : 0;
    const to = itemIndex === endItemIndex ? endOffset : textLength;
    if (to <= from || from > textLength || to > textLength) {
      continue;
    }
    const range = document.createRange();
    range.setStart(textNode, from);
    range.setEnd(textNode, to);
    rects.push(...[...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0));
  }
  return rects;
}

function appendPdfSearchHighlight({
  highlightLayer,
  rect,
  selected,
  surfaceRect,
}: {
  highlightLayer: HTMLDivElement;
  rect: DOMRect;
  selected: boolean;
  surfaceRect: DOMRect;
}) {
  const highlight = document.createElement("div");
  highlight.className = selected
    ? "absolute rounded-sm border-2 border-amber-800 bg-amber-300/65 shadow-sm"
    : "absolute rounded-sm bg-amber-300/45";
  highlight.dataset.pdfSearchHighlight = selected ? "active" : "match";
  highlight.style.height = `${rect.height}px`;
  highlight.style.left = `${rect.left - surfaceRect.left}px`;
  highlight.style.top = `${rect.top - surfaceRect.top}px`;
  highlight.style.width = `${rect.width}px`;
  highlightLayer.append(highlight);
  return highlight;
}

function paintPdfSearchHighlights({
  activeMatch,
  highlightLayer,
  matches,
  pageNumber,
  pageSurface,
  textDivs,
}: {
  activeMatch: number;
  highlightLayer: HTMLDivElement;
  matches: PdfSearchOccurrence[];
  pageNumber: number;
  pageSurface: HTMLDivElement;
  textDivs: HTMLElement[];
}) {
  highlightLayer.replaceChildren();
  const surfaceRect = pageSurface.getBoundingClientRect();
  let selectedHighlight: HTMLDivElement | null = null;
  for (const [matchIndex, match] of matches.entries()) {
    if (match.pageNumber !== pageNumber) {
      continue;
    }
    const selected = matchIndex === activeMatch;
    for (const rect of pdfSearchRects(match, textDivs)) {
      const highlight = appendPdfSearchHighlight({
        highlightLayer,
        rect,
        selected,
        surfaceRect,
      });
      if (selected) {
        selectedHighlight = highlight;
      }
    }
  }
  selectedHighlight?.scrollIntoView({ block: "center", inline: "center" });
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjs;
}

function usePdfRenderer({
  bytes,
  onController,
  onError,
  onPosition,
  onWarning,
}: Pick<
  DocumentPreviewRendererProps,
  "bytes" | "onController" | "onError" | "onPosition" | "onWarning"
>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const pageSurfaceRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pageLabel, setPageLabel] = useState("Page 1");
  const [canGoPrevious, setCanGoPrevious] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);
  const [accessiblePageText, setAccessiblePageText] = useState("");
  const goPreviousRef = useRef<() => Promise<void>>(async () => undefined);
  const goNextRef = useRef<() => Promise<void>>(async () => undefined);
  const emitController = useEffectEvent(onController);
  const emitError = useEffectEvent(onError);
  const emitPosition = useEffectEvent(onPosition);
  const emitWarning = useEffectEvent(onWarning);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const highlightLayer = highlightLayerRef.current;
    const pageSurface = pageSurfaceRef.current;
    const textLayerContainer = textLayerRef.current;
    if (!(canvas && container && highlightLayer && pageSurface && textLayerContainer)) {
      return;
    }
    let disposed = false;
    let destroy = async () => undefined;
    let activeTextLayer: { cancel: () => void } | null = null;
    const load = async () => {
      await assertSafePdfPreviewInWorker(bytes.slice(0));
      const pdfjs = await loadPdfJs();
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(bytes.slice(0)),
        maxImageSize: MAX_PDF_BITMAP_PIXELS,
        stopAtErrors: true,
        useWorkerFetch: false,
      });
      destroy = async () => {
        await loadingTask.destroy();
      };
      const stopPdfWork = () => {
        loadingTask.destroy().catch(() => undefined);
      };
      const timedPdfWork = <Result,>(task: Promise<Result>) =>
        withPreviewTimeout(task, "PDF preview processing timeout", stopPdfWork);
      const document = await timedPdfWork(loadingTask.promise);
      if (disposed) {
        await loadingTask.destroy();
        return;
      }
      if (document.numPages > MAX_PDF_SEARCH_PAGES) {
        emitWarning(`Search is limited to the first ${MAX_PDF_SEARCH_PAGES} pages.`);
      }
      type PdfPage = Awaited<ReturnType<typeof document.getPage>>;
      type PdfTextContent = Awaited<ReturnType<PdfPage["getTextContent"]>>;
      let currentPage = 1;
      let scale = 1;
      let matches: PdfSearchOccurrence[] = [];
      let activeMatch = -1;
      let searchGeneration = 0;
      let renderGeneration = 0;
      const textContentCache = new Map<number, PdfTextContent>();
      const searchItems = (content: PdfTextContent): PdfSearchTextItem[] =>
        content.items.flatMap((item) =>
          "str" in item ? [{ hasEOL: item.hasEOL, str: item.str }] : []
        );
      const textContentForPage = async (pageNumber: number, suppliedPage?: PdfPage) => {
        const cached = textContentCache.get(pageNumber);
        if (cached) {
          return cached;
        }
        const page = suppliedPage ?? (await timedPdfWork(document.getPage(pageNumber)));
        const content = await timedPdfWork(page.getTextContent({ disableNormalization: true }));
        textContentCache.set(pageNumber, content);
        return content;
      };
      const searchResult = (): PreviewSearchResult => ({
        current: activeMatch >= 0 ? activeMatch + 1 : 0,
        total: matches.length,
      });
      const render = async () => {
        renderGeneration += 1;
        const generation = renderGeneration;
        const page = await timedPdfWork(document.getPage(currentPage));
        if (disposed || generation !== renderGeneration) {
          return;
        }
        const requestedCssViewport = page.getViewport({ scale });
        const cssScaleAdjustment = Math.min(
          1,
          Math.sqrt(
            MAX_PDF_CSS_PIXELS /
              Math.max(1, requestedCssViewport.width * requestedCssViewport.height)
          )
        );
        const cssViewport = page.getViewport({ scale: scale * cssScaleAdjustment });
        const pixelRatio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(MAX_PDF_BITMAP_PIXELS / Math.max(1, cssViewport.width * cssViewport.height))
        );
        const viewport = page.getViewport({ scale: scale * cssScaleAdjustment * pixelRatio });
        activeTextLayer?.cancel();
        activeTextLayer = null;
        textLayerContainer.replaceChildren();
        highlightLayer.replaceChildren();
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(cssViewport.width)}px`;
        canvas.style.height = `${Math.ceil(cssViewport.height)}px`;
        pageSurface.style.setProperty("--total-scale-factor", String(cssViewport.scale));
        pageSurface.style.height = `${Math.ceil(cssViewport.height)}px`;
        pageSurface.style.width = `${Math.ceil(cssViewport.width)}px`;
        const renderTask = page.render({
          annotationMode: pdfjs.AnnotationMode.DISABLE,
          canvas,
          viewport,
        });
        await withPreviewTimeout(renderTask.promise, "PDF page rendering timeout", () => {
          renderTask.cancel();
          stopPdfWork();
        });
        const textContent = await textContentForPage(currentPage, page);
        if (disposed || generation !== renderGeneration) {
          return;
        }
        setAccessiblePageText(
          searchItems(textContent)
            .map((item) => item.str)
            .join(" ")
            .slice(0, MAX_ACCESSIBLE_TEXT_CHARACTERS)
        );
        const textLayer = new pdfjs.TextLayer({
          container: textLayerContainer,
          textContentSource: textContent,
          viewport: cssViewport,
        });
        activeTextLayer = textLayer;
        await withPreviewTimeout(textLayer.render(), "PDF text layer rendering timeout", () => {
          textLayer.cancel();
        });
        if (disposed || generation !== renderGeneration) {
          return;
        }
        paintPdfSearchHighlights({
          activeMatch,
          highlightLayer,
          matches,
          pageNumber: currentPage,
          pageSurface,
          textDivs: textLayer.textDivs,
        });
        const nextLabel = `Page ${currentPage} of ${document.numPages}`;
        setPageLabel(nextLabel);
        setCanGoPrevious(currentPage > 1);
        setCanGoNext(currentPage < document.numPages);
        emitPosition(nextLabel);
      };
      const fitWidth = async () => {
        const page = await timedPdfWork(document.getPage(currentPage));
        const viewport = page.getViewport({ scale: 1 });
        scale = Math.max(0.25, Math.min(3, (container.clientWidth - 32) / viewport.width));
        await render();
      };
      const fitPage = async () => {
        const page = await timedPdfWork(document.getPage(currentPage));
        const viewport = page.getViewport({ scale: 1 });
        scale = Math.max(
          0.25,
          Math.min(
            3,
            (container.clientWidth - 32) / viewport.width,
            (container.clientHeight - 32) / viewport.height
          )
        );
        await render();
      };
      const goToPage = async (pageNumber: number) => {
        currentPage = Math.max(1, Math.min(document.numPages, pageNumber));
        await render();
      };
      goPreviousRef.current = () => goToPage(currentPage - 1);
      goNextRef.current = () => goToPage(currentPage + 1);
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: bounded PDF search keeps cancellation, pagination, and match accounting at the worker-facing seam.
      const find = async (query: string) => {
        searchGeneration += 1;
        const generation = searchGeneration;
        const nextMatches: PdfSearchOccurrence[] = [];
        const pageLimit = Math.min(document.numPages, MAX_PDF_SEARCH_PAGES);
        for (let start = 1; start <= pageLimit; start += 4) {
          const pageNumbers = Array.from(
            { length: Math.min(4, pageLimit - start + 1) },
            (_, index) => start + index
          );
          // biome-ignore lint/performance/noAwaitInLoops: four-page batches intentionally cap hostile-document fan-out.
          const pageContents = await Promise.all(
            pageNumbers.map((page) => textContentForPage(page))
          );
          if (disposed || generation !== searchGeneration) {
            return searchResult();
          }
          for (const [index, content] of pageContents.entries()) {
            const pageNumber = pageNumbers[index];
            nextMatches.push(
              ...findPdfSearchMatches(searchItems(content), query).map((match) => ({
                ...match,
                pageNumber,
              }))
            );
          }
        }
        matches = nextMatches;
        activeMatch = matches.length > 0 ? 0 : -1;
        if (matches[0]) {
          await goToPage(matches[0].pageNumber);
        } else {
          highlightLayer.replaceChildren();
        }
        return searchResult();
      };
      const stepMatch = async (direction: -1 | 1) => {
        if (matches.length === 0) {
          return searchResult();
        }
        activeMatch = stepPdfSearchMatch(activeMatch, matches.length, direction);
        await goToPage(matches[activeMatch].pageNumber);
        return searchResult();
      };
      emitController({
        clearSearch: () => {
          searchGeneration += 1;
          matches = [];
          activeMatch = -1;
          highlightLayer.replaceChildren();
        },
        find: (query) =>
          withPreviewTimeout(find(query), "PDF search timeout", () => {
            searchGeneration += 1;
          }),
        findNext: () => stepMatch(1),
        findPrevious: () => stepMatch(-1),
        fitPage,
        fitWidth,
        supportsSearch: true,
        zoomIn: async () => {
          scale = Math.min(3, scale + 0.2);
          await render();
        },
        zoomOut: async () => {
          scale = Math.max(0.25, scale - 0.2);
          await render();
        },
      });
      await fitWidth();
    };
    load().catch((error) => {
      if (!disposed) {
        emitError(errorMessage(error instanceof Error ? error : null));
      }
    });
    return () => {
      disposed = true;
      activeTextLayer?.cancel();
      emitController(null);
      destroy().catch(() => undefined);
    };
  }, [bytes]);

  return {
    accessiblePageText,
    canGoNext,
    canGoPrevious,
    canvasRef,
    containerRef,
    goNextRef,
    goPreviousRef,
    highlightLayerRef,
    pageLabel,
    pageSurfaceRef,
    textLayerRef,
  };
}

function PdfRenderer(
  props: Pick<
    DocumentPreviewRendererProps,
    "bytes" | "onController" | "onError" | "onPosition" | "onWarning"
  >
) {
  const {
    accessiblePageText,
    canGoNext,
    canGoPrevious,
    canvasRef,
    containerRef,
    goNextRef,
    goPreviousRef,
    highlightLayerRef,
    pageLabel,
    pageSurfaceRef,
    textLayerRef,
  } = usePdfRenderer(props);

  return (
    <div className="relative h-full min-h-[24rem] overflow-auto p-4" ref={containerRef}>
      <div className="material-floating sticky top-0 z-20 mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-2 py-1 text-slate-700 text-xs shadow-sm backdrop-blur [--material-preference-background:#fff] [--material-preference-boundary:#cbd5e1]">
        <button
          className="min-h-11 rounded-full px-3 font-semibold disabled:opacity-40"
          disabled={!canGoPrevious}
          onClick={() => goPreviousRef.current().catch(() => undefined)}
          type="button"
        >
          Previous page
        </button>
        <span aria-live="polite" className="px-2">
          {pageLabel}
        </span>
        <button
          className="min-h-11 rounded-full px-3 font-semibold disabled:opacity-40"
          disabled={!canGoNext}
          onClick={() => goNextRef.current().catch(() => undefined)}
          type="button"
        >
          Next page
        </button>
      </div>
      <div className="relative mx-auto bg-white shadow-xl" ref={pageSurfaceRef}>
        <canvas
          aria-label={pageLabel}
          className="block max-w-none bg-white"
          ref={canvasRef}
          role="img"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden text-left leading-none [--min-font-size-inv:calc(1/var(--min-font-size))] [--text-scale-factor:calc(var(--total-scale-factor)*var(--min-font-size))] [-webkit-text-size-adjust:none] [text-size-adjust:none] [&_.markedContent]:contents [&_br]:absolute [&_span]:absolute [&_span]:whitespace-pre [&_span]:text-transparent [&_span]:[font-size:calc(var(--text-scale-factor)*var(--font-height))] [&_span]:[transform-origin:0_0] [&_span]:[transform:rotate(var(--rotate,0deg))_scaleX(var(--scale-x,1))_scale(var(--min-font-size-inv))]"
          data-pdf-text-layer=""
          ref={textLayerRef}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          ref={highlightLayerRef}
        />
      </div>
      <article aria-label={`Accessible text for ${pageLabel}`} className="sr-only">
        <p>{accessiblePageText || "No extractable text on this page."}</p>
      </article>
    </div>
  );
}

async function loadDocxViewer(
  container: HTMLDivElement,
  bytes: ArrayBuffer,
  onPosition: (label: string) => void,
  onWarning: (message: string) => void
): Promise<OoxmlViewerLoadResult> {
  onWarning("Interactive, embedded, and external content is not activated in preview.");
  const { DocxDocument, DocxScrollViewer } = await import("@silurus/ooxml/docx");
  const document = await DocxDocument.load(bytes.slice(0), {
    mode: "worker",
    resourceLimits: RESOURCE_LIMITS,
    useGoogleFonts: false,
    workerTimeoutMs: OOXML_WORKER_TIMEOUT_MS,
  });
  const viewer = DocxScrollViewer.fromDocument(container, document, {
    background: "#e9edf2",
    enableHyperlinks: false,
    enableTextSelection: true,
    onVisiblePageChange: (index, total) => onPosition(`Page ${index + 1} of ${total}`),
  });
  viewer.fitWidth();
  return {
    accessibleText: (await document.toMarkdown()).slice(0, MAX_ACCESSIBLE_TEXT_CHARACTERS),
    controller: controllerForViewer(viewer),
    destroy: () => {
      viewer.destroy();
      document.destroy();
    },
    position: `Page 1 of ${viewer.pageCount}`,
  };
}

async function loadPptxViewer(
  container: HTMLDivElement,
  bytes: ArrayBuffer,
  onPosition: (label: string) => void,
  onWarning: (message: string) => void
): Promise<OoxmlViewerLoadResult> {
  onWarning("Interactive, embedded, and external content is not activated in preview.");
  const { PptxPresentation, PptxScrollViewer } = await import("@silurus/ooxml/pptx");
  const presentation = await PptxPresentation.load(bytes.slice(0), {
    mode: "worker",
    resourceLimits: RESOURCE_LIMITS,
    useGoogleFonts: false,
    workerTimeoutMs: OOXML_WORKER_TIMEOUT_MS,
  });
  const viewer = PptxScrollViewer.fromPresentation(container, presentation, {
    background: "#e9edf2",
    enableHyperlinks: false,
    enableTextSelection: true,
    onVisibleSlideChange: (index, total) => onPosition(`Slide ${index + 1} of ${total}`),
  });
  viewer.fitWidth();
  return {
    accessibleText: (await presentation.toMarkdown()).slice(0, MAX_ACCESSIBLE_TEXT_CHARACTERS),
    controller: controllerForViewer(viewer),
    destroy: () => {
      viewer.destroy();
      presentation.destroy();
    },
    position: `Slide 1 of ${viewer.slideCount}`,
  };
}

async function loadXlsxViewer(
  container: HTMLDivElement,
  bytes: ArrayBuffer,
  onPosition: (label: string) => void,
  onDetail: (message: string) => void,
  onWarning: (message: string) => void
): Promise<OoxmlViewerLoadResult> {
  const prepared = await prepareSpreadsheetPreviewInWorker(bytes.slice(0));
  const formulaStatuses = new Map(
    prepared.formulaStatuses.map((entry) => [`${entry.sheetName}!${entry.cell}`, entry.status])
  );
  onWarning("Macros, external data, and remote links are not activated in preview.");
  if (prepared.unsupportedFormulaCount > 0) {
    onWarning(
      `${prepared.unsupportedFormulaCount} formula${prepared.unsupportedFormulaCount === 1 ? " was" : "s were"} not recalculated in preview; stored workbook results are shown.`
    );
  } else if (prepared.recalculatedFormulaCount > 0) {
    onWarning(
      `${prepared.recalculatedFormulaCount} safe formula${prepared.recalculatedFormulaCount === 1 ? " was" : "s were"} recalculated for preview.`
    );
  }
  const { XlsxViewer, XlsxWorkbook } = await import("@silurus/ooxml/xlsx");
  const workbook = await XlsxWorkbook.load(prepared.bytes, {
    mode: "worker",
    resourceLimits: RESOURCE_LIMITS,
    useGoogleFonts: false,
    workerTimeoutMs: OOXML_WORKER_TIMEOUT_MS,
  });
  const viewer = XlsxViewer.fromWorkbook(container, workbook, {
    enableHyperlinks: false,
    onSelectionContextChange: (context) => {
      if (!(context && context.kind === "range")) {
        onDetail("");
        return;
      }
      const { activeCell } = context.selection;
      const cell = context.cells.find(
        (candidate) =>
          candidate.address.row === activeCell.row && candidate.address.col === activeCell.col
      );
      if (!cell) {
        onDetail("");
        return;
      }
      const reference = cellReference(activeCell.row, activeCell.col);
      if (cell.formula) {
        const formula = cell.formula.startsWith("=") ? cell.formula : `=${cell.formula}`;
        const formulaStatus = formulaStatuses.get(`${context.sheetName}!${reference}`);
        if (formulaStatus === "unsupported") {
          onDetail(
            `Selected ${reference}. Formula: ${formula}. Not recalculated in preview. ${cell.displayText ? `Stored result: ${cell.displayText}.` : "Stored result unavailable."}`
          );
          return;
        }
        onDetail(
          `Selected ${reference}. Formula: ${formula}. Recalculated in preview. Displayed result: ${cell.displayText || "Unknown"}.`
        );
        return;
      }
      onDetail(`Selected ${reference}. Displayed value: ${cell.displayText || "Empty"}.`);
    },
    onSheetChange: (index, total) => onPosition(`Sheet ${index + 1} of ${total}`),
    showZoomSlider: false,
  });
  viewer.fitWidth();
  return {
    accessibleText: (await workbook.toMarkdown()).slice(0, MAX_ACCESSIBLE_TEXT_CHARACTERS),
    controller: controllerForViewer(viewer),
    destroy: () => {
      viewer.destroy();
      workbook.destroy();
    },
    formulaStatuses: prepared.formulaStatuses,
    position: `Sheet 1 of ${viewer.sheetCount}`,
  };
}

function OoxmlRenderer({
  bytes,
  kind,
  onController,
  onError,
  onDetail,
  onPosition,
  onWarning,
}: Omit<DocumentPreviewRendererProps, "fileName" | "mimeType" | "objectUrl">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [accessibleText, setAccessibleText] = useState("");
  const [formulaStatuses, setFormulaStatuses] = useState<SpreadsheetFormulaStatus[]>([]);
  const emitController = useEffectEvent(onController);
  const emitDetail = useEffectEvent(onDetail);
  const emitError = useEffectEvent(onError);
  const emitPosition = useEffectEvent(onPosition);
  const emitWarning = useEffectEvent(onWarning);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let disposed = false;
    let destroy: () => void = () => undefined;
    const load = async () => {
      let result: OoxmlViewerLoadResult;
      if (kind === "docx") {
        result = await loadDocxViewer(container, bytes, emitPosition, emitWarning);
      } else if (kind === "pptx") {
        result = await loadPptxViewer(container, bytes, emitPosition, emitWarning);
      } else {
        result = await loadXlsxViewer(container, bytes, emitPosition, emitDetail, emitWarning);
      }
      if (disposed) {
        result.destroy();
        return;
      }
      const {
        accessibleText: nextAccessibleText,
        controller: nextController,
        destroy: nextDestroy,
        position: nextPosition,
      } = result;
      destroy = nextDestroy;
      setAccessibleText(nextAccessibleText);
      setFormulaStatuses(result.formulaStatuses ?? []);
      emitPosition(nextPosition);
      emitController(nextController);
    };
    load().catch((error) => {
      if (!disposed) {
        emitError(errorMessage(error instanceof Error ? error : null));
      }
    });
    return () => {
      disposed = true;
      emitController(null);
      destroy();
    };
  }, [bytes, kind]);

  return (
    <section
      aria-label={kind === "xlsx" ? "Spreadsheet preview" : "Office document preview"}
      className="h-full min-h-[24rem] w-full"
    >
      <div className="h-full min-h-[24rem] w-full overflow-hidden" ref={containerRef} />
      <article aria-label="Accessible document text" className="sr-only">
        {kind === "xlsx" ? (
          <AccessibleSpreadsheetDocument
            formulaStatuses={formulaStatuses}
            markdown={accessibleText}
          />
        ) : (
          <p>{accessibleText || "Document text is preparing."}</p>
        )}
      </article>
    </section>
  );
}

function TextRenderer({ text, query }: { query: string; text: string }) {
  const pieces = (() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [{ highlighted: false, offset: 0, value: text }];
    }
    const output: Array<{ highlighted: boolean; offset: number; value: string }> = [];
    const lowerText = text.toLocaleLowerCase();
    const lowerQuery = normalizedQuery.toLocaleLowerCase();
    let cursor = 0;
    let index = lowerText.indexOf(lowerQuery);
    while (index >= 0 && output.length < 2000) {
      if (index > cursor) {
        output.push({ highlighted: false, offset: cursor, value: text.slice(cursor, index) });
      }
      output.push({
        highlighted: true,
        offset: index,
        value: text.slice(index, index + normalizedQuery.length),
      });
      cursor = index + normalizedQuery.length;
      index = lowerText.indexOf(lowerQuery, cursor);
    }
    if (cursor < text.length) {
      output.push({ highlighted: false, offset: cursor, value: text.slice(cursor) });
    }
    return output;
  })();
  return (
    <pre className="min-h-full whitespace-pre-wrap break-words bg-white p-6 font-sans text-brand-text text-sm leading-7">
      {pieces.map((piece) =>
        piece.highlighted ? (
          <mark className="bg-amber-200 text-inherit" key={`highlight-${piece.offset}`}>
            {piece.value}
          </mark>
        ) : (
          <span key={`text-${piece.offset}`}>{piece.value}</span>
        )
      )}
    </pre>
  );
}

function ImageRenderer({
  fileName,
  objectUrl,
  onController,
  onError,
  onPosition,
}: Pick<
  DocumentPreviewRendererProps,
  "fileName" | "objectUrl" | "onController" | "onError" | "onPosition"
>) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const emitController = useEffectEvent(onController);
  const emitPosition = useEffectEvent(onPosition);

  useEffect(() => {
    emitPosition("Image");
    emitController({
      clearSearch: () => undefined,
      find: async () => ({ current: 0, total: 0 }),
      findNext: async () => ({ current: 0, total: 0 }),
      findPrevious: async () => ({ current: 0, total: 0 }),
      fitPage: async () => setScale(1),
      fitWidth: async () => setScale(1),
      rotateClockwise: async () => setRotation((current) => (current + 90) % 360),
      supportsSearch: false,
      zoomIn: async () => setScale((current) => Math.min(3, current + 0.25)),
      zoomOut: async () => setScale((current) => Math.max(0.25, current - 0.25)),
    });
    return () => emitController(null);
  }, []);

  if (!objectUrl) {
    return null;
  }
  return (
    <div className="grid h-full min-h-[24rem] place-items-center overflow-auto p-6">
      <Image
        alt={`Preview of ${fileName}`}
        className="max-h-[calc(100dvh-10rem)] max-w-full object-contain transition-transform motion-reduce:transition-none"
        height={1200}
        onError={() =>
          onError("This image could not be decoded safely. Download remains available.")
        }
        src={objectUrl}
        style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
        unoptimized
        width={1600}
      />
    </div>
  );
}

export function DocumentPreviewRenderer(
  props: DocumentPreviewRendererProps & { searchQuery: string }
) {
  const { bytes, kind, mimeType, searchQuery } = props;
  if (kind === "pdf") {
    return <PdfRenderer {...props} />;
  }
  if (kind === "image") {
    return <ImageRenderer {...props} />;
  }
  if (kind === "text") {
    return <TextRenderer query={searchQuery} text={new TextDecoder().decode(bytes)} />;
  }
  if (kind === "docx" || kind === "xlsx" || kind === "pptx") {
    return <OoxmlRenderer {...props} />;
  }
  return (
    <div className="grid min-h-full place-items-center p-8 text-center">
      <div>
        <p className="font-semibold text-brand-dark">Preview is not available for this format.</p>
        <p className="mt-2 text-brand-muted text-sm">Use Download to open the original file.</p>
        <span className="sr-only">{mimeType}</span>
      </div>
    </div>
  );
}
