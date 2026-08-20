import { isRuntimeFunction, isRuntimeObject, isRuntimeString } from "../runtimeValues";

function mutationErrorMessage(error, fallback) {
  if (!isRuntimeObject(error)) {
    return fallback;
  }
  if (isRuntimeString(error.data) && error.data) {
    return error.data;
  }
  return isRuntimeString(error.message) && error.message ? error.message : fallback;
}
/**
 * Wrap portal mutations with toast + error mapping.
 * Signature is always (options, fn) — options first, mutation callback second.
 * @template Result
 * @param {{ label?: string, successMessage?: string | ((result: Result) => string), onSuccess?: (result: Result) => void, onError?: (message: string) => void, showToast?: { success: (msg: string) => string | void, error: (msg: string) => string | void } }} options
 * @param {() => Promise<Result>} fn
 */
export function assertRunMutationArgs(options, fn) {
  if (isRuntimeFunction(fn)) {
    if (options === null || !isRuntimeObject(options) || Array.isArray(options)) {
      throw new TypeError(
        "runMutation(options, fn): first argument must be an options object (e.g. { showToast, successMessage })."
      );
    }
    return;
  }
  if (isRuntimeFunction(options)) {
    throw new TypeError(
      "runMutation(options, fn): arguments look reversed — pass the options object first, then () => mutation(...)."
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
    RUN_MUTATION_REVERSED_CALL_PATTERN.test(line) ? [index + 1] : []
  );
}

/**
 * Wrap portal mutations with toast + error mapping.
 * @template Result
 * @param {{ label?: string, successMessage?: string | ((result: Result) => string), onSuccess?: (result: Result) => void, onError?: (message: string) => void, showToast?: { success: (msg: string) => string | void, error: (msg: string) => string | void } }} options
 * @param {() => Promise<Result>} fn
 * @returns {Promise<Result>}
 */
export async function runMutation(options, fn) {
  assertRunMutationArgs(options, fn);
  const { label, successMessage, onSuccess, onError, showToast } = options;
  try {
    const result = await fn();
    const message = isRuntimeFunction(successMessage)
      ? successMessage(result)
      : successMessage || (label ? `${label} saved` : "Saved successfully");
    showToast?.success?.(message);
    onSuccess?.(result);
    return result;
  } catch (err) {
    const message = mutationErrorMessage(
      err,
      label ? `Unable to ${label.toLowerCase()}` : "Something went wrong"
    );
    showToast?.error?.(message);
    onError?.(message);
    throw err;
  }
}

export function mapMutationError(err, fallback = "Something went wrong") {
  return err?.data || err?.message || fallback;
}
