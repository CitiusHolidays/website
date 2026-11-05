import { describe, expect, test } from "bun:test";
import {
  type BranchRule,
  type CheckInRequirement,
  cidrContains,
  distanceMeters,
  type EnforcementMode,
  evaluateCheckIn,
  evaluateGeofence,
  evaluateNetwork,
  GEOLOCATION_ERROR_CODES,
  type GeofenceRule,
  type LocationReading,
  MAX_LOCATION_AGE_MS,
  MAX_LOCATION_CLOCK_LEAD_MS,
  MAX_NETWORK_ENTRIES,
  type NetworkEntry,
  type NetworkObservation,
  type NetworkResult,
  observedPrefix,
  type ParsedCidr,
  type ParsedIp,
  parseCidr,
  parseIp,
  validateBranchRule,
  workDateFor,
} from "./officeCheckInVerification";

// All addresses are documentation ranges (RFC 5737 / RFC 3849) and every
// coordinate is a synthetic office point. No real staff data is used.

/**
 * Independent oracle for geofence distances: on a sphere of the IUGG mean
 * radius (6,371,008.8 m) one degree of latitude along a meridian is
 * 2 * pi * R / 360 = 111,195.080 m (computed with bc at 20 digits). Offsets
 * below move due north, so the
 * expected distance is the meridian arc length, not a haversine replay.
 */
const METERS_PER_DEGREE_LATITUDE = 111_195.08;
const OFFICE = { latitude: 28.6139, longitude: 77.209 };
const FENCE: GeofenceRule = { ...OFFICE, maxAccuracyMeters: 50, radiusMeters: 100 };
const NOW = Date.UTC(2026, 2, 30, 6, 0, 0);

function northOf(meters: number) {
  return OFFICE.latitude + meters / METERS_PER_DEGREE_LATITUDE;
}

function position(
  latitude: number,
  accuracyMeters: number,
  capturedAt = NOW - 5000
): LocationReading {
  return { accuracyMeters, capturedAt, kind: "position", latitude, longitude: OFFICE.longitude };
}

function ip(text: string): ParsedIp {
  const parsed = parseIp(text);
  if (!parsed) {
    throw new Error(`fixture ${text} did not parse`);
  }
  return parsed;
}

function cidr(text: string): ParsedCidr {
  const parsed = parseCidr(text);
  if (!parsed) {
    throw new Error(`fixture ${text} did not parse`);
  }
  return parsed;
}

const OFFICE_LAN: NetworkEntry = { cidr: "203.0.113.0/24", kind: "office", label: "Delhi LAN" };
const SHARED_EXIT: NetworkEntry = {
  cidr: "198.51.100.0/24",
  kind: "office_shared_with_vpn",
  label: "Shared exit",
};
const VPN_EXIT: NetworkEntry = {
  cidr: "192.0.2.0/24",
  kind: "vpn_or_proxy_exit",
  label: "Corp VPN",
};
const OFFICE_V6: NetworkEntry = { cidr: "2001:db8:10::/48", kind: "office", label: "Delhi v6" };

function observed(text: string): NetworkObservation {
  return { ip: text, kind: "observed" };
}

