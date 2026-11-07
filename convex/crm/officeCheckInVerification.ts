/**
 * Pure evaluation of an office check-in against a branch verification rule.
 *
 * Every signal is evidence, never proof. A matched office network says the
 * request left through that network; it does not prove the person sat in the
 * office. A reported location is device-supplied and can be spoofed. The
 * evaluation therefore separates "fail" (the evidence points away from the
 * office) from "uncertain" (the evidence is missing, ambiguous or too weak),
 * and the caller decides admission from the branch's enforcement mode.
 */

export const CHECK_IN_REQUIREMENTS = [
  "network",
  "geofence",
  "network_and_geofence",
  "network_or_geofence",
] as const;
export type CheckInRequirement = (typeof CHECK_IN_REQUIREMENTS)[number];

export const ENFORCEMENT_MODES = ["report_only", "enforce"] as const;
export type EnforcementMode = (typeof ENFORCEMENT_MODES)[number];

export const NETWORK_ENTRY_KINDS = [
  "office",
  "office_shared_with_vpn",
  "vpn_or_proxy_exit",
] as const;
export type NetworkEntryKind = (typeof NETWORK_ENTRY_KINDS)[number];

export const SIGNAL_OUTCOMES = ["pass", "fail", "uncertain"] as const;
export type SignalOutcome = (typeof SIGNAL_OUTCOMES)[number];

/**
 * Where someone says they are working when their clock-in check doesn't
 * place them at the office (owner decision 2026-11-06). The person states it;
 * it is not verified, and it never changes whether the check-in is admitted.
 */
export const AWAY_REASONS = ["on_tour", "market_visit", "out_of_office"] as const;
export type AwayReason = (typeof AWAY_REASONS)[number];

/**
 * A self clock-in asks for an away reason when the office has a rule and the
 * check didn't pass. Without a rule nothing was checked, so nothing is asked.
 */
export function needsAwayReason(checkIn: {
  clockIn: { outcome: SignalOutcome; requirement: CheckInRequirement | "not_configured" };
  source: "manager_entry" | "self";
}) {
  return (
    checkIn.source === "self" &&
    checkIn.clockIn.requirement !== "not_configured" &&
    checkIn.clockIn.outcome !== "pass"
  );
}

export interface NetworkEntry {
  cidr: string;
  kind: NetworkEntryKind;
  label: string;
}

export interface GeofenceRule {
  latitude: number;
  longitude: number;
  maxAccuracyMeters: number;
  radiusMeters: number;
}

export interface BranchRule {
  enforcementMode: EnforcementMode;
  geofence: GeofenceRule | null;
  networks: NetworkEntry[];
  requirement: CheckInRequirement;
}

export type NetworkObservation = { kind: "observed"; ip: string } | { kind: "unavailable" };

export const GEOLOCATION_ERROR_CODES = [
  "permission_denied",
  "position_unavailable",
  "timeout",
  "not_supported",
] as const;
export type GeolocationErrorCode = (typeof GEOLOCATION_ERROR_CODES)[number];

export type LocationReading =
  | {
      accuracyMeters: number;
      capturedAt: number;
      kind: "position";
      latitude: number;
      longitude: number;
    }
  | { code: GeolocationErrorCode; kind: "error" }
  | { kind: "not_requested" };

export const NETWORK_REASONS = [
  "matched_office",
  "shared_with_vpn",
  "vpn_or_proxy_exit",
  "outside_allowlist",
  "ip_unavailable",
  "no_networks_configured",
] as const;
export type NetworkReason = (typeof NETWORK_REASONS)[number];

export const GEOFENCE_REASONS = [
  "inside",
  "outside",
  "boundary_uncertain",
  "accuracy_too_low",
  "stale_reading",
  "invalid_reading",
  "not_provided",
  "no_geofence_configured",
  ...GEOLOCATION_ERROR_CODES,
] as const;
export type GeofenceReason = (typeof GEOFENCE_REASONS)[number];

export interface NetworkResult {
  ipVersion: 4 | 6 | null;
  matchedLabel: string | null;
  observedPrefix: string | null;
  outcome: SignalOutcome;
  reason: NetworkReason;
}

