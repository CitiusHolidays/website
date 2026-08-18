export type P95RelativeComparison = "fixed_only" | "included" | "not_available";

export interface PerformanceComparisonPair<T> {
  accepted: T;
  aggregate: "median" | "p95";
  candidate: T;
}

function pairSamples<T>(
  candidates: readonly T[],
  accepted: readonly T[],
  aggregate: PerformanceComparisonPair<T>["aggregate"],
  key: (sample: T) => string
) {
  const acceptedByKey = new Map(accepted.map((sample) => [key(sample), sample]));
  return candidates.map((candidate) => {
    const sampleKey = key(candidate);
    const acceptedSample = acceptedByKey.get(sampleKey);
    if (!acceptedSample) {
      throw new Error(`Accepted ${aggregate} performance baseline is missing ${sampleKey}`);
    }
    return { accepted: acceptedSample, aggregate, candidate };
  });
}

export function planPerformanceComparisons<T>(args: {
  acceptedMedian: readonly T[];
  candidateMedian: readonly T[];
  candidateP95: readonly T[];
  key: (sample: T) => string;
}) {
  const medianPairs = pairSamples(args.candidateMedian, args.acceptedMedian, "median", args.key);
  return {
    p95RelativeComparison:
      args.candidateP95.length > 0 ? ("fixed_only" as const) : ("not_available" as const),
    pairs: medianPairs,
  };
}
