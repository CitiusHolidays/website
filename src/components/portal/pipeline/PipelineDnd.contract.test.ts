import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const PIPELINE_SOURCE = readFileSync("src/components/portal/pipeline/PipelineView.tsx", "utf8");
const NATIVE_DRAG_ATTRIBUTE_PATTERN = /\sdraggable=\{/;
const PIPELINE_LAYOUT_GROUP_PATTERN = /pipeline-\$\{mode\}/;
const PIPELINE_LAYOUT_ID_PATTERN = /pipeline-card-\$\{item\.id\}/;

describe("Pipeline dnd-kit ownership", () => {
  test("installs pointer, touch, and keyboard sensors through the code-owned boundary", () => {
    expect(PIPELINE_SOURCE).toContain('from "@/components/ui/foundation/dnd"');
    expect(PIPELINE_SOURCE).toContain("useSensor(PointerSensor");
    expect(PIPELINE_SOURCE).toContain("useSensor(TouchSensor");
    expect(PIPELINE_SOURCE).toContain("useSensor(KeyboardSensor");
    expect(PIPELINE_SOURCE).toContain("coordinateGetter: pipelineKeyboardCoordinates");
    expect(PIPELINE_SOURCE).not.toContain("sortableKeyboardCoordinates");
    expect(PIPELINE_SOURCE).toContain("useSensors(");
  });

  test("renders drag translation without scaling a card to its stage", () => {
    expect(PIPELINE_SOURCE).toContain("CSS.Translate.toString(transform)");
    expect(PIPELINE_SOURCE).not.toContain("CSS.Transform.toString(transform)");
  });

  test("keeps interruptible settling for small boards and bounds it before full pages", () => {
    expect(PIPELINE_SOURCE).toContain("<LayoutGroup id=");
    expect(PIPELINE_SOURCE).toMatch(PIPELINE_LAYOUT_GROUP_PATTERN);
    expect(PIPELINE_SOURCE).toContain("PIPELINE_SHARED_LAYOUT_CARD_LIMIT = 40");
    expect(PIPELINE_SOURCE).toContain("shouldUsePipelineSharedLayout(rows.length)");
    expect(PIPELINE_SOURCE).toContain('data-pipeline-layout={sharedLayout ? "shared" : "bounded"}');
    expect(PIPELINE_SOURCE).toContain("layout={sharedLayout}");
    expect(PIPELINE_SOURCE).toMatch(PIPELINE_LAYOUT_ID_PATTERN);
  });

  test("keeps dnd-kit private to Pipeline and retires native drag transfer ownership", () => {
    expect(PIPELINE_SOURCE).toContain("<DndContext");
    expect(PIPELINE_SOURCE).toContain("useDraggable(");
    expect(PIPELINE_SOURCE).toContain("useDroppable(");
    expect(PIPELINE_SOURCE).not.toContain("dataTransfer");
    expect(PIPELINE_SOURCE).not.toMatch(NATIVE_DRAG_ATTRIBUTE_PATTERN);
  });

  test("retains the explicit Select fallback and shared move validator", () => {
    expect(PIPELINE_SOURCE).toContain("<Select");
    expect(PIPELINE_SOURCE).toContain("isPipelineDragActivatorEvent");
    expect(PIPELINE_SOURCE).toContain('event.pointerType === "touch"');
    expect(PIPELINE_SOURCE).not.toContain("touchAction:");
    expect(PIPELINE_SOURCE).toContain("pipelineMoveValidationMessage({");
    expect(PIPELINE_SOURCE).toContain("await handleMove(item, targetStage, sourceStage)");
  });
});
