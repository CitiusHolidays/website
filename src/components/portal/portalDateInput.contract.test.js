import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getFilterDateRangeError, resolveDateRange } from "@/lib/portal/periodFilter";

const MOBILE_BREAKPOINT_PX = 767;
const MOBILE_VIEWPORT_PX = 390;

const GLOBALS_CSS = "src/app/globals.css";
const DATE_INPUT_FILE = "src/components/portal/PortalDateInput.js";
const DATE_RANGE_FILTER_FILE = "src/components/portal/PortalDateRangeFilter.js";
const DASHBOARD_PERIOD_FILE = "src/components/portal/dashboard/DashboardPeriodControls.js";
const LIST_TOOLBAR_FILE = "src/components/portal/PortalListToolbar.js";
const MODAL_FORM_FILE = "src/components/portal/PortalModalForm.js";

function read(file) {
  return readFileSync(file, "utf8");
}

function mobileInputRuleBlock(css) {
  const match = css.match(
    /@media \(max-width: 767px\) \{[\s\S]*?input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\),[\s\S]*?font-size: 1rem !important;[\s\S]*?\}/
  );
  return match?.[0] ?? "";
}

describe("portal date input contract", () => {
  test("mobile CSS rule targets text and native date inputs at a 390px-equivalent breakpoint", () => {
    const css = read(GLOBALS_CSS);
    const rule = mobileInputRuleBlock(css);

    expect(MOBILE_VIEWPORT_PX).toBeLessThanOrEqual(MOBILE_BREAKPOINT_PX);
    expect(rule).toContain("@media (max-width: 767px)");
    expect(rule).toContain('input:not([type="checkbox"]):not([type="radio"]):not([type="range"])');
    expect(rule).toContain("font-size: 1rem !important");
    expect(rule).not.toContain('[type="date"]');
  });

  test("PortalDateInput keeps text-sm on the visible field for desktop sizing", () => {
    const source = read(DATE_INPUT_FILE);

    expect(source).toContain("text-sm");
    expect(source).toMatch(/const BASE_CLASS[\s\S]*text-sm/);
    expect(source).toContain("onChange(event.target.value)");
  });

  test("list range, dashboard period, and modal date fields route through PortalDateInput", () => {
    const rangeFilter = read(DATE_RANGE_FILTER_FILE);
    const dashboardPeriod = read(DASHBOARD_PERIOD_FILE);
    const listToolbar = read(LIST_TOOLBAR_FILE);
    const modalForm = read(MODAL_FORM_FILE);

    expect(rangeFilter).toContain(
      'import { PortalDateInput } from "@/components/portal/PortalDateInput"'
    );
    expect(rangeFilter).toContain("<PortalDateInput");
    expect(dashboardPeriod).toContain(
      'import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter"'
    );
    expect(dashboardPeriod).toContain("<PortalDateRangeFilter");
    expect(listToolbar).toContain(
      'import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter"'
    );
    expect(listToolbar).toContain("<PortalDateRangeFilter");
    expect(modalForm).toContain(
      'import { PortalDateInput } from "@/components/portal/PortalDateInput"'
    );
    expect(modalForm).toMatch(/type === "date"[\s\S]*<PortalDateInput/);
  });

  test("date range toolbar controls use non-shrinking fixed-width geometry", () => {
    const rangeFilter = read(DATE_RANGE_FILTER_FILE);
    const listToolbar = read(LIST_TOOLBAR_FILE);

    expect(rangeFilter).toContain("flex flex-nowrap");
    expect(rangeFilter).toContain("shrink-0");
    expect(rangeFilter).toContain("!w-[9.5rem]");
    expect(rangeFilter).toContain("!min-w-[9.5rem]");
    expect(rangeFilter).toContain("!max-w-[9.5rem]");
    expect(rangeFilter).toMatch(/portal-small-btn shrink-0 whitespace-nowrap/);
    expect(listToolbar).toContain("shrink-0 flex-wrap");
    expect(listToolbar).toMatch(/portal-small-btn h-11 shrink-0 whitespace-nowrap/);
  });

  test("inverted ranges stay invalid and skip resolved filtering via shared period contracts", () => {
    const inverted = { from: "2026-03-31", to: "2026-03-01" };

    expect(getFilterDateRangeError(inverted)).toBe("From must be on or before To.");
    expect(resolveDateRange(inverted)).toBeNull();
  });
});
