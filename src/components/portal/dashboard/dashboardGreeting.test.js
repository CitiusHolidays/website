import { describe, expect, test } from "bun:test";
import { getDashboardGreeting } from "./dashboardGreeting.js";

describe("getDashboardGreeting", () => {
  test("returns morning greeting before noon", () => {
    const now = new Date(2026, 6, 5, 9, 0, 0);
    expect(getDashboardGreeting({ now })).toBe("Good morning");
    expect(getDashboardGreeting({ displayName: "Jane Doe", now })).toBe("Good morning, Jane");
  });

  test("returns afternoon greeting from noon through 4pm", () => {
    const noon = new Date(2026, 6, 5, 12, 0, 0);
    const lateAfternoon = new Date(2026, 6, 5, 16, 0, 0);
    expect(getDashboardGreeting({ now: noon })).toBe("Good afternoon");
    expect(getDashboardGreeting({ displayName: "Jane Doe", now: noon })).toBe(
      "Good afternoon, Jane"
    );
    expect(getDashboardGreeting({ now: lateAfternoon })).toBe("Good afternoon");
  });

  test("returns evening greeting from 5pm onward", () => {
    const evening = new Date(2026, 6, 5, 17, 0, 0);
    const night = new Date(2026, 6, 5, 22, 0, 0);
    expect(getDashboardGreeting({ now: evening })).toBe("Good evening");
    expect(getDashboardGreeting({ displayName: "Jane Doe", now: evening })).toBe(
      "Good evening, Jane"
    );
    expect(getDashboardGreeting({ now: night })).toBe("Good evening");
  });
});
