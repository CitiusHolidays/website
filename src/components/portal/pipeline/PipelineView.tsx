"use client";

import {
  type DragEventHandler,
  type KeyboardEventHandler,
  type RefCallback,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { PIPELINE_STAGES, SALES_PIPELINE_STAGES } from "@/lib/portal/constants";
import {
  getAllowedContractingPipelineBoardTargets,
  isContractingPipelineBoardLocked,
  isContractingPipelineBoardStage,
} from "@/lib/portal/contractingPipelinePolicy";
import {
  canMovePipelineCard,
  getAllowedSalesPipelineBoardTargets,
  getPipelineCardStage,
  isSalesPipelineBoardLocked,
  isSalesPipelineBoardStage,
  type SalesPipelineBoardStage,
} from "@/lib/portal/salesPipelinePolicy";
import { getPipelineStage, getSalesPipelineStage } from "@/lib/portal/workflow";

export type PipelineMode = "sales" | "contracting";

interface PipelineRow {
  clientName?: string;
  contractingStatus?: string;
  destination?: string;
  id: string;
  leadStage?: string;
  paxCount?: number;
  queryCode?: string;
  salesOwnerName?: string;
  salesStatus?: string;
  [key: string]: unknown;
}

export interface MoveSalesPipelineStageArgs {
  expectedLeadStage: SalesPipelineBoardStage;
  queryId: string;
  targetStage: SalesPipelineBoardStage;
}

export interface MoveContractingPipelineStageArgs {
  expectedContractingStatus: string;
  queryId: string;
  targetStage: "Proposal sent";
}

const PIPELINE_MODES = [
  ["sales", "Sales pipeline"],
  ["contracting", "Contracting pipeline"],
] as const;

function buildSalesBuckets(
  rows: PipelineRow[],
  optimisticStages: Record<string, string>
): Record<string, PipelineRow[]> {
  const buckets = Object.fromEntries(
    SALES_PIPELINE_STAGES.map((stage) => [stage, [] as PipelineRow[]])
  ) as Record<string, PipelineRow[]>;
  for (const row of rows) {
    const stage = optimisticStages[row.id] ?? getSalesPipelineStage(row);
    buckets[stage] = buckets[stage] || [];
    buckets[stage].push(row);
  }
  return buckets;
}

function buildContractingBuckets(
  rows: PipelineRow[],
  optimisticStages: Record<string, string>
): Record<string, PipelineRow[]> {
  const buckets = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as PipelineRow[]])
  ) as Record<string, PipelineRow[]>;
  for (const row of rows) {
    const stage = optimisticStages[row.id] ?? getPipelineStage(row);
    buckets[stage] = buckets[stage] || [];
    buckets[stage].push(row);
  }
  return buckets;
}

function pipelineMoveErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error && "data" in error && typeof error.data === "string") {
    return error.data;
  }
  return "Move failed";
}

function pipelineStageForMode(mode: PipelineMode, item: PipelineRow) {
  return mode === "sales" ? getPipelineCardStage(item) : getPipelineStage(item);
}

function pipelineMoveValidationMessage({
  fromStage,
  item,
  label,
  mode,
  targetStage,
}: {
  fromStage: string;
  item: PipelineRow;
  label: string;
  mode: PipelineMode;
  targetStage: string;
}) {
  if (mode === "sales") {
    if (!isSalesPipelineBoardStage(fromStage)) {
      return `Cannot move ${label} from ${fromStage}. Use Sales Decision for that outcome.`;
    }
    if (!(isSalesPipelineBoardStage(targetStage) && canMovePipelineCard(item, targetStage))) {
      return `Cannot move ${label} to ${targetStage}. Use Sales Decision for that outcome.`;
    }
    return null;
  }
  if (
    !isContractingPipelineBoardStage(targetStage) ||
    isContractingPipelineBoardLocked(item) ||
    !getAllowedContractingPipelineBoardTargets(fromStage).includes(targetStage)
  ) {
    return `Cannot move ${label} to ${targetStage}. Use the required workflow action.`;
  }
  return null;
}

