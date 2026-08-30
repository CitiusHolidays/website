import type { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type BackendOperationalControlRow = FunctionReturnType<
  typeof api.crm.settings.listOperationalControls
>[number];
type UndefinedKeys<Value> = {
  [Key in keyof Value]-?: undefined extends Value[Key] ? Key : never;
}[keyof Value];
type OptionalizeUndefined<Value> = Omit<Value, UndefinedKeys<Value>> &
  Partial<Pick<Value, UndefinedKeys<Value>>>;

export type OperationalControlKey = BackendOperationalControlRow["key"];
export type OperationalControlRow = OptionalizeUndefined<BackendOperationalControlRow>;
export type ConfiguredControlState = BackendOperationalControlRow["configuredState"];
export type RestorationChoice = "none" | "30m" | "2h" | "24h";
export type ControlStatusFilter = "all" | "blocked" | "changed" | "paused" | "temporary";

export type OperationalTargetIdentity = FunctionReturnType<
  typeof api.crm.settings.getOperationalControlTargetIdentity
>;
export type OperationalCutoverPreview = FunctionReturnType<
  typeof api.crm.settings.previewOperationalCutover
>;
export type RuntimeHealthSnapshot = FunctionReturnType<typeof api.crm.settings.getRuntimeHealth>;
export type RuntimeHealthItem = RuntimeHealthSnapshot["projections"][number];
export type RuntimeHealthStatus = RuntimeHealthItem["status"];

export type ProductionTestRecipe = FunctionReturnType<
  typeof api.crm.productionTestLab.listRecipes
>[number];
export type ProductionTestRecipeId = ProductionTestRecipe["id"];
type BackendProductionTestRun = FunctionReturnType<
  typeof api.crm.productionTestLab.listRuns
>["page"][number];
export type ProductionTestRun = OptionalizeUndefined<
  Omit<BackendProductionTestRun, "_creationTime" | "actorId" | "commandId">
>;
export type ProductionTestResult = NonNullable<BackendProductionTestRun["results"]>[number];

type BackendOperationalChangeSet = FunctionReturnType<
  typeof api.crm.settings.listOperationalChangeSets
>["page"][number];
export type OperationalChangeSet = OptionalizeUndefined<
  Omit<BackendOperationalChangeSet, "_creationTime">
>;
export type PersistedControlState = OperationalChangeSet["changes"][number]["after"]["state"];
export type StoredControlState = OperationalChangeSet["changes"][number]["before"]["state"];

export type AiExperienceHealth = RuntimeHealthSnapshot["aiExperiences"][number];
export type AuthEmailHealthSnapshot = FunctionReturnType<
  typeof api.authEmailDeliveries.getDeliveryHealth
>;

type BackendOperationalAuditEvent = FunctionReturnType<
  typeof api.crm.settings.listOperationalControlAudit
>["page"][number];
export type OperationalAuditEvent = OptionalizeUndefined<
  Omit<BackendOperationalAuditEvent, "_creationTime" | "actorId" | "revision">
>;

export function isControlStatusFilter(value: string): value is ControlStatusFilter {
  return ["all", "blocked", "changed", "paused", "temporary"].includes(value);
}

export function isRestorationChoice(value: string): value is RestorationChoice {
  return ["none", "30m", "2h", "24h"].includes(value);
}

export function isExactAdmin(access?: { roles?: string[]; staffId?: string }) {
  return Boolean(access?.staffId && access.roles?.includes("Admin"));
}

export function restorationDelayMsFor(choice: RestorationChoice) {
  const milliseconds = {
    "2h": 2 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    none: 0,
  }[choice];
  return milliseconds === 0 ? null : milliseconds;
}

export function persistedStateForConfiguredState(state: ConfiguredControlState) {
  switch (state) {
    case "available":
      return "enabled" as const;
    case "paused":
      return "disabled" as const;
    default:
      return "default" as const;
  }
}

export function filterOperationalControls(
  controls: readonly OperationalControlRow[],
  staged: ReadonlyMap<OperationalControlKey, PersistedControlState>,
  search: string,
  filter: ControlStatusFilter
) {
  const query = search.trim().toLowerCase();
  return controls.filter((control) => {
    const matchesSearch =
      query.length === 0 ||
      `${control.label} ${control.description} ${control.category}`.toLowerCase().includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "blocked" && control.blockedBy.length > 0) ||
      (filter === "changed" && staged.has(control.key)) ||
      (filter === "temporary" && control.expiresAt !== undefined) ||
      (filter === "paused" &&
        (staged.get(control.key) === "disabled" ||
          (!staged.has(control.key) && control.configuredState === "paused")));
    return matchesSearch && matchesFilter;
  });
}