export const DISTANCE_BANDS = ["inside", "near", "far"] as const;
export type DistanceBand = (typeof DISTANCE_BANDS)[number];

export interface GeofenceResult {
  accuracyMeters: number | null;
  distanceBand: DistanceBand | null;
  outcome: SignalOutcome;
  reason: GeofenceReason;
}

export interface CheckInEvaluation {
  admitted: boolean;
  enforcementMode: EnforcementMode;
  geofence: GeofenceResult | null;
  network: NetworkResult | null;
  outcome: SignalOutcome;
  requirement: CheckInRequirement | "not_configured";
  wouldBlock: boolean;
}

/** A reading older than this is treated as stale rather than current. */
export const MAX_LOCATION_AGE_MS = 120_000;
/** Allowed device clock lead over server time before a reading is rejected. */
export const MAX_LOCATION_CLOCK_LEAD_MS = 30_000;
export const MAX_NETWORK_ENTRIES = 32;
export const MAX_NETWORK_LABEL_LENGTH = 60;
/** Office exits are normally a handful of addresses; broader ranges catch whole ISPs. */
export const MIN_IPV4_PREFIX_LENGTH = 22;
export const MIN_IPV6_PREFIX_LENGTH = 48;
export const MIN_GEOFENCE_RADIUS_METERS = 25;
export const MAX_GEOFENCE_RADIUS_METERS = 2000;
export const MIN_ACCURACY_LIMIT_METERS = 10;
export const MAX_ACCURACY_LIMIT_METERS = 500;

// ---------------------------------------------------------------------------
// IP parsing

export interface ParsedIp {
  bytes: number[];
  version: 4 | 6;
}

const IPV4_OCTET = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HEXTET = /^[0-9a-f]{1,4}$/i;

function parseIpv4(text: string): number[] | null {
  const parts = text.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const bytes: number[] = [];
  for (const part of parts) {
    if (!IPV4_OCTET.test(part)) {
      return null;
    }
    bytes.push(Number(part));
  }
  return bytes;
}

function hextetsToBytes(hextets: string[]): number[] | null {
  const bytes: number[] = [];
  for (const hextet of hextets) {
    if (!HEXTET.test(hextet)) {
      return null;
    }
    const value = Number.parseInt(hextet, 16);
    bytes.push(Math.floor(value / 256), value % 256);
  }
  return bytes;
}

function parseIpv6(text: string): number[] | null {
  if (text.includes("%")) {
    return null;
  }
  let head = text;
  let ipv4Tail: number[] = [];
  const lastColon = text.lastIndexOf(":");
  if (text.slice(lastColon + 1).includes(".")) {
    const tail = parseIpv4(text.slice(lastColon + 1));
    if (!tail) {
      return null;
    }
    ipv4Tail = tail;
    head = `${text.slice(0, lastColon + 1)}0:0`;
  }
  const doubleColonParts = head.split("::");
  if (doubleColonParts.length > 2) {
    return null;
  }
  const left = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
  const right =
    doubleColonParts.length === 2 && doubleColonParts[1] ? doubleColonParts[1].split(":") : [];
  const leftBytes = hextetsToBytes(left);
  const rightBytes = hextetsToBytes(right);
  if (!(leftBytes && rightBytes)) {
    return null;
  }
  const explicit = leftBytes.length + rightBytes.length;
  let bytes: number[];
  if (doubleColonParts.length === 2) {
    if (explicit > 14) {
      return null;
    }
    bytes = [...leftBytes, ...Array.from({ length: 16 - explicit }, () => 0), ...rightBytes];
  } else {
    if (explicit !== 16) {
      return null;
    }
    bytes = leftBytes;
  }
  if (ipv4Tail.length === 4) {
    bytes.splice(12, 4, ...ipv4Tail);
  }
  return bytes;
}

const PREFIX_LENGTH = /^\d{1,3}$/;
const IPV4_MAPPED_PREFIX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff];