describe("IP parsing", () => {
  test("Parses dotted IPv4 and trims surrounding whitespace", () => {
    expect(parseIp("203.0.113.7")).toEqual({ bytes: [203, 0, 113, 7], version: 4 });
    expect(parseIp("  0.0.0.0 ")).toEqual({ bytes: [0, 0, 0, 0], version: 4 });
    expect(parseIp("255.255.255.255")).toEqual({ bytes: [255, 255, 255, 255], version: 4 });
  });

  test("Rejects malformed IPv4: out-of-range, leading zeros, wrong part count, ports", () => {
    for (const text of [
      "256.1.1.1",
      "1.2.3",
      "1.2.3.4.5",
      "01.2.3.4",
      "1.2.3.-4",
      "1.2.3.4:443",
      "1..3.4",
      "one.two.three.four",
      "",
      "   ",
    ]) {
      expect(parseIp(text)).toBeNull();
    }
  });

  test("Parses full, compressed, loopback and unspecified IPv6 to the same bytes", () => {
    const expected = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0xff, 0x00, 0x00, 0x42, 0x83, 0x29];
    expect(parseIp("2001:0db8:0000:0000:0000:ff00:0042:8329")).toEqual({
      bytes: expected,
      version: 6,
    });
    expect(parseIp("2001:db8::ff00:42:8329")).toEqual({ bytes: expected, version: 6 });
    expect(parseIp("2001:DB8::FF00:42:8329")).toEqual({ bytes: expected, version: 6 });
    expect(parseIp("::1")).toEqual({
      bytes: [...Array.from({ length: 15 }, () => 0), 1],
      version: 6,
    });
    expect(parseIp("::")).toEqual({ bytes: Array.from({ length: 16 }, () => 0), version: 6 });
    expect(parseIp("1:2:3:4:5:6:7::")).toEqual({
      bytes: [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 0],
      version: 6,
    });
  });

  test("Treats IPv4-mapped IPv6 as the IPv4 address, in dotted or hex form", () => {
    expect(parseIp("::ffff:203.0.113.7")).toEqual({ bytes: [203, 0, 113, 7], version: 4 });
    // 0xcb00 0x7107 is 203.0.113.7 written as hextets.
    expect(parseIp("::ffff:cb00:7107")).toEqual({ bytes: [203, 0, 113, 7], version: 4 });
  });

  test("Keeps a non-mapped embedded IPv4 tail as IPv6", () => {
    // RFC 6052 NAT64 well-known prefix is not an IPv4-mapped address.
    expect(parseIp("64:ff9b::203.0.113.7")).toEqual({
      bytes: [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0, 203, 0, 113, 7],
      version: 6,
    });
  });

  test("Rejects malformed IPv6, zone ids, brackets and oversized input", () => {
    for (const text of [
      "2001:db8:::1",
      "1::2::3",
      "2001:db8::g",
      "12345::",
      "1:2:3:4:5:6:7:8:9",
      "1:2:3:4:5:6:7",
      "1:2:3:4:5:6:7:8::",
      "::ffff:1.2.3",
      "::ffff:256.0.0.1",
      "fe80::1%eth0",
      "fe80::1%25en0",
      "[2001:db8::1]",
      `${"1:".repeat(40)}1`,
    ]) {
      expect(parseIp(text)).toBeNull();
    }
  });
});

describe("CIDR parsing and containment", () => {
  test("Parses ranges and treats a bare address as a host route", () => {
    expect(parseCidr("203.0.113.0/24")).toEqual({ ip: ip("203.0.113.0"), prefixLength: 24 });
    expect(parseCidr("203.0.113.9")).toEqual({ ip: ip("203.0.113.9"), prefixLength: 32 });
    expect(parseCidr("2001:db8::/32")).toEqual({ ip: ip("2001:db8::"), prefixLength: 32 });
    expect(parseCidr("2001:db8::1")?.prefixLength).toBe(128);
  });

  test("Rejects prefixes beyond the family width, signs, blanks and extra slashes", () => {
    for (const text of [
      "10.0.0.0/33",
      "2001:db8::/129",
      "10.0.0.0/-1",
      "10.0.0.0/",
      "10.0.0.0/ 24",
      "10.0.0.0/24/1",
      "10.0.0.0/0x10",
      "not-an-ip/24",
    ]) {
      expect(parseCidr(text)).toBeNull();
    }
  });

  test("Matches on byte and non-byte prefix boundaries", () => {
    expect(cidrContains(cidr("203.0.113.0/24"), ip("203.0.113.255"))).toBe(true);
    expect(cidrContains(cidr("203.0.113.0/24"), ip("203.0.114.0"))).toBe(false);
    // 10.0.0.0/12 spans 10.0.0.0 - 10.15.255.255.
    expect(cidrContains(cidr("10.0.0.0/12"), ip("10.15.255.255"))).toBe(true);
    expect(cidrContains(cidr("10.0.0.0/12"), ip("10.16.0.0"))).toBe(false);
    // Host bits in the configured range are masked off.
    expect(cidrContains(cidr("203.0.113.77/24"), ip("203.0.113.1"))).toBe(true);
    expect(cidrContains(cidr("0.0.0.0/0"), ip("198.51.100.1"))).toBe(true);
    expect(cidrContains(cidr("203.0.113.9"), ip("203.0.113.9"))).toBe(true);
    expect(cidrContains(cidr("203.0.113.9"), ip("203.0.113.8"))).toBe(false);
  });

  test("Matches IPv6 ranges and never crosses address families", () => {
    expect(cidrContains(cidr("2001:db8::/32"), ip("2001:db8:ffff::1"))).toBe(true);
    expect(cidrContains(cidr("2001:db8::/32"), ip("2001:db9::1"))).toBe(false);
    // 2001:db8::/127 holds ::0 and ::1 only.
    expect(cidrContains(cidr("2001:db8::/127"), ip("2001:db8::1"))).toBe(true);
    expect(cidrContains(cidr("2001:db8::/127"), ip("2001:db8::2"))).toBe(false);
    expect(cidrContains(cidr("0.0.0.0/0"), ip("2001:db8::1"))).toBe(false);
    expect(cidrContains(cidr("::/0"), ip("203.0.113.1"))).toBe(false);
  });

  test("An IPv4-mapped client address is matched against IPv4 office ranges", () => {
    expect(cidrContains(cidr("203.0.113.0/24"), ip("::ffff:203.0.113.20"))).toBe(true);
  });

  test("Keeps only a /24 or /48 prefix for audit", () => {
    expect(observedPrefix(ip("203.0.113.77"))).toBe("203.0.113.0/24");
    expect(observedPrefix(ip("2001:0db8:abcd:0012::1"))).toBe("2001:db8:abcd::/48");
    expect(observedPrefix(ip("::ffff:198.51.100.9"))).toBe("198.51.100.0/24");
  });
});

