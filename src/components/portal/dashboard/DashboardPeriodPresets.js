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
  { id: "30d", label: "30d", range: () => ({ from: daysAgo(30), to: daysAgo(0) }) },
  { id: "mtd", label: "MTD", range: () => ({ from: startOfMonth(), to: daysAgo(0) }) },
];

const PRESET_BUTTON_CLASS =
  "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors";

export function DashboardPeriodPresets({ dateRange, setDateRange }) {
  const active = (preset) =>
    dateRange?.from === preset.range().from && dateRange?.to === preset.range().to;
  const allTime = !(dateRange?.from || dateRange?.to);

  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-brand-border bg-white p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        className={`${PRESET_BUTTON_CLASS} shrink-0 ${
          allTime
            ? "border-citius-blue bg-citius-blue text-white"
            : "border-transparent bg-white text-brand-muted hover:text-brand-dark"
        }`}
        onClick={() => setDateRange({ from: null, to: null })}
        type="button"
      >
        All time
      </button>
      {PRESETS.map((preset) => (
        <button
          className={`${PRESET_BUTTON_CLASS} shrink-0 ${
            active(preset)
              ? "border-citius-blue bg-citius-blue text-white"
              : "border-transparent bg-white text-brand-muted hover:text-brand-dark"
          }`}
          key={preset.id}
          onClick={() => setDateRange(preset.range())}
          type="button"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
