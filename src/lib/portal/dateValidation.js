const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  const text = String(value ?? "").trim();
  return ISO_DATE_RE.test(text);
}

/**
 * @param {string | null | undefined} start
 * @param {string | null | undefined} end
 * @param {{ startLabel?: string, endLabel?: string }} [labels]
 * @returns {string | null}
 */
export function getDateRangeError(
  start,
  end,
  { startLabel = "Start date", endLabel = "End date" } = {}
) {
  const from = String(start ?? "").trim();
  const to = String(end ?? "").trim();
  if (!(from && to)) {
    return null;
  }
  if (!(isIsoDate(from) && isIsoDate(to))) {
    return null;
  }
  if (from > to) {
    return `${startLabel} must be on or before ${endLabel}.`;
  }
  return null;
}

/**
 * @param {string | null | undefined} start
 * @param {string | null | undefined} end
 * @param {{ startLabel?: string, endLabel?: string }} [labels]
 */
export function assertDateRangeOrder(start, end, labels = {}) {
  const message = getDateRangeError(start, end, labels);
  if (message) {
    throw new Error(message);
  }
}
