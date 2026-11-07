import { describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { Doc } from "../../_generated/dataModel";
import { decodePhaseCursor, encodePhaseCursor, nextPhaseCursor } from "./retentionRun";
import {
  jobCardTripEndDate,
  officeDateBefore,
  retentionCutoff,
  tripEndDate,
  tripRetentionVerdict,
} from "./retentionSchedule";

const job = (dates: Partial<Doc<"jobCards">>) => fromPartial<Doc<"jobCards">>(dates);
const batch = (dates: Partial<Doc<"travelBatches">>) => fromPartial<Doc<"travelBatches">>(dates);

describe("retention schedule", () => {
  test("counts periods in office dates (IST), not UTC", () => {
    // 20:00 UTC on 6 Nov is already 01:30 IST on 7 Nov.
    expect(retentionCutoff(Date.parse("2026-11-06T20:00:00Z"), { days: 365 })).toEqual({
      date: "2025-11-07",
      startMs: Date.parse("2025-11-07T00:00:00+05:30"),
    });
    expect(retentionCutoff(Date.parse("2026-11-07T06:00:00Z"), { years: 3 }).date).toBe(
      "2023-11-07"
    );
  });

  test("moves 29 February back a year to 28 February", () => {
    expect(officeDateBefore("2028-02-29", { years: 1 })).toBe("2027-02-28");
    expect(officeDateBefore("2026-03-01", { days: 90 })).toBe("2025-12-01");
  });

  test("ends a trip on its end date, else its start date, and never on bad data", () => {
    expect(tripEndDate({ travelEndDate: "2026-05-05", travelStartDate: "2026-05-01" })).toBe(
      "2026-05-05"
    );
    expect(tripEndDate({ travelStartDate: "2026-05-01" })).toBe("2026-05-01");
    // An end before the start keeps the later date.
    expect(tripEndDate({ travelEndDate: "2026-04-01", travelStartDate: "2026-05-01" })).toBe(
      "2026-05-01"
    );
    expect(tripEndDate({ travelEndDate: "2026-02-30" })).toBeNull();
    expect(tripEndDate({})).toBeNull();
  });

  test("a whole Job Card ends with its latest batch and is undated if any batch is", () => {
    const card = job({ travelEndDate: "2026-01-10", travelStartDate: "2026-01-01" });
    expect(
      jobCardTripEndDate(card, [
        batch({ travelEndDate: "2026-03-01", travelStartDate: "2026-02-20" }),
        // No start date: the batch uses the Job Card's dates.
        batch({ travelEndDate: "2027-01-01" }),
      ])
    ).toBe("2026-03-01");
    expect(jobCardTripEndDate(card, [])).toBe("2026-01-10");
    expect(jobCardTripEndDate(job({}), [batch({ travelStartDate: "2026-02-20" })])).toBe(
      "2026-02-20"
    );
    expect(jobCardTripEndDate(job({}), [batch({}), batch({ travelStartDate: "2026-02-20" })])).toBe(
      null
    );
  });

  test("keeps the trip's last kept day and anything undated", () => {
    const cutoff = { date: "2026-08-09", startMs: 0 };
    expect(tripRetentionVerdict("2026-08-08", cutoff)).toBe("expired");
    expect(tripRetentionVerdict("2026-08-09", cutoff)).toBe("kept_trip_recent");
    expect(tripRetentionVerdict(null, cutoff)).toBe("kept_undated");
  });
});

describe("phased retention cursors", () => {
  const phases = ["pending", "dismissed"] as const;

  test("round-trips page cursors and starts at the first phase", () => {
    expect(decodePhaseCursor(null, phases)).toEqual({ cursor: null, phase: "pending" });
    expect(decodePhaseCursor(encodePhaseCursor("dismissed", "abc:def"), phases)).toEqual({
      cursor: "abc:def",
      phase: "dismissed",
    });
    expect(decodePhaseCursor(encodePhaseCursor("dismissed", null), phases)).toEqual({
      cursor: null,
      phase: "dismissed",
    });
    expect(() => decodePhaseCursor("converted:", phases)).toThrow("Invalid retention cursor");
  });

  test("moves to the next phase when a phase is done and stops after the last", () => {
    expect(nextPhaseCursor(phases, "pending", { continueCursor: "x", isDone: false })).toBe(
      "pending:x"
    );
    expect(nextPhaseCursor(phases, "pending", { continueCursor: "x", isDone: true })).toBe(
      "dismissed:"
    );
    expect(nextPhaseCursor(phases, "dismissed", { continueCursor: "x", isDone: true })).toBeNull();
  });
});