describe("Network signal", () => {
  const networks = [OFFICE_LAN, SHARED_EXIT, VPN_EXIT, OFFICE_V6];

  test("An office range passes and records only label, family and coarse prefix", () => {
    expect(evaluateNetwork(observed("203.0.113.42"), networks)).toEqual({
      ipVersion: 4,
      matchedLabel: "Delhi LAN",
      observedPrefix: "203.0.113.0/24",
      outcome: "pass",
      reason: "matched_office",
    });
  });

  test("A range shared with VPN or a known VPN/proxy exit is uncertain, not pass", () => {
    expect(evaluateNetwork(observed("198.51.100.5"), networks)).toMatchObject({
      matchedLabel: "Shared exit",
      outcome: "uncertain",
      reason: "shared_with_vpn",
    });
    expect(evaluateNetwork(observed("192.0.2.5"), networks)).toMatchObject({
      matchedLabel: "Corp VPN",
      outcome: "uncertain",
      reason: "vpn_or_proxy_exit",
    });
  });

  test("An address outside every range fails while keeping the pilot prefix", () => {
    expect(evaluateNetwork(observed("100.64.3.4"), networks)).toEqual({
      ipVersion: 4,
      matchedLabel: null,
      observedPrefix: "100.64.3.0/24",
      outcome: "fail",
      reason: "outside_allowlist",
    });
  });

  test("Missing or unparseable IP evidence is uncertain", () => {
    const missing: NetworkResult = {
      ipVersion: null,
      matchedLabel: null,
      observedPrefix: null,
      outcome: "uncertain",
      reason: "ip_unavailable",
    };
    expect(evaluateNetwork({ kind: "unavailable" }, networks)).toEqual(missing);
    expect(evaluateNetwork(observed("not-an-ip"), networks)).toEqual(missing);
    expect(evaluateNetwork(observed("fe80::1%eth0"), networks)).toEqual(missing);
  });

  test("No configured ranges is uncertain rather than a failure", () => {
    expect(evaluateNetwork(observed("203.0.113.1"), [])).toMatchObject({
      observedPrefix: "203.0.113.0/24",
      outcome: "uncertain",
      reason: "no_networks_configured",
    });
  });

  test("The most specific range wins regardless of list order", () => {
    const carveOut: NetworkEntry = {
      cidr: "203.0.113.128/25",
      kind: "vpn_or_proxy_exit",
      label: "Guest VPN",
    };
    for (const list of [
      [OFFICE_LAN, carveOut],
      [carveOut, OFFICE_LAN],
    ]) {
      expect(evaluateNetwork(observed("203.0.113.200"), list)).toMatchObject({
        matchedLabel: "Guest VPN",
        outcome: "uncertain",
      });
      expect(evaluateNetwork(observed("203.0.113.10"), list)).toMatchObject({
        matchedLabel: "Delhi LAN",
        outcome: "pass",
      });
    }
    const officeHost: NetworkEntry = { cidr: "192.0.2.10", kind: "office", label: "Kiosk" };
    expect(evaluateNetwork(observed("192.0.2.10"), [VPN_EXIT, officeHost])).toMatchObject({
      matchedLabel: "Kiosk",
      outcome: "pass",
    });
  });

  test("IPv6 office ranges pass; IPv4-mapped clients match IPv4 ranges", () => {
    expect(evaluateNetwork(observed("2001:db8:10:1::5"), networks)).toEqual({
      ipVersion: 6,
      matchedLabel: "Delhi v6",
      observedPrefix: "2001:db8:10::/48",
      outcome: "pass",
      reason: "matched_office",
    });
    expect(evaluateNetwork(observed("2001:db8:11::5"), networks)).toMatchObject({
      ipVersion: 6,
      outcome: "fail",
    });
    expect(evaluateNetwork(observed("::ffff:203.0.113.42"), networks)).toMatchObject({
      ipVersion: 4,
      matchedLabel: "Delhi LAN",
      outcome: "pass",
    });
  });

  test("A corrupt stored range is skipped rather than throwing or matching", () => {
    const corrupt: NetworkEntry = { cidr: "203.0.113.0/99", kind: "office", label: "Bad" };
    expect(evaluateNetwork(observed("203.0.113.1"), [corrupt])).toMatchObject({
      outcome: "fail",
      reason: "outside_allowlist",
    });
  });
});

