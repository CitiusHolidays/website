// biome-ignore-all lint/a11y/noNoninteractiveElementInteractions lint/performance/noJsxPropsBind: dnd-kit makes movable article cards keyboard-operable; React Compiler memoizes local Pipeline handlers.
"use client";

import { LayoutGroup, m } from "motion/react";
import {
  type KeyboardEventHandler,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type RefCallback,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { PortalCopyButton } from "@/components/motion-ui/copy-button";
import { useMotionUITransition } from "@/components/motion-ui/ui-theme";
import { Radio, RadioGroup } from "@/components/ui/application-radio";
import { Select } from "@/components/ui/application-select";
import {
  type CollisionDetection,
  CSS,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@/components/ui/foundation/dnd";
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
import { pipelineKeyboardCoordinates } from "./pipelineKeyboardCoordinates";

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

function isPipelineTargetForMode(mode: PipelineMode, stage: string) {
  return mode === "sales"
    ? isSalesPipelineBoardStage(stage)
    : isContractingPipelineBoardStage(stage);
}

interface PipelineModeButtonProps {
  active: boolean;
  buttonRef: RefCallback<HTMLElement>;
  label: string;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
  value: PipelineMode;
}

function PipelineModeButton({
  active,
  buttonRef,
  label,
  onKeyDown,
  value,
}: PipelineModeButtonProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI renders the native radio input inside this full-hit-area label.
    <label className="relative cursor-pointer">
      <Radio
        appearance="hidden"
        aria-label={label}
        data-mode={value}
        onKeyDown={onKeyDown}
        ref={buttonRef}
        tabIndex={active ? 0 : -1}
        value={value}
      />
      <span
        className={`relative flex min-h-11 items-center rounded-full px-4 py-2 font-semibold text-xs peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-citius-blue peer-focus-visible:outline-offset-2 ${
          active ? "text-white" : "text-brand-muted hover:text-citius-blue"
        }`}
      >
        {active ? (
          <span className="absolute inset-0 rounded-full bg-citius-blue ring-2 ring-citius-blue ring-offset-2" />
        ) : null}
        <span className="relative z-10">{label}</span>
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
  const refs = useRef(new Map<PipelineMode, HTMLElement>());
  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    if (!["Home", "End"].includes(event.key)) {
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
    }
    const nextMode = PIPELINE_MODES[nextIndex]?.[0] ?? "sales";
    setMode(nextMode);
    queueMicrotask(() => refs.current.get(nextMode)?.focus());
  };

  return (
    <RadioGroup
      aria-label="Pipeline perspective"
      className="inline-flex rounded-full border border-brand-border bg-white p-1 shadow-sm"
      name="pipeline-perspective"
      onValueChange={setMode}
      value={mode}
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
          value={value}
        />
      ))}
    </RadioGroup>
  );
}

interface PipelineCardProps {
  canMove: boolean;
  item: PipelineRow;
  moveTargets: string[];
  onMove: (item: PipelineRow, targetStage: string) => Promise<void>;
  stage: string;
}

const PIPELINE_INTERACTIVE_DESCENDANT_SELECTOR =
  'a, button, input, select, textarea, [role="button"], [role="combobox"], [contenteditable="true"]';

function isPipelineDragActivatorEvent(event: { currentTarget: EventTarget; target: EventTarget }) {
  if (!(event.target instanceof Element)) {
    return true;
  }
  const interactiveTarget = event.target.closest(PIPELINE_INTERACTIVE_DESCENDANT_SELECTOR);
  return !(interactiveTarget && interactiveTarget !== event.currentTarget);
}

