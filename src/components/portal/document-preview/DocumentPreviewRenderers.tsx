// biome-ignore-all lint/performance/noJsxPropsBind: document controls intentionally close over the active renderer instance.

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentPreviewKind } from "@/lib/portal/documentPreview";
import { assertSafePdfPreviewInWorker } from "@/lib/portal/pdfPreviewSafetyWorkerClient";
import type { SpreadsheetFormulaStatus } from "@/lib/portal/spreadsheetPreview";
import { prepareSpreadsheetPreviewInWorker } from "@/lib/portal/spreadsheetPreviewWorkerClient";

export interface PreviewViewerController {
  clearSearch: () => void;
  find: (query: string) => Promise<number>;
  findNext: () => Promise<void>;
  findPrevious: () => Promise<void>;
  fitPage: () => Promise<void>;
  fitWidth: () => Promise<void>;
  rotateClockwise?: () => Promise<void>;
  supportsSearch: boolean;
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
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
  return {
    clearSearch: () => viewer.clearFind(),
    find: async (query) => (await viewer.findText(query)).length,
    findNext: async () => {
      await viewer.findNext();
    },
    findPrevious: async () => {
      await viewer.findPrev();
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
  const sheets = useMemo(() => accessibleSpreadsheetSheets(markdown), [markdown]);
  const statusesByCell = useMemo(
    () =>
      new Map(
        formulaStatuses.map((entry) => [
          `${entry.sheetName}!${entry.cell.toUpperCase()}`,
          entry.status,
        ])
      ),
    [formulaStatuses]
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

function PdfRenderer({
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
  const [pageLabel, setPageLabel] = useState("Page 1");
  const [canGoPrevious, setCanGoPrevious] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);
  const [accessiblePageText, setAccessiblePageText] = useState("");
  const goPreviousRef = useRef<() => Promise<void>>(async () => undefined);
  const goNextRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!(canvas && container)) {
      return;
    }
    let disposed = false;
    let destroy = async () => undefined;
    const load = async () => {
      await assertSafePdfPreviewInWorker(bytes.slice(0));
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
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
        onWarning(`Search is limited to the first ${MAX_PDF_SEARCH_PAGES} pages.`);
      }
      let currentPage = 1;
      let scale = 1;
      let matchPages: number[] = [];
      let activeMatch = 0;
      let searchGeneration = 0;
      let renderGeneration = 0;
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
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(cssViewport.width)}px`;
        canvas.style.height = `${Math.ceil(cssViewport.height)}px`;
        const renderTask = page.render({
          annotationMode: pdfjs.AnnotationMode.DISABLE,
          canvas,
          viewport,
        });
        await withPreviewTimeout(renderTask.promise, "PDF page rendering timeout", () => {
          renderTask.cancel();
          stopPdfWork();
        });
        const textContent = await timedPdfWork(page.getTextContent());
        if (!(disposed || generation !== renderGeneration)) {
          setAccessiblePageText(
            textContent.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
              .slice(0, MAX_ACCESSIBLE_TEXT_CHARACTERS)
          );
        }
        const nextLabel = `Page ${currentPage} of ${document.numPages}`;
        setPageLabel(nextLabel);
        setCanGoPrevious(currentPage > 1);
        setCanGoNext(currentPage < document.numPages);
        onPosition(nextLabel);
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
      const textForPage = async (pageNumber: number) => {
        const page = await timedPdfWork(document.getPage(pageNumber));
        const content = await timedPdfWork(page.getTextContent());
        return content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .toLocaleLowerCase();
      };
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: bounded PDF search keeps cancellation, pagination, and match accounting at the worker-facing seam.
      const find = async (query: string) => {
        searchGeneration += 1;
        const generation = searchGeneration;
        const needle = query.toLocaleLowerCase();
        matchPages = [];
        let matchCount = 0;
        const pageLimit = Math.min(document.numPages, MAX_PDF_SEARCH_PAGES);
        for (let start = 1; start <= pageLimit; start += 4) {
          const pageNumbers = Array.from(
            { length: Math.min(4, pageLimit - start + 1) },
            (_, index) => start + index
          );
          // biome-ignore lint/performance/noAwaitInLoops: four-page batches intentionally cap hostile-document fan-out.
          const pageTexts = await Promise.all(pageNumbers.map(textForPage));
          if (disposed || generation !== searchGeneration) {
            return 0;
          }
          for (const [index, text] of pageTexts.entries()) {
            const pageNumber = pageNumbers[index];
            let matchOffset = text.indexOf(needle);
            if (matchOffset >= 0) {
              matchPages.push(pageNumber);
            }
            while (matchOffset >= 0) {
              matchCount += 1;
              matchOffset = text.indexOf(needle, matchOffset + needle.length);
            }
          }
        }
        activeMatch = 0;
        if (matchPages[0]) {
          await goToPage(matchPages[0]);
        }
        return matchCount;
      };
      const stepMatch = async (direction: -1 | 1) => {
        if (matchPages.length === 0) {
          return;
        }
        activeMatch = (activeMatch + direction + matchPages.length) % matchPages.length;
        await goToPage(matchPages[activeMatch]);
      };
      onController({
        clearSearch: () => {
          searchGeneration += 1;
          matchPages = [];
          activeMatch = 0;
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
        onError(errorMessage(error instanceof Error ? error : null));
      }
    });
    return () => {
      disposed = true;
      onController(null);
      destroy().catch(() => undefined);
    };
  }, [bytes, onController, onError, onPosition, onWarning]);

  return (
    <div className="relative h-full min-h-[24rem] overflow-auto p-4" ref={containerRef}>
      <div className="sticky top-0 z-10 mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-2 py-1 text-slate-700 text-xs shadow-sm backdrop-blur">
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
      <canvas
        aria-label={pageLabel}
        className="mx-auto block max-w-none bg-white shadow-xl"
        ref={canvasRef}
        role="img"
      />
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
        result = await loadDocxViewer(container, bytes, onPosition, onWarning);
      } else if (kind === "pptx") {
        result = await loadPptxViewer(container, bytes, onPosition, onWarning);
      } else {
        result = await loadXlsxViewer(container, bytes, onPosition, onDetail, onWarning);
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
      onPosition(nextPosition);
      onController(nextController);
    };
    load().catch((error) => {
      if (!disposed) {
        onError(errorMessage(error instanceof Error ? error : null));
      }
    });
    return () => {
      disposed = true;
      onController(null);
      destroy();
    };
  }, [bytes, kind, onController, onDetail, onError, onPosition, onWarning]);

  return (
    <section aria-label={kind === "xlsx" ? "Spreadsheet preview" : "Office document preview"}>
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
  const pieces = useMemo(() => {
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
  }, [query, text]);
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

  useEffect(() => {
    onPosition("Image");
    onController({
      clearSearch: () => undefined,
      find: async () => 0,
      findNext: async () => undefined,
      findPrevious: async () => undefined,
      fitPage: async () => setScale(1),
      fitWidth: async () => setScale(1),
      rotateClockwise: async () => setRotation((current) => (current + 90) % 360),
      supportsSearch: false,
      zoomIn: async () => setScale((current) => Math.min(3, current + 0.25)),
      zoomOut: async () => setScale((current) => Math.max(0.25, current - 0.25)),
    });
    return () => onController(null);
  }, [onController, onPosition]);

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