describe("Great-circle distance", () => {
  test("Matches the meridian arc and half circumference on the mean sphere", () => {
    expect(
      distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })
    ).toBeCloseTo(111_195.08, 1);
    expect(
      distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })
    ).toBeCloseTo(111_195.08, 1);
    // pi * 6,371,008.8 m = 20,015,114.44 m
    expect(
      distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })
    ).toBeCloseTo(20_015_114.44, 1);
    expect(distanceMeters(OFFICE, OFFICE)).toBe(0);
  });
});

describe("Geofence signal", () => {
  test("A precise reading well inside the radius passes", () => {
    expect(evaluateGeofence(position(OFFICE.latitude, 20), FENCE, NOW)).toEqual({
      accuracyMeters: 20,
      distanceBand: "inside",
      outcome: "pass",
      reason: "inside",
    });
    // 55.6 m away + 30 m accuracy = 85.6 m <= 100 m
    expect(evaluateGeofence(position(northOf(55.6), 30), FENCE, NOW)).toMatchObject({
      outcome: "pass",
      reason: "inside",
    });
  });

  test("A reading whose accuracy circle is fully outside fails", () => {
    // 333.6 m away, 20 m accuracy: nearest edge 313.6 m > 100 m, beyond 2x radius.
    expect(evaluateGeofence(position(northOf(333.6), 20), FENCE, NOW)).toEqual({
      accuracyMeters: 20,
      distanceBand: "far",
      outcome: "fail",
      reason: "outside",
    });
    // 166.8 m away, 10 m accuracy: outside, within 2x radius.
    expect(evaluateGeofence(position(northOf(166.8), 10), FENCE, NOW)).toMatchObject({
      distanceBand: "near",
      outcome: "fail",
      reason: "outside",
    });
  });

  test("An accuracy circle straddling the boundary is uncertain on either side", () => {
    // 89 m away +/- 30 m: could be 59 m or 119 m from the office.
    expect(evaluateGeofence(position(northOf(89), 30), FENCE, NOW)).toEqual({
      accuracyMeters: 30,
      distanceBand: "inside",
      outcome: "uncertain",
      reason: "boundary_uncertain",
    });
    // 111.2 m away +/- 20 m: could be 91.2 m or 131.2 m.
    expect(evaluateGeofence(position(northOf(111.2), 20), FENCE, NOW)).toMatchObject({
      distanceBand: "near",
      outcome: "uncertain",
      reason: "boundary_uncertain",
    });
    // 90 m away +/- 10 m reaches exactly 100 m: still inside.
    expect(evaluateGeofence(position(northOf(89.9), 10), FENCE, NOW)).toMatchObject({
      outcome: "pass",
    });
  });

  test("Accuracy worse than the branch limit is uncertain even when far away", () => {
    expect(evaluateGeofence(position(OFFICE.latitude, 51), FENCE, NOW)).toEqual({
      accuracyMeters: 50,
      distanceBand: "inside",
      outcome: "uncertain",
      reason: "accuracy_too_low",
    });
    expect(evaluateGeofence(position(northOf(5000), 400), FENCE, NOW)).toMatchObject({
      distanceBand: "far",
      outcome: "uncertain",
      reason: "accuracy_too_low",
    });
    // Exactly at the limit is accepted.
    expect(evaluateGeofence(position(OFFICE.latitude, 50), FENCE, NOW)).toMatchObject({
      outcome: "pass",
    });
  });

  test("Stores accuracy rounded to 5 m", () => {
    expect(evaluateGeofence(position(OFFICE.latitude, 12.4), FENCE, NOW).accuracyMeters).toBe(10);
    expect(evaluateGeofence(position(OFFICE.latitude, 12.5), FENCE, NOW).accuracyMeters).toBe(15);
    // A positive accuracy below 2.5 m is stored as 0 m; a reported 0 m is invalid.
    expect(evaluateGeofence(position(OFFICE.latitude, 2), FENCE, NOW).accuracyMeters).toBe(0);
  });

  test("A stale reading or one from a device clock far ahead is uncertain", () => {
    const stale = position(OFFICE.latitude, 10, NOW - MAX_LOCATION_AGE_MS - 1);
    expect(evaluateGeofence(stale, FENCE, NOW)).toEqual({
      accuracyMeters: 10,
      distanceBand: null,
      outcome: "uncertain",
      reason: "stale_reading",
    });
    expect(
      evaluateGeofence(position(OFFICE.latitude, 10, NOW - MAX_LOCATION_AGE_MS), FENCE, NOW)
    ).toMatchObject({ outcome: "pass" });
    expect(
      evaluateGeofence(
        position(OFFICE.latitude, 10, NOW + MAX_LOCATION_CLOCK_LEAD_MS + 1),
        FENCE,
        NOW
      )
    ).toMatchObject({ outcome: "uncertain", reason: "stale_reading" });
    expect(
      evaluateGeofence(position(OFFICE.latitude, 10, NOW + MAX_LOCATION_CLOCK_LEAD_MS), FENCE, NOW)
    ).toMatchObject({ outcome: "pass" });
    // A stale reading far outside is still uncertain, never fail.
    expect(
      evaluateGeofence(position(northOf(5000), 10, NOW - 10 * 60_000), FENCE, NOW)
    ).toMatchObject({ outcome: "uncertain", reason: "stale_reading" });
  });

  test("Invalid coordinates, accuracy or timestamps are uncertain", () => {
    const base = position(OFFICE.latitude, 10);
    for (const reading of [
      { ...base, latitude: 90.0001 },
      { ...base, latitude: -91 },
      { ...base, longitude: 180.5 },
      { ...base, latitude: Number.NaN },
      { ...base, longitude: Number.POSITIVE_INFINITY },
      { ...base, accuracyMeters: -1 },
      { ...base, accuracyMeters: 0 },
      { ...base, accuracyMeters: -0 },
      { ...base, accuracyMeters: Number.NaN },
      { ...base, accuracyMeters: Number.POSITIVE_INFINITY },
      { ...base, capturedAt: Number.NaN },
    ]) {
      expect(evaluateGeofence(reading, FENCE, NOW)).toEqual({
        accuracyMeters: null,
        distanceBand: null,
        outcome: "uncertain",
        reason: "invalid_reading",
      });
    }
  });

  test("Each browser geolocation failure is uncertain with its own reason", () => {
    expect(GEOLOCATION_ERROR_CODES).toEqual([
      "permission_denied",
      "position_unavailable",
      "timeout",
      "not_supported",
    ]);
    for (const code of GEOLOCATION_ERROR_CODES) {
      expect(evaluateGeofence({ code, kind: "error" }, FENCE, NOW)).toEqual({
        accuracyMeters: null,
        distanceBand: null,
        outcome: "uncertain",
        reason: code,
      });
    }
  });

  test("No reading or no configured fence is uncertain", () => {
    expect(evaluateGeofence({ kind: "not_requested" }, FENCE, NOW)).toMatchObject({
      outcome: "uncertain",
      reason: "not_provided",
    });
    expect(evaluateGeofence(position(OFFICE.latitude, 5), null, NOW)).toMatchObject({
      outcome: "uncertain",
      reason: "no_geofence_configured",
    });
  });
});

