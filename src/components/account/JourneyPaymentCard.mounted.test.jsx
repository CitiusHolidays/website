import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JourneyPaymentCard } from "./AccountJourneysPanel";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(() => dom.window.close());

async function render(props) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<JourneyPaymentCard {...props} />);
    await Promise.resolve();
  });
  return { container, root };
}

const paidBooking = { currency: "INR", status: "confirmed", totalAmount: 12_500_000 };

describe("Journey payment and invoice card", () => {
  test("offers the issued invoice as a PDF download next to the amount paid", async () => {
    const { container, root } = await render({
      booking: paidBooking,
      invoice: {
        downloadPath: "/api/account/journeys/booking_1/invoice",
        invoiceNumber: "WEB/2627/00001",
        issuedAt: "2026-11-07T04:00:00.000Z",
        status: "issued",
      },
    });
    const facts = [...container.querySelectorAll("dl > div")].map((row) => [
      row.querySelector("dt")?.textContent,
      row.querySelector("dd")?.textContent,
    ]);
    expect(facts).toEqual([
      ["Amount paid", "₹1,25,000.00"],
      ["Payment", "Received"],
      ["Tax invoice", "WEB/2627/00001"],
    ]);
    const link = container.querySelector("a");
    expect(link?.textContent).toBe("Download tax invoice (PDF)");
    expect(link?.getAttribute("href")).toBe("/api/account/journeys/booking_1/invoice");
    expect(link?.hasAttribute("download")).toBe(true);
    act(() => root.unmount());
  });

  test("says the invoice is being prepared and offers no download until it is issued", async () => {
    const { container, root } = await render({
      booking: paidBooking,
      invoice: { status: "preparing" },
    });
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Being prepared");
    expect(container.textContent).toContain("We will email you when your GST tax invoice is ready");
    act(() => root.unmount());
  });

  test("shows a refunded booking as refunded", async () => {
    const { container, root } = await render({
      booking: { ...paidBooking, status: "refunded" },
      invoice: { status: "preparing" },
    });
    expect(container.textContent).toContain("Refunded");
    act(() => root.unmount());
  });

  test("renders nothing for a booking that was never paid", async () => {
    const { container, root } = await render({
      booking: { ...paidBooking, status: "pending" },
      invoice: undefined,
    });
    expect(container.innerHTML).toBe("");
    act(() => root.unmount());
  });
});
