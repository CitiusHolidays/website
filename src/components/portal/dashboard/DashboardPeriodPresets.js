"use client";

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const PRESETS = [
  { id: "7d", label: "7d", range: () => ({ from: daysAgo(7), to: daysAgo(0) }) },
  { id: "30d", label: "30d", range: () => ({ from: daysAgo(30), to: daysAgo(0) }) },
  { id: "mtd", label: "MTD", range: () => ({ from: startOfMonth(), to: daysAgo(0) }) },
];

export function DashboardPeriodPresets({ dateRange, setDateRange }) {
  const active = (preset) =>
    dateRange?.from === preset.range().from && dateRange?.to === preset.range().to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-brand-muted">Quick period:</span>
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => setDateRange(preset.range())}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            active(preset)
              ? "bg-citius-blue text-white"
              : "border border-brand-border bg-white text-brand-muted hover:text-brand-dark"
          }`}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setDateRange({ from: null, to: null })}
        className="rounded-full px-2.5 py-1 text-xs font-semibold text-brand-muted hover:text-brand-dark"
      >
        All time
      </button>
    </div>
  );
}