const IN_OFFICE_IP = observed("203.0.113.42");
const VPN_IP = observed("192.0.2.42");
const HOME_IP = observed("100.64.3.4");
const IN_FENCE = position(OFFICE.latitude, 10);
const OUT_OF_FENCE = position(northOf(5000), 10);
const NO_LOCATION: LocationReading = { kind: "not_requested" };

function rule(
  requirement: CheckInRequirement,
  enforcementMode: EnforcementMode = "enforce"
): BranchRule {
  return { enforcementMode, geofence: FENCE, networks: [OFFICE_LAN, VPN_EXIT], requirement };
}

function outcome(
  requirement: CheckInRequirement,
  network: NetworkObservation,
  location: LocationReading
) {
  return evaluateCheckIn({ location, network, rule: rule(requirement), serverNow: NOW }).outcome;
}

describe("Rule combination", () => {
  test("Network-only ignores location and geofence-only ignores network", () => {
    const networkOnly = evaluateCheckIn({
      location: OUT_OF_FENCE,
      network: IN_OFFICE_IP,
      rule: rule("network"),
      serverNow: NOW,
    });
    expect(networkOnly).toMatchObject({ geofence: null, outcome: "pass", requirement: "network" });
    const geofenceOnly = evaluateCheckIn({
      location: IN_FENCE,
      network: HOME_IP,
      rule: rule("geofence"),
      serverNow: NOW,
    });
    expect(geofenceOnly).toMatchObject({ network: null, outcome: "pass", requirement: "geofence" });
  });

  test("Both-signals rules are not satisfied by one passing signal", () => {
    expect(outcome("network_and_geofence", IN_OFFICE_IP, IN_FENCE)).toBe("pass");
    expect(outcome("network_and_geofence", IN_OFFICE_IP, NO_LOCATION)).toBe("uncertain");
    expect(outcome("network_and_geofence", IN_OFFICE_IP, { code: "timeout", kind: "error" })).toBe(
      "uncertain"
    );
    expect(outcome("network_and_geofence", VPN_IP, IN_FENCE)).toBe("uncertain");
    expect(outcome("network_and_geofence", IN_OFFICE_IP, OUT_OF_FENCE)).toBe("fail");
    expect(outcome("network_and_geofence", HOME_IP, IN_FENCE)).toBe("fail");
    expect(outcome("network_and_geofence", VPN_IP, OUT_OF_FENCE)).toBe("fail");
  });

  test("Either-signal rules pass on one pass and fail only when both fail", () => {
    expect(outcome("network_or_geofence", IN_OFFICE_IP, OUT_OF_FENCE)).toBe("pass");
    expect(outcome("network_or_geofence", HOME_IP, IN_FENCE)).toBe("pass");
    expect(outcome("network_or_geofence", VPN_IP, OUT_OF_FENCE)).toBe("uncertain");
    expect(outcome("network_or_geofence", VPN_IP, NO_LOCATION)).toBe("uncertain");
    expect(outcome("network_or_geofence", HOME_IP, OUT_OF_FENCE)).toBe("fail");
  });

  test("Single-signal rules mirror their signal", () => {
    expect(outcome("network", HOME_IP, IN_FENCE)).toBe("fail");
    expect(outcome("network", { kind: "unavailable" }, IN_FENCE)).toBe("uncertain");
    expect(outcome("geofence", IN_OFFICE_IP, OUT_OF_FENCE)).toBe("fail");
    expect(outcome("geofence", IN_OFFICE_IP, { code: "permission_denied", kind: "error" })).toBe(
      "uncertain"
    );
  });
});

