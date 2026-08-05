import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  PaymentReconciliationView,
  paymentMismatchLabel,
  paymentOutcomeLabel,
} from "./PaymentReconciliationView";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/accounts/payment-reconciliation",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
});

afterAll(() => dom.window.close());

const row = {
  amount: 1000,
  bookingId: "booking_1",
  bookingStatus: "confirmed",
  currency: "INR",
  errorMessage: null,
  eventType: "payment.captured",
  expectedStatus: "confirmed",
  id: "razorpay:payment.captured:pay_1",
  isFixture: false,
  mismatchCategory: "status_mismatch",
  orderId: "order_1",
  outcome: "ignored",
  paymentId: "pay_1",
  processedAt: "2026-08-05T12:00:00.000Z",
  provider: "razorpay",
  providerEventId: "razorpay:payment.captured:pay_1",
  receivedAt: "2026-08-05T12:00:00.000Z",
  retryCount: 0,
  source: "webhook",
  statusAfter: "confirmed",
  statusBefore: "confirmed",
  tripId: "trip_1",
  updatedAt: "2026-08-05T12:00:00.000Z",
};

describe("PaymentReconciliationView", () => {
  test("keeps labels explainable for Accounts", () => {
    expect(paymentMismatchLabel("status_mismatch")).toBe("Status mismatch");
    expect(paymentOutcomeLabel("unmatched")).toBe("Needs review");
  });

  test("renders an honest empty production state", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<PaymentReconciliationView />));

    expect(container.textContent).toContain("No production payment events yet");
    expect(container.textContent).not.toContain("test fixtures");
    await act(async () => root.unmount());
    container.remove();
  });

  test("renders fixture labels and only offers safe reprocess with a reason", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onRequestReprocess = async () => {};
    await act(async () =>
      root.render(
        <PaymentReconciliationView
          dataMode="fixtures"
          fixtureModeAllowed
          fixtureRowCount={1}
          onRequestReprocess={onRequestReprocess}
          rows={[{ ...row, isFixture: true, source: "fixture" }]}
        />
      )
    );

    expect(container.textContent).toContain("test fixtures");
    expect(container.textContent).toContain("Status mismatch");
    expect(container.textContent).toContain("cannot be reprocessed as customer payments");
    expect(container.querySelector("form")).toBeNull();
    await act(async () => root.unmount());
    container.remove();
  });

  test("shows a reason field before offering a production safe reprocess", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(<PaymentReconciliationView onRequestReprocess={async () => {}} rows={[row]} />)
    );
    const eventButton = container.querySelector("tbody button");
    await act(async () =>
      eventButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
    );
    expect(container.querySelector('input[placeholder="Explain what was checked"]')).not.toBeNull();
    expect(container.textContent).toContain("Request safe reprocess");
    await act(async () => root.unmount());
    container.remove();
  });
});