async function invokePipelineMove({
  fromStage,
  item,
  mode,
  moveContractingPipelineStage,
  moveSalesPipelineStage,
  targetStage,
}: {
  fromStage: string;
  item: PipelineRow;
  mode: PipelineMode;
  moveContractingPipelineStage?: (args: MoveContractingPipelineStageArgs) => Promise<unknown>;
  moveSalesPipelineStage?: (args: MoveSalesPipelineStageArgs) => Promise<unknown>;
  targetStage: string;
}) {
  if (mode === "sales") {
    return await moveSalesPipelineStage?.({
      expectedLeadStage: fromStage as SalesPipelineBoardStage,
      queryId: item.id,
      targetStage: targetStage as SalesPipelineBoardStage,
    });
  }
  return await moveContractingPipelineStage?.({
    expectedContractingStatus: fromStage,
    queryId: item.id,
    targetStage: "Proposal sent",
  });
}

interface PipelineDragPayload {
  expectedLeadStage: string;
  id: string;
  label: string;
  sourceStage: string;
}

function readPipelineDragPayload(raw: string): PipelineDragPayload | null {
  try {
    return JSON.parse(raw) as PipelineDragPayload;
  } catch {
    return null;
  }
}

function isPipelineTargetForMode(mode: PipelineMode, stage: string) {
  return mode === "sales"
    ? isSalesPipelineBoardStage(stage)
    : isContractingPipelineBoardStage(stage);
}

interface PipelineModeButtonProps {
  active: boolean;
  buttonRef: RefCallback<HTMLInputElement>;
  label: string;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onSelect: (mode: PipelineMode) => void;
  value: PipelineMode;
}

function PipelineModeButton({
  active,
  buttonRef,
  label,
  onKeyDown,
  onSelect,
  value,
}: PipelineModeButtonProps) {
  const handleChange = () => onSelect(value);
  return (
    <label className="relative cursor-pointer">
      <input
        aria-checked={active}
        aria-label={label}
        checked={active}
        className="peer sr-only"
        data-mode={value}
        name="pipeline-perspective"
        onChange={handleChange}
        onKeyDown={onKeyDown}
        ref={buttonRef}
        tabIndex={active ? 0 : -1}
        type="radio"
        value={value}
      />
      <span
        className={`flex min-h-11 items-center rounded-full px-4 py-2 font-semibold text-xs transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-citius-blue peer-focus-visible:outline-offset-2 ${
          active
            ? "bg-citius-blue text-white ring-2 ring-citius-blue ring-offset-2"
            : "text-brand-muted hover:text-citius-blue"
        }`}
      >
        {label}
      </span>
    </label>
  );
}

export function PipelineModeSelector({
  mode,
  setMode,
}: {
  mode: PipelineMode;
  setMode: (mode: PipelineMode) => void;
}) {
  const refs = useRef(new Map<PipelineMode, HTMLInputElement>());
  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const currentIndex = Math.max(
      0,
      PIPELINE_MODES.findIndex(([value]) => value === event.currentTarget.dataset.mode)
    );
    let nextIndex = currentIndex;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PIPELINE_MODES.length - 1;
    } else {
      const delta = event.key === "ArrowRight" ? 1 : -1;
      nextIndex = (currentIndex + delta + PIPELINE_MODES.length) % PIPELINE_MODES.length;
    }
    const nextMode = PIPELINE_MODES[nextIndex]?.[0] ?? "sales";
    setMode(nextMode);
    queueMicrotask(() => refs.current.get(nextMode)?.focus());
  };

  return (
    <div
      aria-label="Pipeline perspective"
      className="inline-flex rounded-full border border-brand-border bg-white p-1 shadow-sm"
      role="radiogroup"
    >
      {PIPELINE_MODES.map(([value, label]) => (
        <PipelineModeButton
          active={mode === value}
          buttonRef={(node) => {
            if (node) {
              refs.current.set(value, node);
            } else {
              refs.current.delete(value);
            }
          }}
          key={value}
          label={label}
          onKeyDown={handleKeyDown}
          onSelect={setMode}
          value={value}
        />
      ))}
    </div>
  );
}

interface PipelineCardProps {
  canMove: boolean;
  item: PipelineRow;
  moveTargets: string[];
  onMove: (item: PipelineRow, targetStage: string) => Promise<void>;
  stage: string;
}

