export function QueryHistoryControls({
  scope,
  onScopeChange,
}: {
  scope: "active" | "lost";
  onScopeChange?: (scope: "active" | "lost") => void;
}) {
  return (
    <div className="space-y-3">
      {onScopeChange ? (
        <fieldset aria-label="Query history" className="flex flex-wrap gap-2">
          <button
            aria-pressed={scope === "active"}
            className={scope === "active" ? "portal-primary-btn" : "portal-outline-btn"}
            onClick={() => onScopeChange("active")}
            type="button"
          >
            Active queries
          </button>
          <button
            aria-pressed={scope === "lost"}
            className={scope === "lost" ? "portal-primary-btn" : "portal-outline-btn"}
            onClick={() => onScopeChange("lost")}
            type="button"
          >
            Lost queries
          </button>
        </fieldset>
      ) : null}
      {scope === "lost" ? (
        <p className="text-brand-muted text-sm">
          Order Lost queries are retained here with their history and files.
        </p>
      ) : null}
    </div>
  );
}