export function parseIp(raw: string): ParsedIp | null {
  const text = raw.trim();
  if (!text || text.length > 64) {
    return null;
  }
  if (!text.includes(":")) {
    const bytes = parseIpv4(text);
    return bytes ? { bytes, version: 4 } : null;
  }
  const bytes = parseIpv6(text);
  if (!bytes) {
    return null;
  }
  // A prefix test, not an equality test: the 12-byte mapped prefix is compared
  // against the first 12 of 16 bytes, so the lengths differ by design.
  if (IPV4_MAPPED_PREFIX.every((value, index) => bytes[index] === value)) {
    return { bytes: bytes.slice(12), version: 4 };
  }
  return { bytes, version: 6 };
}

export interface ParsedCidr {
  ip: ParsedIp;
  prefixLength: number;
}

export function parseCidr(raw: string): ParsedCidr | null {
  const [address, prefixText, ...rest] = raw.trim().split("/");
  if (rest.length > 0 || address === undefined) {
    return null;
  }
  const ip = parseIp(address);
  if (!ip) {
    return null;
  }
  const maxPrefix = ip.version === 4 ? 32 : 128;
  if (prefixText === undefined) {
    return { ip, prefixLength: maxPrefix };
  }
  if (!PREFIX_LENGTH.test(prefixText)) {
    return null;
  }
  const prefixLength = Number(prefixText);
  if (prefixLength > maxPrefix) {
    return null;
  }
  return { ip, prefixLength };
}

export function cidrContains(cidr: ParsedCidr, ip: ParsedIp) {
  if (cidr.ip.version !== ip.version) {
    return false;
  }
  let remaining = cidr.prefixLength;
  for (let index = 0; remaining > 0; index += 1) {
    const bits = Math.min(8, remaining);
    const ignoredLowValues = 2 ** (8 - bits);
    if (
      Math.floor((cidr.ip.bytes[index] ?? 0) / ignoredLowValues) !==
      Math.floor((ip.bytes[index] ?? 0) / ignoredLowValues)
    ) {
      return false;
    }
    remaining -= bits;
  }
  return true;
}

/**
 * Coarse prefix kept for audit and pilot discovery: /24 for IPv4 and /48 for
 * IPv6. Enough to recognise an office exit range; not a full home address.
 */
export function observedPrefix(ip: ParsedIp) {
  if (ip.version === 4) {
    return `${ip.bytes.slice(0, 3).join(".")}.0/24`;
  }
  const hextets: string[] = [];
  for (let index = 0; index < 6; index += 2) {
    hextets.push(((ip.bytes[index] ?? 0) * 256 + (ip.bytes[index + 1] ?? 0)).toString(16));
  }
  return `${hextets.join(":")}::/48`;
}

// ---------------------------------------------------------------------------
// Signals

export function evaluateNetwork(
  observation: NetworkObservation,
  networks: NetworkEntry[]
): NetworkResult {
  const ip = observation.kind === "observed" ? parseIp(observation.ip) : null;
  const base = {
    ipVersion: ip?.version ?? null,
    matchedLabel: null,
    observedPrefix: ip ? observedPrefix(ip) : null,
  };
  if (!ip) {
    return { ...base, outcome: "uncertain", reason: "ip_unavailable" };
  }
  if (networks.length === 0) {
    return { ...base, outcome: "uncertain", reason: "no_networks_configured" };
  }
  let best: { entry: NetworkEntry; prefixLength: number } | null = null;
  for (const entry of networks) {
    const cidr = parseCidr(entry.cidr);
    if (cidr && cidrContains(cidr, ip) && (!best || cidr.prefixLength > best.prefixLength)) {
      best = { entry, prefixLength: cidr.prefixLength };
    }
  }
  if (!best) {
    return { ...base, outcome: "fail", reason: "outside_allowlist" };
  }
  const matched = { ...base, matchedLabel: best.entry.label };
  switch (best.entry.kind) {
    case "office":
      return { ...matched, outcome: "pass", reason: "matched_office" };
    case "office_shared_with_vpn":
      return { ...matched, outcome: "uncertain", reason: "shared_with_vpn" };
    case "vpn_or_proxy_exit":
      return { ...matched, outcome: "uncertain", reason: "vpn_or_proxy_exit" };
    default:
      return best.entry.kind satisfies never;
  }
}

const EARTH_RADIUS_METERS = 6_371_008.8;

export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

function isLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function roundAccuracy(accuracyMeters: number) {
  return Math.round(accuracyMeters / 5) * 5;
}

function distanceBandFor(distance: number, radiusMeters: number): DistanceBand {
  if (distance <= radiusMeters) {
    return "inside";
  }
  return distance <= radiusMeters * 2 ? "near" : "far";
}

export function evaluateGeofence(
  reading: LocationReading,
  geofence: GeofenceRule | null,
  serverNow: number
): GeofenceResult {
  const none = { accuracyMeters: null, distanceBand: null };
  if (!geofence) {
    return { ...none, outcome: "uncertain", reason: "no_geofence_configured" };
  }
  if (reading.kind === "not_requested") {
    return { ...none, outcome: "uncertain", reason: "not_provided" };
  }
  if (reading.kind === "error") {
    return { ...none, outcome: "uncertain", reason: reading.code };
  }
  if (
    !(
      isLatitude(reading.latitude) &&
      isLongitude(reading.longitude) &&
      Number.isFinite(reading.accuracyMeters) &&
      reading.accuracyMeters > 0 &&
      Number.isFinite(reading.capturedAt)
    )
  ) {
    return { ...none, outcome: "uncertain", reason: "invalid_reading" };
  }
  const accuracyMeters = roundAccuracy(reading.accuracyMeters);
  if (
    serverNow - reading.capturedAt > MAX_LOCATION_AGE_MS ||
    reading.capturedAt - serverNow > MAX_LOCATION_CLOCK_LEAD_MS
  ) {
    return { accuracyMeters, distanceBand: null, outcome: "uncertain", reason: "stale_reading" };
  }
  const distance = distanceMeters(reading, geofence);
  const distanceBand = distanceBandFor(distance, geofence.radiusMeters);
  if (reading.accuracyMeters > geofence.maxAccuracyMeters) {
    return { accuracyMeters, distanceBand, outcome: "uncertain", reason: "accuracy_too_low" };
  }
  if (distance + reading.accuracyMeters <= geofence.radiusMeters) {
    return { accuracyMeters, distanceBand, outcome: "pass", reason: "inside" };
  }
  if (distance - reading.accuracyMeters > geofence.radiusMeters) {
    return { accuracyMeters, distanceBand, outcome: "fail", reason: "outside" };
  }
  return { accuracyMeters, distanceBand, outcome: "uncertain", reason: "boundary_uncertain" };
}

// ---------------------------------------------------------------------------
// Rule

export function requiresNetwork(requirement: CheckInRequirement) {
  return requirement !== "geofence";
}

export function requiresLocation(requirement: CheckInRequirement) {
  return requirement !== "network";
}

function combine(requirement: CheckInRequirement, outcomes: SignalOutcome[]): SignalOutcome {
  if (requirement === "network_or_geofence") {
    if (outcomes.includes("pass")) {
      return "pass";
    }
    return outcomes.includes("uncertain") ? "uncertain" : "fail";
  }
  if (outcomes.includes("fail")) {
    return "fail";
  }
  return outcomes.every((outcome) => outcome === "pass") ? "pass" : "uncertain";
}

/**
 * Evaluates every signal the rule names. The employee never chooses a method:
 * a rule that requires both signals cannot be satisfied by one of them.
 */
export function evaluateCheckIn(input: {
  location: LocationReading;
  network: NetworkObservation;
  rule: BranchRule | null;
  serverNow: number;
}): CheckInEvaluation {
  const { rule } = input;
  if (!rule) {
    return {
      admitted: true,
      enforcementMode: "report_only",
      geofence: null,
      network: null,
      outcome: "uncertain",
      requirement: "not_configured",
      wouldBlock: false,
    };
  }
  const network = requiresNetwork(rule.requirement)
    ? evaluateNetwork(input.network, rule.networks)
    : null;
  const geofence = requiresLocation(rule.requirement)
    ? evaluateGeofence(input.location, rule.geofence, input.serverNow)
    : null;
  const outcomes = [network?.outcome, geofence?.outcome].filter(
    (signal): signal is SignalOutcome => signal !== undefined
  );
  const outcome = combine(rule.requirement, outcomes);
  const wouldBlock = outcome !== "pass";
  return {
    admitted: rule.enforcementMode === "report_only" || !wouldBlock,
    enforcementMode: rule.enforcementMode,
    geofence,
    network,
    outcome,
    requirement: rule.requirement,
    wouldBlock,
  };
}

