"use client";

import { Button } from "@/components/ui/application-button";

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

export function getDashboardPeriodPresetId(dateRange) {
  if (!(dateRange?.from || dateRange?.to)) {
    return "all";
  }
  return PRESETS.find(
    (preset) => dateRange?.from === preset.range().from && dateRange?.to === preset.range().to
  )?.id;
}

const PRESET_BUTTON_CLASS =
  "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors";

function PeriodPresetButton({ active, preset, setDateRange }) {
  const selectPreset = () => setDateRange(preset.range());
  return (
    <Button
      className={`${PRESET_BUTTON_CLASS} shrink-0 ${
        active
          ? "border-citius-blue bg-citius-blue text-white"
          : "border-transparent bg-white text-brand-muted hover:text-brand-dark"
      }`}
      onClick={selectPreset}
      type="button"
    >
      {preset.label}
    </Button>
  );
}

export function DashboardPeriodPresets({ dateRange, setDateRange }) {
  const activePresetId = getDashboardPeriodPresetId(dateRange);
  const allTime = activePresetId === "all";
  const selectAllTime = () => setDateRange({ from: null, to: null });

  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-brand-border bg-white p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Button
        className={`${PRESET_BUTTON_CLASS} shrink-0 ${
          allTime
            ? "border-citius-blue bg-citius-blue text-white"
            : "border-transparent bg-white text-brand-muted hover:text-brand-dark"
        }`}
        onClick={selectAllTime}
        type="button"
      >
        All time
      </Button>
      {PRESETS.map((preset) => (
        <PeriodPresetButton
          active={activePresetId === preset.id}
          key={preset.id}
          preset={preset}
          setDateRange={setDateRange}
        />
      ))}
    </div>
  );
}
