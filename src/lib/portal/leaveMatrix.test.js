import { describe, expect, test } from "bun:test";
import { LEAVE_MATRIX_ALERT_BY_EMAIL, leaveAlertToken } from "./leaveMatrix.js";

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
