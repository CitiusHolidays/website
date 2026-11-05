import { describe, expect, test } from "bun:test";
import { checkRuleDraft, draftFromRule, parseCoordinates, type RuleDraft } from "./ruleDraft";

const SAVED = {
  enforcementMode: "report_only" as const,
  geofence: { latitude: 18.5204, longitude: 73.8567, maxAccuracyMeters: 75, radiusMeters: 150 },
  networks: [{ cidr: "203.0.113.0/24", kind: "office" as const, label: "Main line" }],
  requirement: "network_and_geofence" as const,
  timeZone: "Asia/Kolkata",
};

function draft(overrides: Partial<RuleDraft> = {}): RuleDraft {
  return { ...draftFromRule(SAVED, "Thane office"), ...overrides };
}

describe("parseCoordinates", () => {
  test("Reads the pair Google Maps copies, with or without a comma", () => {
    expect(parseCoordinates("19.2183687, 72.9705434")).toEqual({
      kind: "ok",
      latitude: 19.218_368_7,
      longitude: 72.970_543_4,
    });
    expect(parseCoordinates("  (19.2183687 72.9705434) ")).toMatchObject({ kind: "ok" });
    expect(parseCoordinates("-33.8688, 151.2093")).toMatchObject({
      kind: "ok",
      latitude: -33.8688,
    });
  });

  test("Reads the pin from a pasted Google Maps link", () => {
    expect(
      parseCoordinates("https://www.google.com/maps/place/Thane/@19.2183687,72.9705434,17z")
    ).toEqual({ kind: "ok", latitude: 19.218_368_7, longitude: 72.970_543_4 });
  });

  test("Spots a pair that can only be the wrong way round and offers the fix", () => {
    expect(parseCoordinates("151.2093, -33.8688")).toEqual({
      kind: "swapped",
      latitude: -33.8688,
      longitude: 151.2093,
    });
  });

  test("Rejects text and numbers that aren't a place", () => {
    expect(parseCoordinates("")).toEqual({ kind: "empty" });
    expect(parseCoordinates("Thane station")).toMatchObject({ kind: "invalid" });
    expect(parseCoordinates("19.21")).toMatchObject({ kind: "invalid" });
    expect(parseCoordinates("200.1, 300.2")).toMatchObject({ kind: "invalid" });
  });
});

describe("checkRuleDraft", () => {
  test("Fills sensible defaults, including an editable reason", () => {
    const fresh = draftFromRule(null, "Thane office");
    expect(fresh).toMatchObject({
      accuracy: "75",
      location: "",
      mode: "report_only",
      radius: "150",
      reason: "Set up Thane office",
      requirement: "",
      timeZone: "Asia/Kolkata",
    });
    expect(draft().reason).toBe("Updated Thane office settings");
    expect(draft().location).toBe("18.5204, 73.8567");
  });

  test("Turns a valid form into the saveRule payload", () => {
    const result = checkRuleDraft(draft({ location: "19.2183687, 72.9705434" }), SAVED);
    expect(result.problems).toEqual([]);
    expect(result.submission).toEqual({
      enforcementMode: "report_only",
      geofence: {
        latitude: 19.218_368_7,
        longitude: 72.970_543_4,
        maxAccuracyMeters: 75,
        radiusMeters: 150,
      },
      networks: SAVED.networks,
      reason: "Updated Thane office settings",
      requirement: "network_and_geofence",
      timeZone: "Asia/Kolkata",
    });
  });

  test("Explains missing and swapped locations in plain words", () => {
    expect(checkRuleDraft(draft({ location: "" }), SAVED).problems).toContain(
      "Paste the office's location from Google Maps."
    );
    expect(checkRuleDraft(draft({ location: "151.2, -33.8" }), SAVED).problems[0]).toContain(
      "Latitude comes first: -33.8, 151.2."
    );
    expect(checkRuleDraft(draft({ requirement: "" }), SAVED).problems).toContain(
      "Choose what this office should check."
    );
  });

  test("Keeps saved settings for a part the chosen check doesn't use", () => {
    const networkOnly = checkRuleDraft(draft({ location: "nonsense", requirement: "network" }), {
      ...SAVED,
      requirement: "network",
    });
    // The hidden location field isn't validated or cleared.
    expect(networkOnly.problems).toEqual([]);
    expect(networkOnly.submission?.geofence).toEqual(SAVED.geofence);

    const locationOnly = checkRuleDraft(
      draft({
        networks: [{ cidr: "junk", key: "x", kind: "office", label: "" }],
        requirement: "geofence",
      }),
      SAVED
    );
    expect(locationOnly.problems).toEqual([]);
    expect(locationOnly.submission?.networks).toEqual(SAVED.networks);
  });

  test("Names an address that isn't one, and needs a reason", () => {
    const result = checkRuleDraft(
      draft({
        networks: [{ cidr: "office wifi", key: "a", kind: "office", label: "Main" }],
        reason: " ",
      }),
      SAVED
    );
    expect(result.submission).toBeNull();
    expect(result.problems[0]).toContain(`"office wifi" isn't an internet address.`);
    expect(result.problems).toContain(
      "Enter a reason of at least 3 characters. It's saved in the audit log."
    );
  });
});
