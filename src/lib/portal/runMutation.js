/**
 * Wrap portal mutations with toast + error mapping.
 * Signature is always (options, fn) — options first, mutation callback second.
 * @param {{ label?: string, successMessage?: string | ((result: unknown) => string), onSuccess?: (result: unknown) => void, onError?: (message: string) => void, showToast?: { success: (msg: string) => void, error: (msg: string) => void } }} options
 * @param {() => Promise<unknown>} fn
 */
export function assertRunMutationArgs(options, fn) {
  if (typeof fn === "function") {
    if (options == null || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError(
        "runMutation(options, fn): first argument must be an options object (e.g. { showToast, successMessage }).",
      );
    }
    return;
  }
  if (typeof options === "function") {
    throw new TypeError(
      "runMutation(options, fn): arguments look reversed — pass the options object first, then () => mutation(...).",
    );
  }
  throw new TypeError("runMutation(options, fn): second argument must be a function.");
}

const RUN_MUTATION_REVERSED_CALL_PATTERN = /runMutation\s*\(\s*(?:async\s*)?\(/;

/**
 * @param {string} source
 * @returns {number[]}
 */
export function findRunMutationReversedCallLines(source) {
  const lines = source.split("\n");
  return lines.flatMap((line, index) =>
    RUN_MUTATION_REVERSED_CALL_PATTERN.test(line) ? [index + 1] : [],
  );
}

/**
 * Wrap portal mutations with toast + error mapping.
 * @param {{ label?: string, successMessage?: string | ((result: unknown) => string), onSuccess?: (result: unknown) => void, onError?: (message: string) => void, showToast?: { success: (msg: string) => void, error: (msg: string) => void } }} options
 * @param {() => Promise<unknown>} fn
 */
export async function runMutation(options, fn) {
  assertRunMutationArgs(options, fn);
  const { label, successMessage, onSuccess, onError, showToast } = options;
  try {
    const result = await fn();
    const message =
      typeof successMessage === "function"
        ? successMessage(result)
        : successMessage || (label ? `${label} saved` : "Saved successfully");
    showToast?.success?.(message);
    onSuccess?.(result);
    return result;
  } catch (err) {
    const message =
      err?.data ||
      err?.message ||
      (label ? `Unable to ${label.toLowerCase()}` : "Something went wrong");
    showToast?.error?.(message);
    onError?.(message);
    throw err;
  }
}

export function mapMutationError(err, fallback = "Something went wrong") {
  return err?.data || err?.message || fallback;
}
