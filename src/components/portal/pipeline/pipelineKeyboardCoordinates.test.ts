import { describe, expect, test } from "bun:test";
import { getAdjacentPipelineStageCoordinates } from "./pipelineKeyboardCoordinates";

const stages = ["Inquiry", "Proposal", "Negotiation", "Confirmation", "Lost"].map(
  (stage, stageIndex) => ({
    centerX: 396 + stageIndex * 224,
    centerY: 420,
    stage,
    stageIndex,
  })
);

describe("Pipeline keyboard stage coordinates", () => {
  test("Moves exactly one visible stage left or right", () => {
    expect(
      getAdjacentPipelineStageCoordinates({
        code: "ArrowRight",
        currentCoordinates: { x: 520, y: 308 },
        currentStage: "Proposal",
        stages,
      })
    ).toEqual({ x: 744, y: 308 });
    expect(
      getAdjacentPipelineStageCoordinates({
        code: "ArrowLeft",
        currentCoordinates: { x: 520, y: 308 },
        currentStage: "Proposal",
        stages,
      })
    ).toEqual({ x: 296, y: 308 });
  });

  test("Follows adjacent stage centers across responsive rows", () => {
    const twoColumnStages = stages.map((stage, stageIndex) => ({
      ...stage,
      centerX: 120 + (stageIndex % 2) * 240,
      centerY: 220 + Math.floor(stageIndex / 2) * 320,
    }));
    expect(
      getAdjacentPipelineStageCoordinates({
        code: "ArrowRight",
        currentCoordinates: { x: 40, y: 300 },
        currentStage: "Proposal",
        stages: twoColumnStages,
      })
    ).toEqual({ x: -200, y: 620 });

    const oneColumnStages = stages.map((stage, stageIndex) => ({
      ...stage,
      centerX: 180,
      centerY: 220 + stageIndex * 320,
    }));
    expect(
      getAdjacentPipelineStageCoordinates({
        code: "ArrowRight",
        currentCoordinates: { x: 40, y: 300 },
        currentStage: "Proposal",
        stages: oneColumnStages,
      })
    ).toEqual({ x: 40, y: 620 });
  });

  test("Keeps vertical arrows in the current stage and clamps at board edges", () => {
    expect(
      getAdjacentPipelineStageCoordinates({
        code: "ArrowDown",
        currentCoordinates: { x: 520, y: 308 },
        currentStage: "Proposal",
        stages,
      })
    ).toEqual({ x: 520, y: 308 });
    expect(
      getAdjacentPipelineStageCoordinates({
        code: "ArrowUp",
        currentCoordinates: { x: 520, y: 308 },
        currentStage: "Proposal",
        stages,
      })
    ).toEqual({ x: 520, y: 308 });
    expect(
      getAdjacentPipelineStageCoordinates({
        code: "ArrowLeft",
        currentCoordinates: { x: 296, y: 308 },
        currentStage: "Inquiry",
        stages,
      })
    ).toEqual({ x: 296, y: 308 });
  });
});
