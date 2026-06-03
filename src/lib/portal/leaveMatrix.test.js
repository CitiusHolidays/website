import { describe, expect, test } from "bun:test";
import { leaveAlertToken, LEAVE_MATRIX_ALERT_BY_EMAIL } from "./leaveMatrix.js";

describe("leaveMatrix", () => {
  test("maps known employee emails to alert labels", () => {
    expect(LEAVE_MATRIX_ALERT_BY_EMAIL["aditya@citius.in"]).toBe("Monika");
    expect(LEAVE_MATRIX_ALERT_BY_EMAIL["monika@citius.in"]).toBe("Divyanshu");
  });

  test("normalizes director alerts", () => {
    expect(leaveAlertToken("Directors")).toBe("directors");
    expect(leaveAlertToken("Oliviya")).toBe("olyvia");
  });
});