function PipelineCard({ canMove, item, moveTargets, onMove, stage }: PipelineCardProps) {
  const label = item.clientName || "Unnamed client";
  const draggable = canMove && moveTargets.length > 0;

  const handleDragStart: DragEventHandler<HTMLElement> = (event) => {
    if (!draggable) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-citius-pipeline-card",
      JSON.stringify({
        expectedLeadStage: stage,
        id: item.id,
        label,
        sourceStage: stage,
      })
    );
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Native drag is pointer-only; the labeled select provides the equivalent keyboard command.
    <article
      className={`rounded-xl border border-brand-border bg-brand-light p-3 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      data-pipeline-card-id={item.id}
      draggable={draggable}
      onDragStart={handleDragStart}
    >
      <div className="font-semibold text-brand-dark text-sm">{label}</div>
      <div className="mt-1 text-brand-muted text-xs">
        {item.queryCode || "No query code"} - {item.destination || "TBD"} - {item.paxCount ?? 0} pax
      </div>
      <div className="mt-1 text-brand-muted text-xs">{item.salesOwnerName || "Unassigned"}</div>
      {draggable ? (
        <label className="mt-3 block text-brand-muted text-xs">
          <span className="sr-only">Move {label} to stage</span>
          <span aria-hidden="true">Move to</span>
          <select
            className="mt-1 w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-brand-dark text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
            defaultValue=""
            onChange={(event) => {
              const targetStage = event.target.value;
              if (!targetStage) {
                return;
              }
              event.target.value = "";
              onMove(item, targetStage).catch(() => undefined);
            }}
          >
            <option value="">Select stage…</option>
            {moveTargets.map((target) => (
              <option key={target} value={target}>
                {target}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </article>
  );
}

export function PipelineView({
  canMoveContractingPipeline = false,
  canMoveSalesPipeline = false,
  moveContractingPipelineStage,
  moveSalesPipelineStage,
  mode,
  rows,
  setMode,
}: {
  canMoveContractingPipeline?: boolean;
  canMoveSalesPipeline?: boolean;
  moveContractingPipelineStage?: (args: MoveContractingPipelineStageArgs) => Promise<unknown>;
  moveSalesPipelineStage?: (args: MoveSalesPipelineStageArgs) => Promise<unknown>;
  mode: PipelineMode;
  rows: PipelineRow[];
  setMode: (mode: PipelineMode) => void;
}) {
  const [announcement, setAnnouncement] = useState("");
  const [optimisticStages, setOptimisticStages] = useState<Record<string, string>>({});
  const [activeDropStage, setActiveDropStage] = useState<string | null>(null);
  const moveInFlight = useRef(new Set<string>());

  const salesMoveEnabled = Boolean(
    canMoveSalesPipeline && moveSalesPipelineStage && mode === "sales"
  );
  const contractingMoveEnabled = Boolean(
    canMoveContractingPipeline && moveContractingPipelineStage && mode === "contracting"
  );
  const moveEnabled = salesMoveEnabled || contractingMoveEnabled;

  const activeOptimisticStages = useMemo(() => {
    const active: Record<string, string> = {};
    for (const [queryId, stage] of Object.entries(optimisticStages)) {
      const row = rows.find((candidate) => candidate.id === queryId);
      if (row && pipelineStageForMode(mode, row) !== stage) {
        active[queryId] = stage;
      }
    }
    return active;
  }, [mode, optimisticStages, rows]);

  const buckets = useMemo(() => {
    if (mode === "sales") {
      return buildSalesBuckets(rows, activeOptimisticStages);
    }
    return buildContractingBuckets(rows, activeOptimisticStages);
  }, [activeOptimisticStages, mode, rows]);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  const clearOptimisticStage = useCallback((queryId: string) => {
    setOptimisticStages((current) => {
      if (!(queryId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[queryId];
      return next;
    });
  }, []);

  const handleMove = useCallback(
    async (item: PipelineRow, targetStage: string, sourceStage?: string) => {
      if (!moveEnabled) {
        return;
      }
      const persistedStage = pipelineStageForMode(mode, item);
      const fromStage = sourceStage ?? activeOptimisticStages[item.id] ?? persistedStage;
      const label = item.clientName || item.queryCode || "Query";
      const validationMessage = pipelineMoveValidationMessage({
        fromStage,
        item,
        label,
        mode,
        targetStage,
      });
      if (validationMessage) {
        announce(validationMessage);
        return;
      }
      if (moveInFlight.current.has(item.id)) {
        return;
      }
      moveInFlight.current.add(item.id);
      announce(`Moving ${label} from ${fromStage} to ${targetStage}.`);
      setOptimisticStages((current) => ({ ...current, [item.id]: targetStage }));
      try {
        await invokePipelineMove({
          fromStage,
          item,
          mode,
          moveContractingPipelineStage,
          moveSalesPipelineStage,
          targetStage,
        });
        announce(`Moved ${label} to ${targetStage}.`);
        moveInFlight.current.delete(item.id);
      } catch (error) {
        clearOptimisticStage(item.id);
        const message = pipelineMoveErrorMessage(error);
        announce(`Could not move ${label} to ${targetStage}. ${message}`);
        moveInFlight.current.delete(item.id);
      }
    },
    [
      announce,
      clearOptimisticStage,
      mode,
      moveContractingPipelineStage,
      moveEnabled,
      moveSalesPipelineStage,
      activeOptimisticStages,
    ]
  );

  const handleDragOver =
    (stage: string): DragEventHandler<HTMLElement> =>
    (event) => {
      if (!moveEnabled) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setActiveDropStage(stage);
    };

  const handleDrop =
    (stage: string): DragEventHandler<HTMLElement> =>
    async (event) => {
      event.preventDefault();
      setActiveDropStage(null);
      if (!moveEnabled) {
        return;
      }
      const raw = event.dataTransfer.getData("application/x-citius-pipeline-card");
      if (!raw) {
        return;
      }
      const payload = readPipelineDragPayload(raw);
      if (!payload) {
        announce("Could not read the dragged pipeline card.");
        return;
      }
      const item = rows.find((row) => row.id === payload.id);
      if (!item) {
        announce("Pipeline card is out of date. Refresh and try again.");
        return;
      }
      const currentStage = activeOptimisticStages[item.id] ?? pipelineStageForMode(mode, item);
      if (payload.expectedLeadStage !== currentStage) {
        announce("Pipeline card is out of date. Refresh and try again.");
        return;
      }
      if (!isPipelineTargetForMode(mode, stage)) {
        announce(`Cannot drop on ${stage}. Use the required workflow action.`);
        return;
      }
      await handleMove(item, stage, payload.sourceStage);
    };

  return (
    <div className="space-y-4">
      <PipelineModeSelector mode={mode} setMode={setMode} />
      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>
      <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(buckets).map(([stage, items]) => (
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Native drop zones require drag events; cards retain separate native keyboard controls.
          <section
            aria-label={`${stage} stage`}
            className={`min-h-36 rounded-2xl border bg-white p-4 shadow-sm transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] ${
              activeDropStage === stage
                ? "border-citius-blue ring-2 ring-citius-blue/30"
                : "border-brand-border"
            }`}
            key={stage}
            onDragLeave={() =>
              setActiveDropStage((current) => (current === stage ? null : current))
            }
            onDragOver={handleDragOver(stage)}
            onDrop={handleDrop(stage)}
          >
            <h2 className="mb-3 flex items-center justify-between font-heading font-semibold text-citius-blue text-sm">
              {stage}
              <span className="grid size-7 place-items-center rounded-full bg-citius-orange font-bold text-brand-dark text-xs">
                {items.length}
              </span>
            </h2>
            <div className="space-y-2">
              {items.map((item) => {
                const cardStage =
                  activeOptimisticStages[item.id] ??
                  (mode === "sales" ? getPipelineCardStage(item) : getPipelineStage(item));
                const moveTargets =
                  mode === "sales"
                    ? getAllowedSalesPipelineBoardTargets(cardStage)
                    : getAllowedContractingPipelineBoardTargets(cardStage);
                const locked =
                  mode === "sales"
                    ? isSalesPipelineBoardLocked(item)
                    : isContractingPipelineBoardLocked(item);
                const canMove = moveEnabled && !locked && moveTargets.length > 0;
                return (
                  <PipelineCard
                    canMove={canMove}
                    item={item}
                    key={item.id}
                    moveTargets={moveTargets}
                    onMove={handleMove}
                    stage={cardStage}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
