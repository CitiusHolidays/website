import { describe, expect, test } from "bun:test";
import { PUBLIC_DESTINATIONS_VERSION } from "@/data/publicDestinations";
import {
  addDestinationToPlan,
  createEmptyDestinationPlan,
  DESTINATION_PLAN_SCHEMA_VERSION,
  DESTINATION_PLAN_STORAGE_KEY,
  type DestinationPlan,
  moveDestinationInPlan,
  prepareDestinationPlanHandoff,
  readDestinationPlan,
  removeDestinationFromPlan,
  resetDestinationPlan,
  saveDestinationPlan,
  serializeDestinationPlan,
} from "./destinationPlan";

const PRIVATE_PLAN_FIELD_PATTERN =
  /clientName|contactEmail|contactMobile|consent|messages|transcript/;

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("browser-local destination plan", () => {
  test("stores only the versioned catalog references and allowlisted typed brief", () => {
    let plan = createEmptyDestinationPlan();
    plan = addDestinationToPlan(plan, "japan");
    plan = addDestinationToPlan(plan, "goa");
    plan = {
      ...plan,
      draft: {
        contactWindow: "evening",
        dateFlexibility: "flexible",
        destination: "Japan, Goa",
        paxCount: 6,
        serviceType: "meetings_events",
        travelStartDate: "2026-12-03",
      },
    };

    const serialized = serializeDestinationPlan(plan);
    expect(JSON.parse(serialized)).toEqual({
      catalogVersion: PUBLIC_DESTINATIONS_VERSION,
      draft: {
        contactWindow: "evening",
        dateFlexibility: "flexible",
        destination: "Japan, Goa",
        paxCount: 6,
        serviceType: "meetings_events",
        travelStartDate: "2026-12-03",
      },
      schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
      shortlist: [
        { id: "japan", name: "Japan", region: "international" },
        { id: "goa", name: "Goa", region: "domestic" },
      ],
    });
    expect(serialized).not.toMatch(PRIVATE_PLAN_FIELD_PATTERN);
  });

  test("migrates the bounded v1 id list only against the current catalog", () => {
    const result = readDestinationPlan(
      JSON.stringify({
        catalogVersion: PUBLIC_DESTINATIONS_VERSION,
        destinationIds: ["japan", "goa"],
        draft: { destination: "Japan and Goa", paxCount: 4 },
        schemaVersion: 1,
      })
    );
    expect(result).toEqual({
      plan: {
        catalogVersion: PUBLIC_DESTINATIONS_VERSION,
        draft: { destination: "Japan and Goa", paxCount: 4 },
        schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
        shortlist: [
          { id: "japan", name: "Japan", region: "international" },
          { id: "goa", name: "Goa", region: "domestic" },
        ],
      },
      status: "migrated",
    });
  });

  test("fails closed when catalog version, id, or stored identity drifts", () => {
    const currentPlan = {
      catalogVersion: PUBLIC_DESTINATIONS_VERSION,
      draft: {},
      schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
      shortlist: [{ id: "japan", name: "Japan", region: "international" }],
    };
    expect(
      readDestinationPlan(JSON.stringify({ ...currentPlan, catalogVersion: "older" }))
    ).toEqual({ status: "catalog-drift" });
    expect(
      readDestinationPlan(
        JSON.stringify({
          ...currentPlan,
          shortlist: [{ id: "retired-destination", name: "Retired", region: "international" }],
        })
      )
    ).toEqual({ status: "catalog-drift" });
    expect(
      readDestinationPlan(
        JSON.stringify({
          ...currentPlan,
          shortlist: [{ id: "japan", name: "Renamed", region: "international" }],
        })
      )
    ).toEqual({ status: "catalog-drift" });
  });

  test("rejects unknown schema fields and never promotes storage into authority", () => {
    const draftWithSensitiveField = { destination: "Japan", medicalNotes: "private" };
    const unsafe = {
      ...createEmptyDestinationPlan(),
      draft: draftWithSensitiveField,
    } satisfies DestinationPlan;
    expect(prepareDestinationPlanHandoff(unsafe)).toEqual({ ok: false, reason: "invalid" });
    expect(
      readDestinationPlan(
        JSON.stringify({ ...createEmptyDestinationPlan(), visitorIdentity: "local-authority" })
      )
    ).toEqual({ status: "invalid" });
  });

  test("deduplicates, caps, reorders, deletes, and resets the exact local key", () => {
    let plan = createEmptyDestinationPlan();
    for (const id of ["japan", "goa", "phuket", "kashmir", "japan"]) {
      plan = addDestinationToPlan(plan, id);
    }
    expect(plan.shortlist.map(({ id }) => id)).toEqual(["japan", "goa", "phuket"]);

    plan = moveDestinationInPlan(plan, "phuket", -1);
    expect(plan.shortlist.map(({ id }) => id)).toEqual(["japan", "phuket", "goa"]);
    expect(plan.shortlist.map(({ name }) => name).join(", ")).toBe("Japan, Phuket, Goa");

    plan = removeDestinationFromPlan(plan, "phuket");
    expect(plan.shortlist.map(({ id }) => id)).toEqual(["japan", "goa"]);

    const storage = memoryStorage();
    saveDestinationPlan(storage, plan);
    storage.setItem("unrelated", "preserve");
    expect(storage.getItem(DESTINATION_PLAN_STORAGE_KEY)).not.toBeNull();
    resetDestinationPlan(storage);
    expect(storage.getItem(DESTINATION_PLAN_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("preserve");
  });
});
