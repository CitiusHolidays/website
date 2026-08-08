import { describe, expect, test } from "bun:test";
import {
  createInMemoryModalCommandAdapter,
  createProductionModalCommandAdapter,
  MODAL_COMMAND_IDS,
} from "./modalCommandAdapter";
import { executeModalCommand } from "./modalCommandExecutor";
import { JOB_CARD_MODALS } from "./modalLifecycle";

describe("deep modal command adapter", () => {
  test("keeps every production domain command inside the compiler-owned command id set", () => {
    const adapter = createProductionModalCommandAdapter({
      administration: {},
      commercial: {},
      operations: {},
      policy: {},
    });
    expect(Object.keys(adapter.commands).sort()).toEqual([...MODAL_COMMAND_IDS].sort());
  });

  test("records the supported domain command at the external executor seam", async () => {
    const mutations = [];
    const { adapter, invocations } = createInMemoryModalCommandAdapter({
      handlers: {
        query: async (form) => mutations.push({ clientName: form.clientName }),
      },
      policy: { has: () => false, jobCardModals: JOB_CARD_MODALS },
    });
    await executeModalCommand({
      adapter,
      form: {
        clientName: "Acme",
        paxCount: "2",
        travelEndDate: "2026-08-10",
        travelStartDate: "2026-08-01",
      },
      modal: "query",
    });
    expect(invocations).toEqual([
      {
        form: expect.objectContaining({ clientName: "Acme" }),
        modal: "query",
      },
    ]);
    expect(mutations).toEqual([{ clientName: "Acme" }]);
  });

  test("validates before invoking an in-memory command", async () => {
    const { adapter, invocations } = createInMemoryModalCommandAdapter({
      policy: { has: () => false, jobCardModals: JOB_CARD_MODALS },
    });
    await expect(
      executeModalCommand({
        adapter,
        form: { fullName: "", jobCardId: "job_1" },
        modal: "traveller",
      })
    ).rejects.toThrow("Traveller name is required.");
    expect(invocations).toEqual([]);
  });
});
