import { afterEach, describe, expect, mock, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import { deliverJourneyReminder } from "./customerJourneyReminders";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SENT_API_KEY;
  delete process.env.SENT_JOURNEY_REMINDER_RCS_TEMPLATE_ID;
  delete process.env.SENT_JOURNEY_REMINDER_WHATSAPP_TEMPLATE_ID;
});

describe("Customer journey reminder final effect boundary", () => {
  for (const channel of ["whatsapp", "rcs"] as const) {
    test(`suppresses ${channel} before any Sent provider request when paused`, async () => {
      process.env.SENT_API_KEY = "test-key-never-sent";
      process.env.SENT_JOURNEY_REMINDER_RCS_TEMPLATE_ID = "test-rcs-template";
      process.env.SENT_JOURNEY_REMINDER_WHATSAPP_TEMPLATE_ID = "test-whatsapp-template";
      const fetchMock = mock(() => Promise.reject(new Error("Provider must not be called")));
      globalThis.fetch = fetchMock;
      const mutationCalls: Array<{ deliveryId: string }> = [];
      const ctx = {
        runMutation: (_reference: FunctionReference<"mutation">, args: { deliveryId: string }) => {
          mutationCalls.push(args);
          if (mutationCalls.length === 1) {
            return Promise.resolve({
              channel,
              idempotencyKey: `reminder-${channel}`,
              phoneE164: "+15555550123",
            });
          }
          return Promise.resolve(null);
        },
      };

      await fromAny<any, unknown>(deliverJourneyReminder)._handler(ctx, {
        deliveryId: "customerJourneyReminderDeliveries_1",
      });

      expect(mutationCalls).toEqual([
        { deliveryId: "customerJourneyReminderDeliveries_1" },
        { deliveryId: "customerJourneyReminderDeliveries_1" },
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }
});