// ---------------------------------------------------------------------------
// Rule validation (admin input)

function networkProblems(networks: NetworkEntry[]) {
  const problems: string[] = [];
  if (networks.length > MAX_NETWORK_ENTRIES) {
    problems.push(`At most ${MAX_NETWORK_ENTRIES} network entries are allowed.`);
  }
  for (const entry of networks) {
    const cidr = parseCidr(entry.cidr);
    if (!cidr) {
      problems.push(`"${entry.cidr}" is not a valid IPv4 or IPv6 address or CIDR range.`);
    } else if (
      cidr.prefixLength < (cidr.ip.version === 4 ? MIN_IPV4_PREFIX_LENGTH : MIN_IPV6_PREFIX_LENGTH)
    ) {
      problems.push(
        `"${entry.cidr}" is too broad. Use /${MIN_IPV4_PREFIX_LENGTH} or narrower for IPv4 and /${MIN_IPV6_PREFIX_LENGTH} or narrower for IPv6.`
      );
    }
    const label = entry.label.trim();
    if (!label || label.length > MAX_NETWORK_LABEL_LENGTH) {
      problems.push(
        `Network "${entry.cidr}" needs a label of 1 to ${MAX_NETWORK_LABEL_LENGTH} characters.`
      );
    }
  }
  return problems;
}

function within(value: number, min: number, max: number) {
  return value >= min && value <= max;
}

function geofenceProblems(geofence: GeofenceRule) {
  const problems: string[] = [];
  if (!(isLatitude(geofence.latitude) && isLongitude(geofence.longitude))) {
    problems.push("Office coordinates must be a valid latitude and longitude.");
  }
  if (!within(geofence.radiusMeters, MIN_GEOFENCE_RADIUS_METERS, MAX_GEOFENCE_RADIUS_METERS)) {
    problems.push(
      `Radius must be between ${MIN_GEOFENCE_RADIUS_METERS} and ${MAX_GEOFENCE_RADIUS_METERS} metres.`
    );
  }
  if (!within(geofence.maxAccuracyMeters, MIN_ACCURACY_LIMIT_METERS, MAX_ACCURACY_LIMIT_METERS)) {
    problems.push(
      `Accuracy limit must be between ${MIN_ACCURACY_LIMIT_METERS} and ${MAX_ACCURACY_LIMIT_METERS} metres.`
    );
  }
  if (geofence.maxAccuracyMeters >= geofence.radiusMeters) {
    problems.push(
      "Accuracy limit must be smaller than the radius, otherwise no reading can pass inside the fence."
    );
  }
  return problems;
}

export function validateBranchRule(rule: BranchRule): string[] {
  const problems = [
    ...networkProblems(rule.networks),
    ...(rule.geofence ? geofenceProblems(rule.geofence) : []),
  ];
  if (requiresNetwork(rule.requirement) && rule.networks.length === 0) {
    problems.push("This rule checks the office network, so add at least one network range.");
  }
  if (requiresLocation(rule.requirement) && !rule.geofence) {
    problems.push("This rule checks location, so set office coordinates and a radius.");
  }
  const canPassOnNetwork = rule.networks.some((entry) => entry.kind === "office");
  if (
    rule.enforcementMode === "enforce" &&
    rule.requirement !== "geofence" &&
    rule.requirement !== "network_or_geofence" &&
    !canPassOnNetwork
  ) {
    problems.push("Blocking needs at least one office-only network range that can pass.");
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Dates

export const DEFAULT_OFFICE_TIME_ZONE = "Asia/Kolkata";

const workDateFormatters = new Map<string, Intl.DateTimeFormat>();

export function workDateFor(timestamp: number, timeZone = DEFAULT_OFFICE_TIME_ZONE) {
  let formatter = workDateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    });
    workDateFormatters.set(timeZone, formatter);
  }
  return formatter.format(new Date(timestamp));
}
