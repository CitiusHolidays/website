import type { KeyboardCoordinateGetter } from "@/components/ui/foundation/dnd";
import { isRuntimeNumber, isRuntimeString } from "../../../lib/runtimeValues";

interface Coordinates {
  x: number;
  y: number;
}

interface PipelineStageCoordinate {
  centerX: number;
  centerY: number;
  stage: string;
  stageIndex: number;
}

export function getAdjacentPipelineStageCoordinates({
  code,
  currentCoordinates,
  currentStage,
  stages,
}: {
  code: string;
  currentCoordinates: Coordinates;
  currentStage: string;
  stages: PipelineStageCoordinate[];
}): Coordinates | undefined {
  if (code === "ArrowUp" || code === "ArrowDown") {
    return currentCoordinates;
  }
  if (code !== "ArrowLeft" && code !== "ArrowRight") {
    return;
  }

  const orderedStages = [...stages].sort((left, right) => left.stageIndex - right.stageIndex);
  const currentIndex = orderedStages.findIndex(({ stage }) => stage === currentStage);
  if (currentIndex < 0) {
    return currentCoordinates;
  }
  const current = orderedStages[currentIndex];
  const offset = code === "ArrowRight" ? 1 : -1;
  const target =
    orderedStages[Math.max(0, Math.min(orderedStages.length - 1, currentIndex + offset))];
  if (!(current && target)) {
    return currentCoordinates;
  }
  return {
    x: currentCoordinates.x + target.centerX - current.centerX,
    y: currentCoordinates.y + target.centerY - current.centerY,
  };
}

export const pipelineKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates }
) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) {
    return;
  }
  event.preventDefault();

  const activeData = context.active?.data.current;
  const sourceStage = activeData?.sourceStage;
  const overStage = context.over?.data.current?.stage;
  if (!isRuntimeString(sourceStage)) {
    return currentCoordinates;
  }
  const moveTargets = Array.isArray(activeData?.moveTargets)
    ? activeData.moveTargets.filter((stage): stage is string => isRuntimeString(stage))
    : [];
  const reachableStages = new Set([sourceStage, ...moveTargets]);
  const stages = context.droppableContainers
    .getEnabled()
    .flatMap((container): PipelineStageCoordinate[] => {
      const data = container.data.current;
      const rect = context.droppableRects.get(container.id);
      if (
        !(
          data &&
          rect &&
          isRuntimeString(data.stage) &&
          isRuntimeNumber(data.stageIndex) &&
          reachableStages.has(data.stage)
        )
      ) {
        return [];
      }
      return [
        {
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          stage: data.stage,
          stageIndex: data.stageIndex,
        },
      ];
    });

  return getAdjacentPipelineStageCoordinates({
    code: event.code,
    currentCoordinates,
    currentStage: isRuntimeString(overStage) ? overStage : sourceStage,
    stages,
  });
};
