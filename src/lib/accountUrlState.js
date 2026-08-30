const ACCOUNT_TABS = Object.freeze(["journeys", "profile", "settings"]);
export const ACCOUNT_JOURNEY_KEY_PATTERN = /^j_[A-Za-z0-9_-]{22}$/;

const ACCOUNT_TAB_SET = new Set(ACCOUNT_TABS);
const ACCOUNT_URL_KEYS = new Set(["journey", "portal", "tab"]);

function valuesFor(searchParams, name) {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.getAll(name);
  }
  const value = searchParams?.[name];
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [value];
}

function keysFor(searchParams) {
  if (searchParams instanceof URLSearchParams) {
    return [...new Set(searchParams.keys())];
  }
  return Object.keys(searchParams || {});
}

/** Parse only the public Account URL contract. Browser values never grant access. */
export function parseAccountUrlState(searchParams) {
  const tabValues = valuesFor(searchParams, "tab");
  const journeyValues = valuesFor(searchParams, "journey");
  const portalValues = valuesFor(searchParams, "portal");
  const [rawTab] = tabValues;
  const [rawJourneyKey] = journeyValues;
  const tab = ACCOUNT_TAB_SET.has(rawTab) ? rawTab : "journeys";
  const journeyKey =
    tab === "journeys" && ACCOUNT_JOURNEY_KEY_PATTERN.test(rawJourneyKey || "")
      ? rawJourneyKey
      : null;
  const hasUnknownKey = keysFor(searchParams).some((key) => !ACCOUNT_URL_KEYS.has(key));
  const invalid =
    hasUnknownKey ||
    tabValues.length > 1 ||
    journeyValues.length > 1 ||
    !(
      portalValues.length === 0 ||
      (portalValues.length === 1 &&
        portalValues[0] === "unauthorized" &&
        rawTab === undefined &&
        rawJourneyKey === undefined)
    ) ||
    (rawTab !== undefined && !ACCOUNT_TAB_SET.has(rawTab)) ||
    (rawJourneyKey !== undefined && journeyKey === null);

  return {
    journeyKey: invalid ? null : journeyKey,
    needsCanonicalization: invalid,
    recovery: invalid ? "link-unavailable" : null,
    tab,
  };
}

/** Resolve a syntactically valid selector only against the authorized projection. */
export function resolveAccountUrlState(searchParams, summaries = []) {
  const parsed = parseAccountUrlState(searchParams);
  if (!parsed.journeyKey) {
    return parsed;
  }
  const authorized = summaries.some((summary) => summary.journeyKey === parsed.journeyKey);
  return authorized
    ? parsed
    : {
        journeyKey: null,
        needsCanonicalization: true,
        recovery: "link-unavailable",
        tab: "journeys",
      };
}

export function accountUrlFor({ journeyKey = null, tab = "journeys" }) {
  const safeTab = ACCOUNT_TAB_SET.has(tab) ? tab : "journeys";
  const params = new URLSearchParams({ tab: safeTab });
  if (safeTab === "journeys" && ACCOUNT_JOURNEY_KEY_PATTERN.test(journeyKey || "")) {
    params.set("journey", journeyKey);
  }
  return `/account?${params.toString()}`;
}
