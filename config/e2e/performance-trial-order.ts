export function rotatePerformanceTrialOrder<T>(values: readonly T[], rawTrialIndex?: string) {
  if (values.length === 0) {
    throw new Error("Authenticated performance trial order requires at least one scenario");
  }
  const trialIndex = rawTrialIndex === undefined ? 1 : Number(rawTrialIndex);
  if (!Number.isInteger(trialIndex) || trialIndex < 1) {
    throw new Error("Authenticated performance trial index must be a positive integer");
  }
  const offset = (trialIndex - 1) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}