describe("Admission", () => {
  test("Report-only admits every outcome but records whether it would block", () => {
    for (const [network, expectedOutcome, wouldBlock] of [
      [IN_OFFICE_IP, "pass", false],
      [VPN_IP, "uncertain", true],
      [HOME_IP, "fail", true],
    ] as const) {
      expect(
        evaluateCheckIn({
          location: NO_LOCATION,
          network,
          rule: rule("network", "report_only"),
          serverNow: NOW,
        })
      ).toMatchObject({
        admitted: true,
        enforcementMode: "report_only",
        outcome: expectedOutcome,
        wouldBlock,
      });
    }
  });

  test("Enforce admits only a pass; uncertain is held like fail", () => {
    for (const [network, admitted] of [
      [IN_OFFICE_IP, true],
      [VPN_IP, false],
      [HOME_IP, false],
    ] as const) {
      expect(
        evaluateCheckIn({ location: NO_LOCATION, network, rule: rule("network"), serverNow: NOW })
      ).toMatchObject({ admitted, enforcementMode: "enforce", wouldBlock: !admitted });
    }
  });

  test("No rule is admitted as report-only with nothing evaluated", () => {
    expect(
      evaluateCheckIn({ location: IN_FENCE, network: IN_OFFICE_IP, rule: null, serverNow: NOW })
    ).toEqual({
      admitted: true,
      enforcementMode: "report_only",
      geofence: null,
      network: null,
      outcome: "uncertain",
      requirement: "not_configured",
      wouldBlock: false,
    });
  });
});