function PipelineCard({ canMove, item, moveTargets, onMove, stage }: PipelineCardProps) {
  const label = item.clientName || "Unnamed client";
  const draggable = canMove && moveTargets.length > 0;
  const cardTransition = useMotionUITransition("ui");
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, isDragging } =
    useDraggable({
      attributes: { role: "group", roleDescription: "draggable pipeline card" },
      data: { label, moveTargets, sourceStage: stage },
      disabled: !draggable,
      id: item.id,
    });

  const setCardRef = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setActivatorNodeRef, setNodeRef]
  );
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || !isPipelineDragActivatorEvent(event)) {
      return;
    }
    listeners?.onPointerDown?.(event);
  };
  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    if (!isPipelineDragActivatorEvent(event)) {
      return;
    }
    listeners?.onTouchStart?.(event);
  };
  const handleDragKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!isPipelineDragActivatorEvent(event)) {
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  return (
    <m.div
      className={`rounded-xl border border-brand-border bg-brand-light p-3 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      layout
      layoutId={`pipeline-card-${item.id}`}
      transition={cardTransition}
    >
      <article
        {...(draggable ? { ...attributes, "aria-pressed": undefined } : {})}
        data-dnd-dragging={isDragging || undefined}
        data-pipeline-card-id={item.id}
        onKeyDown={draggable ? handleDragKeyDown : undefined}
        onPointerDown={draggable ? handlePointerDown : undefined}
        onTouchStart={draggable ? handleTouchStart : undefined}
        ref={setCardRef}
        style={{
          transform: CSS.Translate.toString(transform),
        }}
      >
        <div className="font-semibold text-brand-dark text-sm">{label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-brand-muted text-xs">
          {item.queryCode ? (
            <PortalCopyButton label={item.queryCode} value={item.queryCode} />
          ) : (
            <span>No query code</span>
          )}
          <span>
            {item.destination || "TBD"} - {item.paxCount ?? 0} pax
          </span>
        </div>
        <div className="mt-1 text-brand-muted text-xs">{item.salesOwnerName || "Unassigned"}</div>
        {draggable ? (
          <div className="mt-3 block text-brand-muted text-xs">
            <label className="sr-only" htmlFor={`pipeline-stage-${item.id}`}>
              Move {label} to stage
            </label>
            <span aria-hidden="true">Move to</span>
            <Select
              aria-label={`Move ${label} to stage`}
              className="mt-1 w-full rounded-lg border border-brand-border bg-white px-2 py-1.5 text-brand-dark text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
              id={`pipeline-stage-${item.id}`}
              onValueChange={(targetStage) => {
                if (!targetStage) {
                  return;
                }
                onMove(item, targetStage).catch(() => undefined);
              }}
              options={[
                { label: "Select stage…", value: "" },
                ...moveTargets.map((target) => ({ label: target, value: target })),
              ]}
              value=""
            />
          </div>
        ) : null}
      </article>
    </m.div>
  );
}

function PipelineStage({
  children,
  stage,
  stageIndex,
}: {
  children: ReactNode;
  stage: string;
  stageIndex: number;
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: { stage, stageIndex },
    id: `pipeline-stage:${stage}`,
  });

  return (
    <section
      aria-label={`${stage} stage`}
      className={`min-h-36 rounded-2xl border bg-white p-4 shadow-sm transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] ${
        isOver ? "border-citius-blue ring-2 ring-citius-blue/30" : "border-brand-border"
      }`}
      ref={setNodeRef}
    >
      {children}
    </section>
  );
}

const pipelineCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

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
  const moveInFlight = useRef(new Set<string>());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: pipelineKeyboardCoordinates })
  );

  const salesMoveEnabled = Boolean(
    canMoveSalesPipeline && moveSalesPipelineStage && mode === "sales"
  );
  const contractingMoveEnabled = Boolean(
    canMoveContractingPipeline && moveContractingPipelineStage && mode === "contracting"
  );
  const moveEnabled = salesMoveEnabled || contractingMoveEnabled;

  const activeOptimisticStages = useMemo(() => {
    const active: Record<string, string> = {};
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    for (const [queryId, stage] of Object.entries(optimisticStages)) {
      const row = rowsById.get(queryId);
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

  const handleDndDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!(moveEnabled && over)) {
      return;
    }
    const item = rows.find((row) => row.id === String(active.id));
    if (!item) {
      announce("Pipeline card is out of date. Refresh and try again.");
      return;
    }
    const sourceStage = active.data.current?.sourceStage;
    const targetStage = over.data.current?.stage;
    if (!(typeof sourceStage === "string" && typeof targetStage === "string")) {
      announce("Could not read the dragged pipeline card.");
      return;
    }
    const currentStage = activeOptimisticStages[item.id] ?? pipelineStageForMode(mode, item);
    if (sourceStage !== currentStage) {
      announce("Pipeline card is out of date. Refresh and try again.");
      return;
    }
    if (!isPipelineTargetForMode(mode, targetStage)) {
      announce(`Cannot drop on ${targetStage}. Use the required workflow action.`);
      return;
    }
    await handleMove(item, targetStage, sourceStage);
  };

  return (
    <div className="space-y-4">
      <PipelineModeSelector mode={mode} setMode={setMode} />
      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>
      <DndContext
        collisionDetection={pipelineCollisionDetection}
        onDragEnd={handleDndDragEnd}
        sensors={sensors}
      >
        <LayoutGroup id={`pipeline-${mode}`}>
          <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Object.entries(buckets).map(([stage, items], stageIndex) => (
              <PipelineStage key={stage} stage={stage} stageIndex={stageIndex}>
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
              </PipelineStage>
            ))}
          </div>
        </LayoutGroup>
      </DndContext>
    </div>
  );
}
