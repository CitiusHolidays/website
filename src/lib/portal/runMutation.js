/**
 * Wrap portal mutations with toast + error mapping.
 * @param {{ label?: string, successMessage?: string | ((result: unknown) => string), onSuccess?: (result: unknown) => void, onError?: (message: string) => void, showToast?: { success: (msg: string) => void, error: (msg: string) => void } }} options
 * @param {() => Promise<unknown>} fn
 */
export async function runMutation(options, fn) {
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