describe("Branch rule validation", () => {
  const valid: BranchRule = {
    enforcementMode: "enforce",
    geofence: FENCE,
    networks: [OFFICE_LAN, OFFICE_V6],
    requirement: "network_and_geofence",
  };

  test("Accepts a complete rule", () => {
    expect(validateBranchRule(valid)).toEqual([]);
    expect(
      validateBranchRule({
        ...valid,
        networks: [
          { cidr: "10.20.0.0/22", kind: "office", label: "Edge v4" },
          { cidr: "2001:db8::/48", kind: "office", label: "Edge v6" },
          { cidr: "198.51.100.0/24", kind: "office", label: "Branch v4" },
          { cidr: "2001:db8:20::/56", kind: "office", label: "Branch v6" },
          { cidr: "203.0.113.7", kind: "office", label: "x".repeat(60) },
        ],
      })
    ).toEqual([]);
  });

  test("Rejects invalid, too-broad and unlabelled ranges", () => {
    expect(
      validateBranchRule({
        ...valid,
        networks: [
          OFFICE_LAN,
          { cidr: "203.0.113.0/33", kind: "office", label: "Typo" },
          { cidr: "10.0.0.0/21", kind: "office", label: "Too wide v4" },
          { cidr: "2001:db8::/40", kind: "office", label: "Too wide v6" },
          { cidr: "198.51.100.0/24", kind: "office", label: "   " },
          { cidr: "198.51.100.8", kind: "office", label: "y".repeat(61) },
        ],
      })
    ).toEqual([
      '"203.0.113.0/33" is not a valid IPv4 or IPv6 address or CIDR range.',
      '"10.0.0.0/21" is too broad. Use /22 or narrower for IPv4 and /48 or narrower for IPv6.',
      '"2001:db8::/40" is too broad. Use /22 or narrower for IPv4 and /48 or narrower for IPv6.',
      'Network "198.51.100.0/24" needs a label of 1 to 60 characters.',
      'Network "198.51.100.8" needs a label of 1 to 60 characters.',
    ]);
    // One bit broader than each limit is refused.
    expect(
      validateBranchRule({
        ...valid,
        networks: [
          OFFICE_LAN,
          { cidr: "10.0.0.0/22", kind: "office", label: "Limit v4" },
          { cidr: "2001:db8::/47", kind: "office", label: "Just over v6" },
        ],
      })
    ).toEqual([
      '"2001:db8::/47" is too broad. Use /22 or narrower for IPv4 and /48 or narrower for IPv6.',
    ]);
  });

  test("Caps the number of ranges", () => {
    const networks = Array.from({ length: MAX_NETWORK_ENTRIES + 1 }, (_, index) => ({
      cidr: `10.${index}.0.0/24`,
      kind: "office" as const,
      label: `Range ${index}`,
    }));
    expect(validateBranchRule({ ...valid, networks })).toEqual([
      "At most 32 network entries are allowed.",
    ]);
    expect(
      validateBranchRule({ ...valid, networks: networks.slice(0, MAX_NETWORK_ENTRIES) })
    ).toEqual([]);
  });

  test("Rejects geofence coordinates, radius and accuracy outside policy", () => {
    expect(
      validateBranchRule({
        ...valid,
        geofence: { latitude: 91, longitude: 77, maxAccuracyMeters: 9, radiusMeters: 24 },
      })
    ).toEqual([
      "Office coordinates must be a valid latitude and longitude.",
      "Radius must be between 25 and 2000 metres.",
      "Accuracy limit must be between 10 and 500 metres.",
    ]);
    expect(
      validateBranchRule({
        ...valid,
        geofence: { ...FENCE, maxAccuracyMeters: 501, radiusMeters: 2001 },
      })
    ).toHaveLength(2);
    expect(
      validateBranchRule({ ...valid, geofence: { ...FENCE, radiusMeters: Number.NaN } })
    ).toEqual(["Radius must be between 25 and 2000 metres."]);
    expect(
      validateBranchRule({
        ...valid,
        geofence: { ...FENCE, maxAccuracyMeters: 10, radiusMeters: 25 },
      })
    ).toEqual([]);
    expect(
      validateBranchRule({
        ...valid,
        geofence: { ...FENCE, maxAccuracyMeters: 500, radiusMeters: 2000 },
      })
    ).toEqual([]);
  });

  test("Rejects an accuracy limit that is not smaller than the radius", () => {
    const tooLoose =
      "Accuracy limit must be smaller than the radius, otherwise no reading can pass inside the fence.";
    for (const geofence of [
      { ...FENCE, maxAccuracyMeters: 100, radiusMeters: 100 },
      { ...FENCE, maxAccuracyMeters: 150, radiusMeters: 100 },
      { ...FENCE, maxAccuracyMeters: 25, radiusMeters: 25 },
    ]) {
      expect(validateBranchRule({ ...valid, geofence })).toEqual([tooLoose]);
    }
    expect(
      validateBranchRule({
        ...valid,
        geofence: { ...FENCE, maxAccuracyMeters: 99, radiusMeters: 100 },
      })
    ).toEqual([]);
  });

  test("Requires the evidence each requirement names", () => {
    expect(
      validateBranchRule({
        ...valid,
        enforcementMode: "report_only",
        networks: [],
        requirement: "network",
      })
    ).toEqual(["This rule checks the office network, so add at least one network range."]);
    expect(validateBranchRule({ ...valid, geofence: null, requirement: "geofence" })).toEqual([
      "This rule checks location, so set office coordinates and a radius.",
    ]);
    expect(
      validateBranchRule({
        ...valid,
        geofence: null,
        networks: [],
        requirement: "network_or_geofence",
      })
    ).toEqual([
      "This rule checks the office network, so add at least one network range.",
      "This rule checks location, so set office coordinates and a radius.",
    ]);
  });

  test("Blocking on the network needs an office-only range that can pass", () => {
    expect(
      validateBranchRule({ ...valid, networks: [SHARED_EXIT, VPN_EXIT], requirement: "network" })
    ).toEqual(["Blocking needs at least one office-only network range that can pass."]);
    expect(
      validateBranchRule({
        ...valid,
        networks: [SHARED_EXIT, VPN_EXIT],
        requirement: "network_and_geofence",
      })
    ).toEqual(["Blocking needs at least one office-only network range that can pass."]);
    // Report-only, either-signal and geofence-only rules can still pass.
    expect(
      validateBranchRule({
        ...valid,
        enforcementMode: "report_only",
        networks: [VPN_EXIT],
        requirement: "network",
      })
    ).toEqual([]);
    expect(
      validateBranchRule({ ...valid, networks: [VPN_EXIT], requirement: "network_or_geofence" })
    ).toEqual([]);
    expect(validateBranchRule({ ...valid, networks: [], requirement: "geofence" })).toEqual([]);
  });
});

describe("Work date", () => {
  test("Rolls over at midnight India Standard Time (UTC+05:30)", () => {
    expect(workDateFor(Date.parse("2026-03-30T18:29:59.999Z"))).toBe("2026-03-30");
    expect(workDateFor(Date.parse("2026-03-30T18:30:00.000Z"))).toBe("2026-03-31");
    expect(workDateFor(Date.parse("2026-12-31T18:30:00.000Z"))).toBe("2027-01-01");
    expect(workDateFor(Date.parse("2026-03-29T23:00:00.000Z"))).toBe("2026-03-30");
  });

  test("Honours a branch time zone", () => {
    const instant = Date.parse("2026-03-30T18:30:00.000Z");
    expect(workDateFor(instant, "UTC")).toBe("2026-03-30");
    expect(workDateFor(instant, "Asia/Dubai")).toBe("2026-03-30");
    expect(workDateFor(instant, "Asia/Kolkata")).toBe("2026-03-31");
  });
});
